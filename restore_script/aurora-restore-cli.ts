import { S3Client, ListObjectsV2Command, GetObjectCommand, ListBucketsCommand, GetBucketTaggingCommand } from '@aws-sdk/client-s3';
import * as prompts from 'prompts';
import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RestoreConfig {
  s3Bucket: string;
  s3Prefix: string;
  clusterIdentifier: string;
  databaseName: string;
  backupDate: string;
  targetHost: string;
  targetPort: number;
  targetUser: string;
  targetDatabase: string;
  selectedTables: string[];
  downloadDir: string;
}

class AuroraRestoreCli {
  private s3Client: S3Client;
  private config: Partial<RestoreConfig> = {};
  private backupAnalysis?: { tables: string[], tableMap: Map<string, { schemaId?: string, dataId?: string }> };

  constructor() {
    this.s3Client = new S3Client({});
  }

  async run(): Promise<void> {
    console.log('\n🔄 Aurora PostgreSQL Backup Restore CLI');
    console.log('========================================\n');

    try {
      await this.promptS3Config();
      await this.promptClusterSelection();
      await this.promptDatabaseSelection();
      await this.promptBackupDateSelection();
      await this.downloadAndAnalyzeToc();
      await this.promptTableSelection();
      await this.promptTargetDatabase();
      await this.generateRestoreCommand();
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  private async promptS3Config(): Promise<void> {
    console.log('📦 S3 Configuration\n-------------------');
    
    try {
      console.log('🔍 Auto-discovering backup bucket...');
      const bucket = await this.findBackupBucket();
      if (bucket) {
        this.config.s3Bucket = bucket;
        this.config.s3Prefix = 'backups';
        console.log(`✅ Found backup bucket: ${bucket}\n`);
        return;
      }
    } catch (error) {
      console.log('⚠️  Auto-discovery failed, falling back to manual entry');
    }

    const s3Config = await prompts([
      {
        type: 'text',
        name: 'bucket',
        message: 'S3 Bucket name:',
        validate: (value: string) => value.length > 0 || 'Bucket name is required'
      },
      {
        type: 'text',
        name: 'prefix',
        message: 'S3 Prefix (default: backups):',
        initial: 'backups'
      }
    ]);
    if (!s3Config.bucket) {
      throw new Error('S3 bucket is required');
    }
    this.config.s3Bucket = s3Config.bucket;
    this.config.s3Prefix = s3Config.prefix || 'backups';
    console.log(`✅ Using S3 location: s3://${this.config.s3Bucket}/${this.config.s3Prefix}/\n`);
  }

  private async selectFromList(items: string[], itemType: string, discoveringMsg: string, notFoundMsg: string): Promise<string> {
    console.log(discoveringMsg);
    if (items.length === 0) throw new Error(notFoundMsg);
    
    if (items.length === 1) {
      console.log(`✅ Found ${itemType}: ${items[0]}\n`);
      return items[0];
    }

    const choice = await prompts({
      type: 'select',
      name: 'value',
      message: `Select ${itemType}:`,
      choices: items.map(item => ({ title: item, value: item }))
    });

    if (!choice.value) throw new Error(`${itemType} selection is required`);
    console.log(`✅ Selected ${itemType}: ${choice.value}\n`);
    return choice.value;
  }

  private async promptClusterSelection(): Promise<void> {
    const clusters = await this.listClusters();
    this.config.clusterIdentifier = await this.selectFromList(
      clusters, 
      'cluster', 
      '🗂️ Discovering Aurora clusters...',
      'No Aurora clusters found in S3'
    );
  }

  private async promptDatabaseSelection(): Promise<void> {
    const databases = await this.listDatabases();
    this.config.databaseName = await this.selectFromList(
      databases,
      'database',
      '💾 Discovering databases...',
      'No database backups found for the selected cluster'
    );
  }

  private async promptBackupDateSelection(): Promise<void> {
    console.log('📅 Discovering backup dates...');
    const dates = await this.listBackupDates();
    if (dates.length === 0) throw new Error('No backups found for the selected database');

    const dateChoice = await prompts({
      type: 'select',
      name: 'date',
      message: 'Select backup date to restore:',
      choices: dates
        .sort((a, b) => b.localeCompare(a))
        .map(date => ({
          title: `${date} (${this.formatDateAge(date)})`,
          value: date
        }))
    });

    if (!dateChoice.date) throw new Error('Backup date selection is required');
    this.config.backupDate = dateChoice.date;
    console.log(`✅ Selected backup: ${this.config.backupDate}\n`);
  }

  private async downloadAndAnalyzeToc(): Promise<void> {
    console.log('📥 Downloading table of contents...');
    
    try {
      // Create temporary directory for download
      const tempDir = path.join(process.cwd(), '.aurora-restore-temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      this.config.downloadDir = tempDir;
      const tocPath = path.join(tempDir, 'toc.dat');
      
      // Download toc.dat file
      const s3Key = `${this.config.s3Prefix}/${this.config.clusterIdentifier}/${this.config.databaseName}/${this.config.backupDate}/toc.dat`;
      
      await this.downloadS3File(s3Key, tocPath);
      console.log(`✅ Downloaded table of contents\n`);
    } catch (error) {
      throw new Error(`Failed to download toc.dat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async promptTableSelection(): Promise<void> {
    console.log('📋 Analyzing backup contents...');
    
    try {
      this.backupAnalysis = await this.analyzeBackupContents();
      const { tables } = this.backupAnalysis;
      
      if (tables.length === 0) {
        console.log('⚠️  No tables found in backup');
        this.config.selectedTables = [];
        return;
      }

      const tableChoice = await prompts({
        type: 'multiselect',
        name: 'tables',
        message: 'Select tables to restore (use space to select, enter to confirm):',
        choices: [
          { title: '🗂️  Restore entire database (all tables)', value: '__ALL__' },
          ...tables.map((table: string) => ({
            title: `📄 ${table}`,
            value: table
          }))
        ],
        hint: '- Space to select/deselect, ↑/↓ to navigate, Enter to confirm'
      });

      if (!tableChoice.tables || tableChoice.tables.length === 0) {
        throw new Error('At least one table or full database restore must be selected');
      }

      if (tableChoice.tables.includes('__ALL__')) {
        this.config.selectedTables = [];
        console.log('✅ Selected: Full database restore\n');
      } else {
        this.config.selectedTables = tableChoice.tables;
        console.log(`✅ Selected ${tableChoice.tables.length} table(s): ${tableChoice.tables.join(', ')}\n`);
      }
    } catch (error) {
      throw new Error(`Failed to analyze backup contents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async promptTargetDatabase(): Promise<void> {
    console.log('🎯 Target Database Configuration\n-------------------------------');

    const targetConfig = await prompts([
      {
        type: 'text',
        name: 'host',
        message: 'Target PostgreSQL host (full RDS endpoint):',
        validate: (value: string) => value.length > 0 || 'Host is required'
      },
      {
        type: 'number',
        name: 'port',
        message: 'Target PostgreSQL port:',
        initial: 5432,
        validate: (value: number) => (value > 0 && value <= 65535) || 'Port must be between 1 and 65535'
      },
      {
        type: 'text',
        name: 'user',
        message: 'Target PostgreSQL username:',
        validate: (value: string) => value.length > 0 || 'Username is required'
      },
      {
        type: 'text',
        name: 'database',
        message: 'Target database name:',
        initial: this.config.databaseName,
        validate: (value: string) => value.length > 0 || 'Database name is required'
      }
    ]);

    if (!targetConfig.host || !targetConfig.user || !targetConfig.database) {
      throw new Error('Target database configuration is incomplete');
    }

    Object.assign(this.config, {
      targetHost: targetConfig.host,
      targetPort: targetConfig.port || 5432,
      targetUser: targetConfig.user,
      targetDatabase: targetConfig.database
    });

    console.log(`✅ Target: ${this.config.targetUser}@${this.config.targetHost}:${this.config.targetPort}/${this.config.targetDatabase}\n`);
  }

  private async generateRestoreCommand(): Promise<void> {
    console.log('🔧 Preparing restore command...');
    console.log('===============================\n');

    // Use /tmp for backup files organized by database with timestamp
    const timestamp = Date.now();
    const backupDir = path.join('/tmp', 'aurora-restore', this.config.databaseName!, `${timestamp}`);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('📥 Step 1: Downloading backup from S3');
    console.log('--------------------------------------');
    
    try {
      await this.downloadBackupFiles(backupDir);
      console.log('✅ Backup files downloaded successfully\n');
    } catch (error) {
      throw new Error(`Failed to download backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('🚀 Step 2: Generating restore command\n------------------------------');
    
    const fqdn = this.config.targetHost;
    if (!fqdn || !fqdn.includes('.rds.amazonaws.com')) {
      throw new Error('Please provide the full RDS endpoint (FQDN)');
    }

    let restoreCmd = `pg_restore --clean -h ${fqdn} -p ${this.config.targetPort} -U ${this.config.targetUser} -d ${this.config.targetDatabase} -v`;

    if (this.config.selectedTables && this.config.selectedTables.length > 0) {
      restoreCmd += ' --section=pre-data --section=data --section=post-data';
      for (const table of this.config.selectedTables) {
        restoreCmd += ` -t "${table}"`;
      }
    } else {
      restoreCmd += ' -C --if-exists';
    }

    restoreCmd += ` ${backupDir}/`;

    const scope = this.config.selectedTables?.length 
      ? `${this.config.selectedTables.length} selected table(s)` 
      : 'Full database';

    console.log('📋 Summary\n----------');
    console.log(`• Source: s3://${this.config.s3Bucket}/${this.config.s3Prefix}/${this.config.clusterIdentifier}/${this.config.databaseName}/${this.config.backupDate}/`);
    console.log(`• Target: ${this.config.targetUser}@${this.config.targetHost}:${this.config.targetPort}/${this.config.targetDatabase}`);
    console.log(`• Scope: ${scope}`);
    console.log(`• Files: ${backupDir}\n`);

    console.log('🎯 Command to execute:');
    console.log(restoreCmd);
    console.log('');

    // Ask the user if they want to run the command now
    const { runNow } = await prompts({
      type: 'confirm',
      name: 'runNow',
      message: 'Would you like to run this restore command now?',
      initial: false
    });

    if (runNow) {
      try {
        const { spawn } = require('child_process');
        const args = restoreCmd.split(' ');
        const proc = spawn(args[0], args.slice(1), { stdio: 'inherit' });
        await new Promise<void>((resolve, reject) => {
          proc.on('exit', (code: number | null) => code === 0 ? resolve() : reject(new Error(`Restore exited with code ${code}`)));
          proc.on('error', reject);
        });
      } catch (err) {
        console.error('❌ Error running restore command:', err instanceof Error ? err.message : err);
      }
    }
  }

  private async listS3Directories(prefix: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.config.s3Bucket!,
      Prefix: prefix,
      Delimiter: '/'
    });

    const response = await this.s3Client.send(command);
    const items: string[] = [];
    
    if (response.CommonPrefixes) {
      for (const commonPrefix of response.CommonPrefixes) {
        if (commonPrefix.Prefix) {
          const item = commonPrefix.Prefix.replace(prefix, '').replace('/', '');
          if (item) items.push(item);
        }
      }
    }
    return items;
  }

  private async listClusters(): Promise<string[]> {
    return this.listS3Directories(`${this.config.s3Prefix}/`);
  }

  private async listDatabases(): Promise<string[]> {
    return this.listS3Directories(`${this.config.s3Prefix}/${this.config.clusterIdentifier}/`);
  }

  private async listBackupDates(): Promise<string[]> {
    return this.listS3Directories(`${this.config.s3Prefix}/${this.config.clusterIdentifier}/${this.config.databaseName}/`);
  }

  private async downloadS3File(s3Key: string, localPath: string): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.config.s3Bucket!,
      Key: s3Key
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error(`Failed to download ${s3Key}: No content received`);
    }

    const writeStream = createWriteStream(localPath);
    const bodyStream = response.Body as NodeJS.ReadableStream;
    
    return new Promise((resolve, reject) => {
      bodyStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      bodyStream.on('error', reject);
    });
  }

  private async downloadBackupFiles(backupDir: string): Promise<void> {
    const s3Prefix = `${this.config.s3Prefix}/${this.config.clusterIdentifier}/${this.config.databaseName}/${this.config.backupDate}/`;
    const requiredFiles = await this.getRequiredBackupFiles();
    
    console.log(`📊 Downloading ${requiredFiles.length} files from s3://${this.config.s3Bucket}/${s3Prefix}`);
    
    for (const fileName of requiredFiles) {
      const s3Key = `${s3Prefix}${fileName}`;
      const localPath = path.join(backupDir, fileName);
      
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      console.log(`  ${fileName}`);
      await this.downloadS3File(s3Key, localPath);
    }
  }

  private async analyzeBackupContents(): Promise<{ tables: string[], tableMap: Map<string, { schemaId?: string, dataId?: string }> }> {
    const backupDir = this.config.downloadDir!;
    
    if (!fs.existsSync(path.join(backupDir, 'toc.dat'))) {
      throw new Error('toc.dat file not found');
    }

    try {
      console.log('Using pg_restore to analyze backup contents...');
      const { stdout, stderr } = await execAsync(`pg_restore --list "${backupDir}"`);
      
      console.log(`pg_restore output: ${stdout.length} characters`);
      if (stderr) console.log('pg_restore stderr:', stderr);
      
      const tables: string[] = [];
      // Map: table name -> { schemaId: string, dataId: string }
      const tableMap = new Map<string, { schemaId?: string, dataId?: string }>();
      const lines = stdout.split('\n');

      for (const line of lines) {
        if (!line.trim() || line.startsWith(';')) {
          continue;
        }

        // Match dumpId and entry type
        const dumpIdMatch = line.match(/^(\d+);/);
        if (!dumpIdMatch) continue;
        const dumpId = dumpIdMatch[1];

        // Find TABLE or TABLE DATA entries
        const words = line.trim().split(/\s+/);
        const tableIdx = words.indexOf('TABLE');
        const dataIdx = words.indexOf('DATA');

        // Schema (TABLE) entry
        if (tableIdx !== -1 && (dataIdx === -1 || dataIdx !== tableIdx + 1)) {
          const schema = words[tableIdx + 1];
          const tableName = words[tableIdx + 2];
          if (schema && tableName && (schema === 'public' || !schema.match(/^(pg_|information_schema)/))) {
            const fullTableName = schema === 'public' ? tableName : `${schema}.${tableName}`;
            if (!tables.includes(fullTableName)) tables.push(fullTableName);
            if (!tableMap.has(fullTableName)) tableMap.set(fullTableName, {});
            tableMap.get(fullTableName)!.schemaId = dumpId;
          }
        }
        // Data (TABLE DATA) entry
        if (tableIdx !== -1 && dataIdx === tableIdx + 1) {
          const schema = words[dataIdx + 1];
          const tableName = words[dataIdx + 2];
          if (schema && tableName && (schema === 'public' || !schema.match(/^(pg_|information_schema)/))) {
            const fullTableName = schema === 'public' ? tableName : `${schema}.${tableName}`;
            if (!tables.includes(fullTableName)) tables.push(fullTableName);
            if (!tableMap.has(fullTableName)) tableMap.set(fullTableName, {});
            tableMap.get(fullTableName)!.dataId = dumpId;
          }
        }
      }

      console.log(`Found ${tables.length} tables in backup`);
      return { tables: tables.sort(), tableMap };
    } catch (error) {
      throw new Error(`pg_restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  private async getRequiredBackupFiles(): Promise<string[]> {
    const requiredFiles = ['toc.dat'];
    
    // If restoring all tables or no specific tables selected, download everything
    if (!this.config.selectedTables || this.config.selectedTables.length === 0) {
      const files = await this.listAllDataFiles();
      return [...requiredFiles, ...files];
    }
    
    // For specific tables, use cached analysis to find required files
    if (!this.backupAnalysis) {
      throw new Error('Backup analysis not available. This should not happen.');
    }

    const { tableMap } = this.backupAnalysis;
    const tableFiles: string[] = [];

    for (const selectedTable of this.config.selectedTables) {
      const entry = tableMap.get(selectedTable);
      if (entry && entry.dataId) {
        tableFiles.push(`${entry.dataId}.dat.gz`);
        console.log(`Table ${selectedTable} requires data file: ${entry.dataId}.dat.gz`);
      } else {
        console.log(`⚠️  Could not find data file for table: ${selectedTable}`);
      }
    }

    console.log(`Found ${tableFiles.length} specific data files for selected tables`);
    return [...requiredFiles, ...tableFiles];
  }
  
  private async listAllDataFiles(): Promise<string[]> {
    const s3Prefix = `${this.config.s3Prefix}/${this.config.clusterIdentifier}/${this.config.databaseName}/${this.config.backupDate}/`;
    const command = new ListObjectsV2Command({
      Bucket: this.config.s3Bucket!,
      Prefix: s3Prefix
    });

    const response = await this.s3Client.send(command);
    const files: string[] = [];
    
    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key && object.Key.endsWith('.dat.gz')) {
          files.push(object.Key.replace(s3Prefix, ''));
        }
      }
    }
    
    return files;
  }

  private formatDateAge(dateStr: string): string {
    const backupDate = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - backupDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  private async findBackupBucket(): Promise<string | null> {
    try {
      // List all S3 buckets
      const listBucketsCommand = new ListBucketsCommand({});
      const bucketsResponse = await this.s3Client.send(listBucketsCommand);
      
      if (!bucketsResponse.Buckets) {
        return null;
      }

      // Check each bucket for our tag
      for (const bucket of bucketsResponse.Buckets) {
        if (!bucket.Name) continue;
        
        try {
          const getTagsCommand = new GetBucketTaggingCommand({
            Bucket: bucket.Name
          });
          const tagsResponse = await this.s3Client.send(getTagsCommand);
          
          if (tagsResponse.TagSet) {
            const hasBackupTag = tagsResponse.TagSet.some(
              tag => tag.Key === 'aurora_native_backup_bucket' && tag.Value === 'true'
            );
            
            if (hasBackupTag) {
              return bucket.Name;
            }
          }
        } catch (error) {
          // Bucket might not have tags or we don't have permission - skip it
          continue;
        }
      }
      
      return null;
    } catch (error) {
      throw new Error(`Failed to discover backup bucket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Main execution
if (require.main === module) {
  const cli = new AuroraRestoreCli();
  cli.run().catch(error => {
    console.error('\n💥 Fatal Error:', error.message);
    process.exit(1);
  });
}

export { AuroraRestoreCli };