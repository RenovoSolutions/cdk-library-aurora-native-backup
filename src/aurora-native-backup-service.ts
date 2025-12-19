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
      allowAllOutbound: false,
    });

    // Allow HTTPS outbound for S3 access
    this.backupSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS for S3 and AWS services',
    );

    // Allow PostgreSQL outbound to Aurora cluster
    this.backupSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL connection to Aurora cluster',
    );

    // Allow NFS outbound to EFS
    this.backupSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(2049),
      'Allow NFS connection to EFS',
    );

    const fileSystemSecurityGroup = new ec2.SecurityGroup(this, 'BackupEfsSecurityGroup', {
      securityGroupName: 'AuroraBackupEfsSG',
      vpc,
      description: 'Security group for Aurora backup EFS',
      allowAllOutbound: false,
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
          reason: 'Server access logging is not required for this backup bucket.',
        },
        {
          id: 'NIST.800.53.R5-S3BucketLoggingEnabled',
          reason: 'Server access logging is not required for this backup bucket.',
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
          actions: [
            'ecr:GetAuthorizationToken',
            'ecr:BatchCheckLayerAvailability',
            'ecr:GetDownloadUrlForLayer',
            'ecr:BatchGetImage',
          ],
          resources: ['*'],
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
          reason: 'ECR GetAuthorizationToken requires wildcard resource. Other ECR actions are scoped to repository but CDK patterns require wildcard for maximum compatibility.',
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
          actions: ['elasticfilesystem:ClientMount', 'elasticfilesystem:ClientWrite'],
          resources: [this.accessPoint.accessPointArn],
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
      taskRole: this.taskRole,
      executionRole: this.executionRole,
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
    );

    // Create scheduled task using custom task definition
    this.scheduledTask = new ecsPatterns.ScheduledFargateTask(this, 'BackupScheduledTask', {
      vpc,
      cluster,
      subnetSelection,
      scheduledFargateTaskDefinitionOptions: {
        taskDefinition: this.taskDefinition,
      },
      schedule: scheduleExpression,
      securityGroups: [this.backupSecurityGroup],
    });

    this.ecsCluster = this.scheduledTask.cluster;
    this.scheduledTask.node.addDependency(this.fileSystem.mountTargetsAvailable);

    // Suppress inline policies still auto-created by CDK even with custom roles
    // ExecutionRole gets a default policy for EFS mounting even though we provide EFS permissions
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      `/${this.node.path}/ExecutionRole/DefaultPolicy`,
      [
        {
          id: 'NIST.800.53.R5-IAMNoInlinePolicy',
          reason: 'Execution role default inline policy is auto-generated by CDK for additional ECS task execution capabilities.',
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Execution role requires wildcard permissions for ECS operations. Auto-generated by CDK.',
        },
      ],
      true,
    );

    // Suppress EventsRole inline policy (auto-generated by ScheduledFargateTask for EventBridge integration)
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      `/${this.node.path}/TaskDefinition/EventsRole/DefaultPolicy`,
      [
        {
          id: 'NIST.800.53.R5-IAMNoInlinePolicy',
          reason: 'Events role default inline policy is auto-generated by CDK for EventBridge task scheduling.',
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Events role requires wildcard permissions to invoke ECS tasks. Auto-generated by CDK.',
        },
      ],
      true,
    );

    NagSuppressions.addResourceSuppressions(
      this.scheduledTask,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'EventBridge scheduler role requires wildcard permissions to run ECS tasks in the cluster.',
        },
      ],
      true,
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
