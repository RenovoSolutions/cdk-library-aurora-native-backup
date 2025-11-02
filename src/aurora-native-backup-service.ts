import {
  Stack,
  Duration,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_ecs_patterns as ecsPatterns,
  aws_efs as efs,
  aws_events as events,
  aws_iam as iam,
  aws_logs as logs,
  aws_rds as rds,
  aws_s3 as s3,
  aws_secretsmanager as secretsmanager,
  RemovalPolicy,
  Tags,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * Database connection configuration for the Aurora backup service.
 */
export interface AuroraBackupConnectionProps {
  /**
   * The database username for backup operations.
   * Must exist in the Aurora PostgreSQL database cluster with read permissions on ALL databases to be backed up.
   *
   * For PostgreSQL 14+ (recommended), use the pg_read_all_data role:
   * - GRANT CONNECT ON DATABASE your_database TO backup_user;
   * - GRANT pg_read_all_data TO backup_user;
   *
   * The pg_read_all_data role automatically provides SELECT on all tables/views, USAGE on schemas/sequences,
   * and access to future objects without additional grants.
   *
   * @example 'backup_user'
   */
  readonly username: string;

  /**
   * The database names to backup.
   * The backup user must have appropriate permissions on all databases in this array.
   *
   * @default ['postgres'] - Uses the cluster's default database
   */
  readonly databaseNames?: string[];

  /**
   * Secrets Manager secret containing the database password.
   * Required for database authentication.
   */
  readonly passwordSecret: secretsmanager.ISecret;
}

/**
 * Infrastructure configuration properties for Aurora PostgreSQL native backup service.
 */
export interface AuroraNativeBackupServiceProps {
  /**
   * The Aurora PostgreSQL database cluster to backup.
   */
  readonly cluster: rds.IDatabaseCluster;

  /**
   * The VPC where the backup service will run.
   */
  readonly vpc: ec2.IVpc;

  /**
   * Name for the S3 backup bucket that will be created by the construct.
   * The bucket will be configured with appropriate settings for backup storage.
   */
  readonly backupBucketName: string;

  /**
   * Database connection configuration.
   */
  readonly connection: AuroraBackupConnectionProps;

  /**
   * Backup retention period in days.
   *
   * @default 7
   */
  readonly retentionDays?: number;

  /**
   * Backup schedule in EventBridge cron expression format (UTC).
   * Can be either a cron fragment (e.g., '0 5 * * ? *') or a full expression (e.g., 'cron(0 5 * * ? *)').
   * Also supports rate expressions (e.g., 'rate(1 day)').
   *
   * @default '0 5 * * ? *' - Daily at 5:00 AM UTC
   * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
   */
  readonly backupSchedule?: string;

  /**
   * Fargate task CPU units.
   *
   * @default 256
   */
  readonly cpu?: number;

  /**
   * Fargate task memory in MB.
   *
   * @default 512
   */
  readonly memoryLimitMiB?: number;

  /**
   * ECR repository containing the backup Docker image.
   * The image will be pulled using the imageUri from the `AuroraBackupRepository` construct.
   */
  readonly ecrRepository: ecr.IRepository;

  /**
   * Subnet selection for the backup task.
   *
   * @default { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } - Uses private subnets with egress
   */
  readonly subnetSelection?: ec2.SubnetSelection;
}

/**
 * A construct for Aurora PostgreSQL native backup service.
 *
 * Creates a scheduled ECS Fargate service that performs PostgreSQL backups using `pg_dump`.
 * Backups are written to EFS and then copied to S3. They are removed from EFS after the
 * configured `retentionDays`.
 * The S3 bucket for backups can be provided or will be created automatically.
 *
 * @example
 * const backupService = new AuroraNativeBackupService(this, 'BackupService', {
 *   cluster: dbCluster,
 *   vpc: vpc,
 *   backupBucketName: 'my-aurora-backups',
 *   ecrRepository: backupRepository.repository,
 *   connection: {
 *     username: 'backup_user',
 *     databaseNames: ['production', 'analytics', 'reporting'],
 *     passwordSecret: backupUserSecret,
 *   },
 * });
 */
export class AuroraNativeBackupService extends Construct {
  /**
   * The ECS scheduled task that runs the backup process.
   */
  public readonly scheduledTask: ecsPatterns.ScheduledFargateTask;

  /**
   * The ECS cluster running the backup service.
   */
  public readonly ecsCluster: ecs.ICluster;

  /**
   * The ECS task definition for the backup container.
   */
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  /**
   * The security group for the backup service.
   */
  public readonly backupSecurityGroup: ec2.SecurityGroup;

  /**
   * The IAM role for backup tasks.
   */
  public readonly taskRole: iam.Role;

  /**
   * The IAM execution role for ECS tasks
   */
  public readonly executionRole: iam.Role;

  /**
   * The S3 bucket for backup storage.
   */
  public readonly backupBucket: s3.Bucket;

  /**
   * The EFS file system for backup storage.
   */
  public readonly fileSystem: efs.IFileSystem;

  /**
   * The EFS access point for backup storage.
   */
  public readonly accessPoint: efs.IAccessPoint;

  /**
   * The constructor for the `AuroraNativeBackupService`.
   * This creates a scheduled ECS Fargate service that performs PostgreSQL backups using `pg_dump`.
   * It also creates the ECS cluster, task definition, IAM roles, EFS file system, and S3 bucket for backup storage.
   * @param scope The scope in which to create this Construct. Normally this is a stack.
   * @param id The Construct ID of the backup service.
   * @param props The properties for the backup service, as defined in the `AuroraNativeBackupServiceProps` interface.
   */
  constructor(scope: Construct, id: string, props: AuroraNativeBackupServiceProps) {
    super(scope, id);

    const {
      cluster: dbCluster,
      vpc,
      backupBucketName,
      connection,
      retentionDays = 7,
      backupSchedule = '0 5 * * ? *',
      cpu = 256,
      memoryLimitMiB = 512,
      ecrRepository,
      subnetSelection = { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    } = props;

    const containerImage = ecs.ContainerImage.fromEcrRepository(ecrRepository, 'latest');

    const scheduleExpression = events.Schedule.expression(this.normalizeScheduleExpression(backupSchedule));

    this.backupSecurityGroup = new ec2.SecurityGroup(this, 'BackupSecurityGroup', {
      securityGroupName: 'AuroraBackupServiceSG',
      vpc,
      description: 'Security group for Aurora backup service',
      allowAllOutbound: true,
    });

    const fileSystemSecurityGroup = new ec2.SecurityGroup(this, 'BackupEfsSecurityGroup', {
      securityGroupName: 'AuroraBackupEfsSG',
      vpc,
      description: 'Security group for Aurora backup EFS',
      allowAllOutbound: true,
    });

    fileSystemSecurityGroup.addIngressRule(
      this.backupSecurityGroup,
      ec2.Port.tcp(2049),
      'Allow NFS access from backup task',
    );

    const fileSystem = new efs.FileSystem(this, 'BackupFileSystem', {
      vpc,
      securityGroup: fileSystemSecurityGroup,
      encrypted: true,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.ELASTIC,
      removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
    });
    this.fileSystem = fileSystem;
    this.accessPoint = fileSystem.addAccessPoint('BackupAccessPoint', {
      path: '/aurora-backups',
      createAcl: {
        ownerUid: '1000',
        ownerGid: '1000',
        permissions: '750',
      },
      posixUser: {
        uid: '1000',
        gid: '1000',
      },
    });

    const stack = Stack.of(this);

    // Create S3 bucket for backup storage
    this.backupBucket = new s3.Bucket(this, 'BackupBucket', {
      bucketName: backupBucketName,
      removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: 'DeleteOldBackups',
          enabled: true,
          expiration: Duration.days(retentionDays),
        },
      ],
    });
    // Tag the backup bucket for discovery by restore CLI
    Tags.of(this.backupBucket).add('aurora_native_backup_bucket', 'true');

    // Create CloudWatch log group
    const logGroup = new logs.LogGroup(this, 'BackupLogGroup', {
      logGroupName: `/ecs/aurora-backup/${dbCluster.clusterIdentifier}`,
      retention: logs.RetentionDays.TWO_YEARS,
      removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
    });

    // Prepare environment variables
    const databaseNames = connection.databaseNames ?? ['postgres'];
    const taskEnvironment: Record<string, string> = {
      DB_HOST: dbCluster.clusterEndpoint.hostname,
      DB_PORT: dbCluster.clusterEndpoint.port.toString(),
      DB_NAMES: JSON.stringify(databaseNames),
      DB_USER: connection.username,
      BACKUP_ROOT: '/mnt/aurora-backups',
      AWS_REGION: stack.region,
      S3_BUCKET: this.backupBucket.bucketName,
      S3_PREFIX: 'backups',
      CLUSTER_IDENTIFIER: dbCluster.clusterIdentifier,
    };

    const containerSecrets = {
      DB_PASSWORD: ecs.Secret.fromSecretsManager(connection.passwordSecret, 'password'),
    };

    // Create scheduled task using image options approach
    this.scheduledTask = new ecsPatterns.ScheduledFargateTask(this, 'BackupScheduledTask', {
      vpc,
      subnetSelection,
      scheduledFargateTaskImageOptions: {
        image: containerImage,
        environment: taskEnvironment,
        secrets: containerSecrets,
        cpu,
        memoryLimitMiB,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'backup',
          logGroup,
        }),
      },
      schedule: scheduleExpression,
      securityGroups: [this.backupSecurityGroup],
    });

    // Get the task definition created by the scheduled task
    this.taskDefinition = this.scheduledTask.taskDefinition;

    // Set the runtime platform to ARM64 to match the Docker image architecture
    const cfnTaskDefinition = this.taskDefinition.node.defaultChild as ecs.CfnTaskDefinition;
    cfnTaskDefinition.runtimePlatform = {
      cpuArchitecture: 'ARM64',
      operatingSystemFamily: 'LINUX',
    };

    // Add EFS volume and mount point to the created task definition
    this.taskDefinition.addVolume({
      name: 'AuroraBackupData',
      efsVolumeConfiguration: {
        fileSystemId: this.fileSystem.fileSystemId,
        transitEncryption: 'ENABLED',
        authorizationConfig: {
          accessPointId: this.accessPoint.accessPointId,
          iam: 'ENABLED',
        },
      },
    });

    // Add mount points to the container
    const container = this.taskDefinition.defaultContainer!;
    container.addMountPoints({
      containerPath: '/mnt/aurora-backups',
      sourceVolume: 'AuroraBackupData',
      readOnly: false,
    });

    this.ecsCluster = this.scheduledTask.cluster;
    this.scheduledTask.node.addDependency(this.fileSystem.mountTargetsAvailable);

    this.taskRole = this.taskDefinition.taskRole as iam.Role;
    this.executionRole = this.taskDefinition.executionRole as iam.Role;

    // Grant permissions for secrets access (execution role retrieves secrets at container startup)
    connection.passwordSecret.grantRead(this.executionRole);

    // S3 permissions for backup storage
    this.backupBucket.grantReadWrite(this.taskRole);

    // EFS permissions
    this.taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['elasticfilesystem:ClientWrite'],
        resources: [this.accessPoint.accessPointArn],
      }),
    );

    // EFS permissions for execution role
    this.executionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['elasticfilesystem:ClientMount', 'elasticfilesystem:ClientWrite'],
        resources: [this.accessPoint.accessPointArn],
      }),
    );
  }

  /**
   * Normalizes schedule expressions so both fragments (e.g. `0 5 * * ? *`)
   * and full EventBridge expressions (e.g. `cron(0 5 * * ? *)`) are accepted.
   *
   * @param expression The schedule expression to normalize
   * @returns A properly formatted EventBridge schedule expression
   */
  private normalizeScheduleExpression(expression: string): string {
    const trimmed = expression.trim();
    if (/^(cron|rate)\s*\(.+\)$/i.test(trimmed)) {
      return trimmed;
    }
    return `cron(${trimmed})`;
  }
}
