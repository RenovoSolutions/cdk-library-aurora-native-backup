import { App, Stack, Duration } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { AuroraBackupRepository, AuroraNativeBackupService } from '../src';

describe('Aurora Native Backup Library', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('AuroraBackupRepository', () => {
    test('creates all required resources', () => {
      const repo = new AuroraBackupRepository(stack, 'BackupRepo', {
        repositoryName: 'aurora-backup',
      });

      const template = Template.fromStack(stack);

      // Should create ECR repository
      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'aurora-backup',
        ImageScanningConfiguration: { ScanOnPush: true },
      });

      // Should have public properties
      expect(repo.repository).toBeDefined();
      expect(repo.imageAsset).toBeDefined();
      expect(repo.imageUri).toContain(':latest');
    });

    test('supports custom repository names', () => {
      new AuroraBackupRepository(stack, 'BackupRepo', {
        repositoryName: 'custom-backup-repo',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'custom-backup-repo',
      });
    });

    test('works without explicit repository name', () => {
      const repo = new AuroraBackupRepository(stack, 'BackupRepo', {});

      expect(repo.repository).toBeDefined();
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ECR::Repository', {
        ImageScanningConfiguration: { ScanOnPush: true },
      });
    });

    test('matches CloudFormation template snapshot', () => {
      new AuroraBackupRepository(stack, 'SnapshotRepo', {
        repositoryName: 'snapshot-test-repo',
      });

      const template = Template.fromStack(stack);
      // Remove unstable ECR image properties (like digests, asset hashes, etc.) from the template before snapshotting
      const json = template.toJSON();
      // Remove unstable properties from all ECR-related custom resources
      Object.values(json.Resources).forEach((resource) => {
        const res: any = resource;
        if (res.Type === 'Custom::ECRDeployment') {
          // Remove properties that are likely to change on every run
          if (res.Properties) {
            delete res.Properties.ImageDigest;
            delete res.Properties.SourceImageDigest;
            delete res.Properties.SourceImageTag;
            delete res.Properties.SourceImageUri;
          }
        }
      });
      expect(json).toMatchSnapshot();
    });
  });

  describe('AuroraNativeBackupService', () => {
    let vpc: ec2.IVpc;
    let cluster: rds.IDatabaseCluster;
    let secret: secretsmanager.ISecret;
    let repository: ecr.IRepository;

    beforeEach(() => {
      vpc = new ec2.Vpc(stack, 'TestVpc', { maxAzs: 2 });
      cluster = rds.DatabaseCluster.fromDatabaseClusterAttributes(stack, 'TestCluster', {
        clusterIdentifier: 'test-cluster',
        clusterEndpointAddress: 'test.cluster.us-east-1.rds.amazonaws.com',
        port: 5432,
      });
      secret = new secretsmanager.Secret(stack, 'TestSecret');
      repository = new ecr.Repository(stack, 'TestRepository');
    });

    test('creates complete backup infrastructure', () => {
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'my-backups',
        ecrRepository: repository,
        connection: {
          username: 'backup_user',
          databaseNames: ['production', 'analytics'],
          passwordSecret: secret,
        },
      });

      const template = Template.fromStack(stack);

      // Should create S3 bucket
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'my-backups',
      });

      // Should create ECS task definition
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        RequiresCompatibilities: ['FARGATE'],
        RuntimePlatform: { CpuArchitecture: 'ARM64' },
      });

      // Should create scheduled EventBridge Scheduler schedule
      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        State: 'ENABLED',
      });
    });

    test('configures multi-database environment correctly', () => {
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'test-backups',
        ecrRepository: repository,
        connection: {
          username: 'backup_user',
          databaseNames: ['db1', 'db2', 'db3'],
          passwordSecret: secret,
        },
      });

      const template = Template.fromStack(stack);

      // Should configure environment variables for multi-database backup
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: Match.arrayWith([
          Match.objectLike({
            Environment: Match.arrayWith([
              { Name: 'DB_NAMES', Value: '["db1","db2","db3"]' },
              { Name: 'DB_USER', Value: 'backup_user' },
            ]),
          }),
        ]),
      });
    });

    test('defaults to postgres database when databaseNames not specified', () => {
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'test-backups',
        ecrRepository: repository,
        connection: {
          username: 'backup_user',
          passwordSecret: secret,
          // databaseNames not specified - should default to ['postgres']
        },
      });

      const template = Template.fromStack(stack);

      // Should default to postgres database
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: Match.arrayWith([
          Match.objectLike({
            Environment: Match.arrayWith([
              { Name: 'DB_NAMES', Value: '["postgres"]' },
            ]),
          }),
        ]),
      });
    });

    test('supports custom resource sizing', () => {
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'test-backups',
        ecrRepository: repository,
        connection: {
          username: 'backup_user',
          databaseNames: ['large_db'],
          passwordSecret: secret,
        },
        cpu: 1024,
        memoryLimitMiB: 2048,
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        Cpu: '1024',
        Memory: '2048',
      });
    });

    test('configures S3 lifecycle for retention', () => {
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'test-backups',
        ecrRepository: repository,
        connection: {
          username: 'backup_user',
          databaseNames: ['prod'],
          passwordSecret: secret,
        },
        retentionDays: 30,
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              ExpirationInDays: 30,
              Status: 'Enabled',
            }),
          ]),
        },
      });
    });

    test('sets up security groups and networking', () => {
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'test-backups',
        ecrRepository: repository,
        connection: {
          username: 'backup_user',
          databaseNames: ['prod'],
          passwordSecret: secret,
        },
      });

      const template = Template.fromStack(stack);

      // Should create security groups
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: Match.stringLikeRegexp('.*backup.*'),
      });

      // Should create ECS cluster
      template.hasResourceProperties('AWS::ECS::Cluster', Match.objectLike({}));
    });

    test('creates IAM roles with appropriate permissions', () => {
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'test-backups',
        ecrRepository: repository,
        connection: {
          username: 'backup_user',
          databaseNames: ['prod'],
          passwordSecret: secret,
        },
      });

      const template = Template.fromStack(stack);

      // Should create task execution role
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: { Service: 'ecs-tasks.amazonaws.com' },
            }),
          ]),
        },
      });

      // Should have managed policies for S3 and Secrets Manager access
      template.hasResource('AWS::IAM::ManagedPolicy', Match.objectLike({}));
    });

    test('accepts cron schedule expressions', () => {
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'test-backups',
        ecrRepository: repository,
        connection: {
          username: 'backup_user',
          databaseNames: ['prod'],
          passwordSecret: secret,
        },
        backupSchedule: scheduler.ScheduleExpression.cron({ minute: '0', hour: '5' }),
      });

      const template = Template.fromStack(stack);

      // Should create schedule with cron expression
      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        ScheduleExpression: Match.stringLikeRegexp('cron\\(0 5 .*\\)'),
        State: 'ENABLED',
      });
    });

    test('accepts cron expressions with specific weekdays', () => {
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'test-backups',
        ecrRepository: repository,
        connection: {
          username: 'backup_user',
          databaseNames: ['prod'],
          passwordSecret: secret,
        },
        backupSchedule: scheduler.ScheduleExpression.cron({ minute: '0', hour: '2', weekDay: 'SUN' }),
      });

      const template = Template.fromStack(stack);

      // Should include weekday in expression
      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        ScheduleExpression: Match.stringLikeRegexp('cron\\(0 2 .* SUN .*\\)'),
        State: 'ENABLED',
      });
    });

    test('accepts rate expressions', () => {
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'test-backups',
        ecrRepository: repository,
        connection: {
          username: 'backup_user',
          databaseNames: ['prod'],
          passwordSecret: secret,
        },
        backupSchedule: scheduler.ScheduleExpression.rate(Duration.days(1)),
      });

      const template = Template.fromStack(stack);

      // Should use rate expression
      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        ScheduleExpression: Match.stringLikeRegexp('rate\\(1 day\\)'),
        State: 'ENABLED',
      });
    });
  });

  describe('Integration Tests', () => {
    test('repository and service work together', () => {
      // Create repository
      const backupRepo = new AuroraBackupRepository(stack, 'BackupRepo', {
        repositoryName: 'integrated-backup',
      });

      const vpc = new ec2.Vpc(stack, 'TestVpc', { maxAzs: 2 });
      const cluster = rds.DatabaseCluster.fromDatabaseClusterAttributes(stack, 'TestCluster', {
        clusterIdentifier: 'integration-cluster',
        clusterEndpointAddress: 'integration.cluster.us-east-1.rds.amazonaws.com',
        port: 5432,
      });
      const secret = new secretsmanager.Secret(stack, 'TestSecret');

      // Create service using repository
      new AuroraNativeBackupService(stack, 'BackupService', {
        cluster,
        vpc,
        backupBucketName: 'integration-backups',
        ecrRepository: backupRepo.repository,
        connection: {
          username: 'backup_user',
          databaseNames: ['integration_db'],
          passwordSecret: secret,
        },
      });

      const template = Template.fromStack(stack);

      // Should create both ECR repository and ECS task
      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'integrated-backup',
      });

      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        RequiresCompatibilities: ['FARGATE'],
      });
    });
  });

  describe('Aurora Backup Repository - IAM Tests', () => {
    let repo: AuroraBackupRepository;

    beforeEach(() => {
      const iamApp = new App();
      const iamStack = new Stack(iamApp, 'IAMTestStack');
      repo = new AuroraBackupRepository(iamStack, 'TestRepo', {
        repositoryName: 'test-repo',
      });
    });

    test('grantPull method works', () => {
      const iamApp = new App();
      const iamStack = new Stack(iamApp, 'IAMTestStack1');
      const role = new iam.Role(iamStack, 'TestRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      });

      const grant = repo.grantPull(role);

      expect(grant).toBeDefined();
      expect(grant.success).toBe(true);
    });

    test('grantPush method works', () => {
      const iamApp = new App();
      const iamStack = new Stack(iamApp, 'IAMTestStack2');
      const role = new iam.Role(iamStack, 'TestRole', {
        assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      });

      const grant = repo.grantPush(role);

      expect(grant).toBeDefined();
      expect(grant.success).toBe(true);
    });

    test('grantPullPush method works', () => {
      const iamApp = new App();
      const iamStack = new Stack(iamApp, 'IAMTestStack3');
      const role = new iam.Role(iamStack, 'TestRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      });

      const grant = repo.grantPullPush(role);

      expect(grant).toBeDefined();
      expect(grant.success).toBe(true);
    });

    test('exposes repository ARN correctly', () => {
      const repositoryArn = repo.repository.repositoryArn;
      expect(repositoryArn).toBeDefined();
    });

    test('imageUri contains expected format', () => {
      expect(repo.imageUri).toContain(':latest');
      expect(repo.imageUri).toBeTruthy();
    });
  });

  describe('Aurora Backup Repository - Basic Repository Tests', () => {
    test('constructs successfully', () => {
      const simpleApp1 = new App();
      const simpleStack1 = new Stack(simpleApp1, 'SimpleTestStack1');

      // Test basic instantiation
      const repo = new AuroraBackupRepository(simpleStack1, 'TestRepo', {
        repositoryName: 'test-backup-repo',
      });

      expect(repo).toBeDefined();
      expect(repo.repository).toBeDefined();
      expect(repo.imageAsset).toBeDefined();
      expect(repo.imageUri).toBeTruthy();
    });

    test('creates ECR repository with security features', () => {
      const simpleApp2 = new App();
      const simpleStack2 = new Stack(simpleApp2, 'SimpleTestStack2');

      new AuroraBackupRepository(simpleStack2, 'TestRepo', {
        repositoryName: 'secure-repo',
      });

      const template = Template.fromStack(simpleStack2);

      // Essential security features
      template.hasResourceProperties('AWS::ECR::Repository', {
        ImageScanningConfiguration: {
          ScanOnPush: true,
        },
        ImageTagMutability: 'MUTABLE',
      });
    });

    test('works without explicit repository name', () => {
      const simpleApp3 = new App();
      const simpleStack3 = new Stack(simpleApp3, 'SimpleTestStack3');

      const repo = new AuroraBackupRepository(simpleStack3, 'TestRepo', {});

      expect(repo.repository).toBeDefined();
      expect(repo.imageUri).toContain(':latest');
    });
  });
});