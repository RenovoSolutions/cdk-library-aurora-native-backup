import * as path from 'path';
import {
  aws_ecr as ecr,
  aws_iam as iam,
  RemovalPolicy,
  PhysicalName,
} from 'aws-cdk-lib';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecrdeploy from 'cdk-ecr-deployment';
import { Construct } from 'constructs';

/**
 * Configuration properties for the Aurora backup Docker image.
 */
export interface AuroraBackupRepositoryProps {
  /**
   * The name of the ECR repository to create.
   * If not provided, CDK will generate a unique name based on the stack and construct ID.
   *
   * @default CDK-generated name
   */
  readonly repositoryName?: string;
}

/**
 * A construct that creates and manages a Docker image for Aurora PostgreSQL native backups.
 *
 * Creates an ECR repository and builds a Docker image containing PostgreSQL 17 client tools,
 * AWS CLI v2, and backup scripts. The image is designed for use with the AuroraNativeBackupService.
 *
 * @example
 * const backupRepository = new AuroraBackupRepository(this, 'BackupRepository', {
 *   repositoryName: 'aurora-postgres-backup',
 * });
 *
 * // Then deploy the backup service (after the image is available)
 * const backupService = new AuroraNativeBackupService(this, 'BackupService', {
 *   cluster: myAuroraCluster,
 *   vpc: vpc,
 *   ecrRepository: backupRepository.repository,
 *   databaseUser: {
 *     username: 'backup_user',
 *     databaseName: 'production',
 *     passwordSecret: backupUserSecret,
 *   },
 * });
 */
export class AuroraBackupRepository extends Construct {
  /**
   * The ECR repository containing the backup Docker image.
   */
  public readonly repository: ecr.IRepository;

  /**
   * The Docker image asset containing the built backup image.
   */
  public readonly imageAsset: DockerImageAsset;

  /**
   * The complete URI of the Docker image for ECS task definitions.
   * Format: `<account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:latest`
   */
  public readonly imageUri: string;

  /**
   * The constructor for the AuroraBackupRepository.
   * This creates an ECR repository and builds a Docker image containing PostgreSQL 17 client tools,
   * AWS CLI v2, and backup scripts for Aurora PostgreSQL native backups.
   * @param scope The scope in which to create this Construct. Normally this is a stack.
   * @param id The Construct ID of the backup repository.
   * @param props The properties for the backup repository, as defined in the `AuroraBackupRepositoryProps` interface.
   */
  constructor(scope: Construct, id: string, props: AuroraBackupRepositoryProps) {
    super(scope, id);

    const { repositoryName } = props;

    this.repository = new ecr.Repository(this, 'Repository', {
      repositoryName: repositoryName ?? PhysicalName.GENERATE_IF_NEEDED,
      removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
    });

    // Build the Docker image
    this.imageAsset = new DockerImageAsset(this, 'ImageAsset', {
      directory: path.resolve(__dirname, '..', 'assets', 'aurora-backup-repository'),
      file: 'Dockerfile',
      platform: Platform.LINUX_AMD64,
      exclude: [
        '**/*.md',
        '**/node_modules',
        '**/.git',
        '**/.DS_Store',
        '**/coverage',
        '**/test-reports',
      ],
    });

    // Deploy the image with the latest tag
    new ecrdeploy.ECRDeployment(this, 'PromoteImageToRepository', {
      src: new ecrdeploy.DockerImageName(this.imageAsset.imageUri),
      dest: new ecrdeploy.DockerImageName(`${this.repository.repositoryUri}:latest`),
    });

    this.imageUri = `${this.repository.repositoryUri}:latest`;
  }

  /**
   * Grants permissions to pull images from the ECR repository.
   *
   * @param grantee The IAM principal to grant pull permissions to
   * @returns The grant object representing the permissions granted
   */
  public grantPull(grantee: iam.IPrincipal): iam.Grant {
    return this.repository.grantPull(grantee);
  }

  /**
   * Grants permissions to push images to the ECR repository.
   *
   * @param grantee The IAM principal to grant push permissions to
   * @returns The grant object representing the permissions granted
   */
  public grantPush(grantee: iam.IPrincipal): iam.Grant {
    return this.repository.grantPush(grantee);
  }

  /**
   * Grants full permissions to the ECR repository.
   *
   * @param grantee The IAM principal to grant full permissions to
   * @returns The grant object representing the permissions granted
   */
  public grantPullPush(grantee: iam.IPrincipal): iam.Grant {
    return this.repository.grantPullPush(grantee);
  }
}