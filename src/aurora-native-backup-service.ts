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
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * Configuration for database user authentication.
 */
export interface AuroraBackupUser {
  /**
   * The database username for backup operations.
   * Must exist in the Aurora cluster with appropriate permissions.
   *
   * @example 'backup_user'
   */
  readonly username: string;

  /**
   * The database name to backup.
   *
   * @default Uses the cluster's default database
   */
  readonly databaseName?: string;

  /**
   * Secrets Manager secret containing the database password.
   * Required for database authentication.
   */
  readonly passwordSecret: secretsmanager.ISecret;
}

/**
 * Configuration properties for Aurora PostgreSQL native backup service.
 */
export interface AuroraNativeBackupServiceProps {
  /**
   * The Aurora PostgreSQL cluster to backup.
   */
  readonly cluster: rds.IDatabaseCluster;

  /**
   * The VPC where the backup service will run.
   */
  readonly vpc: ec2.IVpc;

  /**
   * Optionally provide an existing S3 bucket for backup storage.
   * If not provided, one will be created.
   */
  readonly backupBucket?: s3.IBucket;

  /**
   * Name for the S3 backup bucket (only used if backupBucket is not provided).
   * If not specified, a default name will be generated.
   *
   * @default `aurora-backup-${account}-${region}`
   */
  readonly backupBucketName?: string;

  /**
   * Database user configuration for authentication.
   */
  readonly databaseUser: AuroraBackupUser;

  /**
   * Backup retention period in days.
   *
   * @default 7
   */
  readonly retentionDays?: number;

  /**
   * Backup schedule cron expression (UTC).
   *
   * @default '0 5 * * ? *' - Daily at 5:00 AM UTC
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
   * VPC subnets where the backup service should run.
   *
   * @default Private subnets with egress
   */
  readonly subnets?: ec2.SubnetSelection;

  /**
   * ECR repository containing the backup Docker image.
   * The image will be pulled using the imageUri from the AuroraBackupRepository construct.
   */
  readonly ecrRepository: ecr.IRepository;
}

/**
 * A construct for Aurora PostgreSQL native backup service.
 *
 * Creates a scheduled ECS Fargate service that performs PostgreSQL backups using pg_dump.
 * Backups are temporarily stored on EFS and sent to S3. All infrastructure resources.
 * The S3 bucket for backups can be provided or will be created automatically.
 *
 * @example
 * const backupService = new AuroraNativeBackupService(this, 'BackupService', {
 *   cluster: myAuroraCluster,
 *   vpc: vpc,
 *   databaseUser: {
 *     username: 'backup_user',
 *     databaseName: 'production',
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
  public readonly cluster: ecs.ICluster;

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
   * The S3 bucket for backup storage.
   */
  public readonly backupBucket?: s3.IBucket;

  /**
   * The EFS file system for backup storage.
   */
  public readonly fileSystem: efs.IFileSystem;

  /**
   * The EFS access point for backup storage.
   */
  public readonly accessPoint: efs.IAccessPoint;

  /**
   * The constructor for the AuroraNativeBackupService.
   * This creates a scheduled ECS Fargate service that performs PostgreSQL backups using pg_dump.
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
      backupBucket,
      backupBucketName,
      databaseUser,
      retentionDays = 7,
      backupSchedule = '0 5 * * ? *',
      cpu = 256,
      memoryLimitMiB = 512,
      subnets = { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      ecrRepository,
    } = props;

    const containerImage = ecs.ContainerImage.fromEcrRepository(ecrRepository, 'latest');

    const scheduleExpression = this.normalizeScheduleExpression(backupSchedule);

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
      throughputMode: efs.ThroughputMode.BURSTING,
      removalPolicy: RemovalPolicy.DESTROY,
      vpcSubnets: subnets,
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

    if (!backupBucket) {
      this.backupBucket = new s3.Bucket(this, 'BackupBucket', {
        bucketName: backupBucketName ?? `aurora-backup-${stack.account}-${stack.region}`,
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
    } else {
      this.backupBucket = backupBucket;
    }

    // Create CloudWatch log group
    const logGroup = new logs.LogGroup(this, 'BackupLogGroup', {
      logGroupName: `/ecs/aurora-backup/${dbCluster.clusterIdentifier}`,
      retention: logs.RetentionDays.TWO_YEARS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Prepare environment variables
    const taskEnvironment: Record<string, string> = {
      DB_HOST: dbCluster.clusterEndpoint.hostname,
      DB_PORT: dbCluster.clusterEndpoint.port.toString(),
      DB_NAME: databaseUser.databaseName ?? 'postgres',
      DB_USER: databaseUser.username,
      BACKUP_ROOT: '/mnt/aurora-backups',
      AWS_REGION: stack.region,
      S3_BUCKET: this.backupBucket.bucketName,
      S3_PREFIX: 'backups',
      CLUSTER_IDENTIFIER: dbCluster.clusterIdentifier,
    };

    const containerSecrets = {
      DB_PASSWORD: ecs.Secret.fromSecretsManager(databaseUser.passwordSecret, 'password'),
    };

    // Create scheduled task
    this.scheduledTask = new ecsPatterns.ScheduledFargateTask(this, 'BackupScheduledTask', {
      vpc,
      scheduledFargateTaskImageOptions: {
        image: containerImage,
        cpu,
        memoryLimitMiB,
        environment: taskEnvironment,
        secrets: containerSecrets,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'backup',
          logGroup,
        }),
      },
      schedule: events.Schedule.expression(scheduleExpression),
      securityGroups: [this.backupSecurityGroup],
      subnetSelection: subnets,
    });

    this.cluster = this.scheduledTask.cluster;
    this.taskDefinition = this.scheduledTask.taskDefinition;

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

    const container = this.taskDefinition.defaultContainer;
    if (container) {
      container.addMountPoints({
        containerPath: '/mnt/aurora-backups',
        sourceVolume: 'AuroraBackupData',
        readOnly: false,
      });
    }

    this.scheduledTask.node.addDependency(this.accessPoint);

    this.taskRole = this.taskDefinition.taskRole as iam.Role;

    // Grant permissions for secrets access
    databaseUser.passwordSecret.grantRead(this.taskRole);
    if (this.taskDefinition.executionRole) {
      databaseUser.passwordSecret.grantRead(this.taskDefinition.executionRole);
    }

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

    // ECR permissions for execution role (for pulling images)
    if (this.taskDefinition.executionRole) {
      const executionRole = this.taskDefinition.executionRole as iam.Role;

      // Grant ECR permissions for cross-account image pulling
      // GetAuthorizationToken must be granted on all resources
      executionRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ecr:GetAuthorizationToken'],
          resources: ['*'],
        }),
      );

      ecrRepository.grantPull(executionRole);

      executionRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['elasticfilesystem:ClientMount', 'elasticfilesystem:ClientWrite'],
          resources: [this.accessPoint.accessPointArn],
        }),
      );
    }
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
