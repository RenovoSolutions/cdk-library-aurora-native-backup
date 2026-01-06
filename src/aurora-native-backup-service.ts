import {
  Stack,
  Duration,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_efs as efs,
  aws_iam as iam,
  aws_logs as logs,
  aws_rds as rds,
  aws_s3 as s3,
  aws_scheduler as scheduler,
  aws_scheduler_targets as scheduler_targets,
  aws_secretsmanager as secretsmanager,
  RemovalPolicy,
  Tags,
} from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
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
   * Must implement IConnectable for security group configuration.
   */
  readonly cluster: rds.IDatabaseCluster & ec2.IConnectable;

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
   * Backup schedule using EventBridge Scheduler ScheduleExpression.
   *
   * Use scheduler.ScheduleExpression.cron() or scheduler.ScheduleExpression.rate() to define the schedule.
   *
   * @default scheduler.ScheduleExpression.cron({ minute: '0', hour: '5' }) - Daily at 5:00 AM UTC
   *
   * @example
   * // Daily at 3 AM UTC
   * backupSchedule: scheduler.ScheduleExpression.cron({ minute: '0', hour: '3' })
   *
   * @example
   * // Every 12 hours
   * backupSchedule: scheduler.ScheduleExpression.rate(Duration.hours(12))
   *
   * @example
   * // Weekly on Sundays at 2 AM UTC
   * backupSchedule: scheduler.ScheduleExpression.cron({ minute: '0', hour: '2', weekDay: 'SUN' })
   *
   * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
   */
  readonly backupSchedule?: scheduler.ScheduleExpression;

  /**
   * The time window during which the scheduled task is allowed to be invoked.
   * This is passed to the EventBridge Scheduler `Schedule` as `timeWindow`.
   *
   * @default scheduler.TimeWindow.flexible(Duration.minutes(60))
   */
  readonly scheduleTimeWindow?: scheduler.TimeWindow;

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
   * The EventBridge schedule that triggers the backup task.
   */
  public readonly schedule: scheduler.Schedule;

  /**
   * The IAM role for the EventBridge Scheduler.
   */
  public readonly schedulerRole: iam.Role;

  /**
   * The ECS cluster running the backup service.
   */
  public readonly ecsCluster: ecs.Cluster;

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
      backupSchedule = scheduler.ScheduleExpression.cron({ minute: '0', hour: '5' }),
      cpu = 256,
      memoryLimitMiB = 512,
      ecrRepository,
      subnetSelection = { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    } = props;

    // Generate schedule name and truncate to 64 characters (AWS EventBridge Scheduler limit)
    const scheduleName = `backup-${dbCluster.clusterIdentifier}`.substring(0, 64);

    const containerImage = ecs.ContainerImage.fromEcrRepository(ecrRepository, 'latest');

    this.backupSecurityGroup = new ec2.SecurityGroup(this, 'BackupSecurityGroup', {
      securityGroupName: 'AuroraBackupServiceSG',
      vpc,
      description: 'Security group for Aurora backup service',
      allowAllOutbound: false,
    });

    // Allow HTTPS outbound for S3 access
    this.backupSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS for S3 and AWS services (IPv4)',
    );
    this.backupSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(443),
      'Allow HTTPS for S3 and AWS services (IPv6)',
    );

    // Allow PostgreSQL outbound to Aurora cluster using connections API
    this.backupSecurityGroup.connections.allowTo(
      dbCluster,
      ec2.Port.tcp(5432),
      'Allow backup service to connect to Aurora cluster',
    );

    // NFS access to EFS: will be allowed after EFS Security Group is created below using `connections.allowTo`.

    const fileSystemSecurityGroup = new ec2.SecurityGroup(this, 'BackupEfsSecurityGroup', {
      securityGroupName: 'AuroraBackupEfsSG',
      vpc,
      description: 'Security group for Aurora backup EFS',
      allowAllOutbound: false,
    });

    const fileSystem = new efs.FileSystem(this, 'BackupFileSystem', {
      vpc,
      securityGroup: fileSystemSecurityGroup,
      encrypted: true,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.ELASTIC,
      removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
    });
    // Allow NFS access from backup task security group to the EFS security group
    this.backupSecurityGroup.connections.allowTo(
      fileSystemSecurityGroup,
      ec2.Port.tcp(2049),
      'Allow NFS access to EFS',
    );
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
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'DeleteOldBackups',
          enabled: true,
          expiration: Duration.days(retentionDays),
        },
      ],
    });

    // Suppress S3 Nag checks
    NagSuppressions.addResourceSuppressions(
      this.backupBucket,
      [
        {
          id: 'AwsSolutions-S1',
          reason: 'Server access logging will be configured by the consumer of this library and cannot be enforced here.',
        },
        {
          id: 'NIST.800.53.R5-S3BucketLoggingEnabled',
          reason: 'Server access logging will be configured by the consumer of this library and cannot be enforced here.',
        },
        {
          id: 'NIST.800.53.R5-S3DefaultEncryptionKMS',
          reason: 'According to Renovo encryption policy, default S3 encryption is sufficient for backup bucket.',
        },
        {
          id: 'NIST.800.53.R5-S3BucketVersioningEnabled',
          reason: 'Versioning is not required for backup bucket.',
        },
        {
          id: 'NIST.800.53.R5-S3BucketReplicationEnabled',
          reason: 'Replication is not required for backup bucket.',
        },
      ],
      true,
    );
    // Tag the backup bucket for discovery by restore CLI
    Tags.of(this.backupBucket).add('aurora_native_backup_bucket', 'true');

    // Create CloudWatch log group
    const logGroup = new logs.LogGroup(this, 'BackupLogGroup', {
      logGroupName: `/ecs/aurora-backup/${dbCluster.clusterIdentifier}`,
      retention: logs.RetentionDays.TWO_YEARS,
      removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
    });

    // Suppress CloudWatch Logs encryption - using default AWS managed key
    NagSuppressions.addResourceSuppressions(
      logGroup,
      [
        {
          id: 'NIST.800.53.R5-CloudWatchLogGroupEncrypted',
          reason: 'According to Renovo encryption policy, default CloudWatch Logs encryption with AWS managed keys is sufficient.',
        },
      ],
      false,
    );

    NagSuppressions.addResourceSuppressions(
      this.fileSystem,
      [
        {
          id: 'NIST.800.53.R5-EFSInBackupPlan',
          reason: 'EFS is just a temporary storage for backups before they are copied to S3;',
        },
      ],
      true,
    );

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

    // Create custom execution role with managed policies
    this.executionRole = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'ECS task execution role for Aurora backup service',
    });

    // Create managed policy for ECS task execution (ECR pull, CloudWatch logs, Secrets Manager)
    const executionRolePolicy = new iam.ManagedPolicy(this, 'ExecutionRolePolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ecr:GetAuthorizationToken'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:GetDownloadUrlForLayer',
            'ecr:BatchGetImage',
          ],
          resources: [ecrRepository.repositoryArn],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          resources: [logGroup.logGroupArn],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
          ],
          resources: [connection.passwordSecret.secretArn],
        }),
      ],
    });
    NagSuppressions.addResourceSuppressions(
      executionRolePolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'ecr:GetAuthorizationToken is a global action that requires wildcard resource per AWS API requirements.',
        },
      ],
      true,
    );
    this.executionRole.addManagedPolicy(executionRolePolicy);

    // Create managed policy for execution role EFS access
    const executionRoleEfsPolicy = new iam.ManagedPolicy(this, 'ExecutionRoleEfsPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['elasticfilesystem:ClientRootAccess'],
          resources: [this.fileSystem.fileSystemArn],
        }),
      ],
    });
    this.executionRole.addManagedPolicy(executionRoleEfsPolicy);

    // Create custom task role with managed policies
    this.taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'ECS task role for Aurora backup service',
    });

    // Create managed policy for S3 backup storage access
    const s3BackupPolicy = new iam.ManagedPolicy(this, 'S3BackupPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:PutObject',
            's3:GetObject',
            's3:DeleteObject',
            's3:ListBucket',
            's3:GetBucketLocation',
            's3:AbortMultipartUpload',
            's3:ListMultipartUploadParts',
            's3:ListBucketMultipartUploads',
          ],
          resources: [
            this.backupBucket.bucketArn,
            `${this.backupBucket.bucketArn}/*`,
          ],
        }),
      ],
    });
    NagSuppressions.addResourceSuppressions(
      s3BackupPolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'S3 managed policy uses wildcard on specific bucket and objects path to allow necessary S3 operations for backup storage.',
        },
      ],
      true,
    );
    this.taskRole.addManagedPolicy(s3BackupPolicy);

    // Create managed policy for task role EFS access
    const taskRoleEfsPolicy = new iam.ManagedPolicy(this, 'TaskRoleEfsPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['elasticfilesystem:ClientWrite'],
          resources: [this.accessPoint.accessPointArn],
        }),
      ],
    });
    this.taskRole.addManagedPolicy(taskRoleEfsPolicy);

    const cluster = new ecs.Cluster(this, 'BackupCluster', {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENHANCED,
    });

    // Create custom task definition with custom roles and EFS volume
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      cpu,
      memoryLimitMiB,
      taskRole: this.taskRole.withoutPolicyUpdates(),
      executionRole: this.executionRole.withoutPolicyUpdates(),
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      volumes: [
        {
          name: 'AuroraBackupData',
          efsVolumeConfiguration: {
            fileSystemId: this.fileSystem.fileSystemId,
            transitEncryption: 'ENABLED',
            authorizationConfig: {
              accessPointId: this.accessPoint.accessPointId,
              iam: 'ENABLED',
            },
          },
        },
      ],
    });

    // Add container to the task definition
    const container = this.taskDefinition.addContainer('BackupContainer', {
      image: containerImage,
      environment: taskEnvironment,
      secrets: containerSecrets,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'backup',
        logGroup,
      }),
    });

    // Add mount points to the container
    container.addMountPoints({
      containerPath: '/mnt/aurora-backups',
      sourceVolume: 'AuroraBackupData',
      readOnly: false,
    });

    // Suppress environment variable warning - only non-sensitive config is in env vars
    NagSuppressions.addResourceSuppressions(
      this.taskDefinition,
      [
        {
          id: 'AwsSolutions-ECS2',
          reason: 'Environment variables contain only non-sensitive configuration data (database host, port, bucket names). Sensitive credentials (DB_PASSWORD) are stored in AWS Secrets Manager and injected as ECS secrets.',
        },
      ],
      false,
    );

    this.ecsCluster = cluster;

    // Create scheduler policy for running ECS tasks
    const schedulerPolicy = new iam.ManagedPolicy(this, 'SchedulerPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ecs:RunTask'],
          resources: [this.taskDefinition.taskDefinitionArn],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['iam:PassRole'],
          resources: [this.taskRole.roleArn, this.executionRole.roleArn],
          conditions: {
            StringEquals: {
              'iam:PassedToService': 'ecs-tasks.amazonaws.com',
            },
          },
        }),
      ],
    });

    this.schedulerRole = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
      description: 'IAM role for Scheduler to run Aurora backup Fargate task',
    });
    this.schedulerRole.addManagedPolicy(schedulerPolicy);

    this.schedule = new scheduler.Schedule(this, 'BackupSchedule', {
      schedule: backupSchedule,
      timeWindow: props.scheduleTimeWindow ?? scheduler.TimeWindow.flexible(Duration.minutes(60)),
      scheduleName: scheduleName,
      description: `Daily backup schedule for Aurora cluster ${dbCluster.clusterIdentifier}`,
      target: new scheduler_targets.EcsRunFargateTask(cluster, {
        taskDefinition: this.taskDefinition,
        platformVersion: ecs.FargatePlatformVersion.LATEST,
        role: this.schedulerRole.withoutPolicyUpdates(),
        securityGroups: [this.backupSecurityGroup],
        vpcSubnets: subnetSelection,
      }),
    });

    this.schedule.node.addDependency(this.fileSystem.mountTargetsAvailable);
  }
}
