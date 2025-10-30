# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### AuroraBackupRepository <a name="AuroraBackupRepository" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository"></a>

A construct that creates and manages a Docker image for Aurora PostgreSQL native backups.

Creates an ECR repository and builds a Docker image containing PostgreSQL 17 client tools,
AWS CLI v2, and backup scripts. The image is designed for use with ECS Fargate.

*Example*

```typescript
const backupRepository = new AuroraBackupRepository(this, 'BackupRepository', {
  repositoryName: 'aurora-postgres-backup',
});

// Use the image in ECS
taskDefinition.addContainer('backup', {
  image: backupRepository.containerImage(),
  environment: {
    DB_HOST: cluster.clusterEndpoint.hostname,
    DB_NAME: 'myapp',
    DB_USER: 'backup_user',
  },
});
```


#### Initializers <a name="Initializers" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer"></a>

```typescript
import { AuroraBackupRepository } from '@renovosolutions/cdk-library-aurora-native-backup'

new AuroraBackupRepository(scope: Construct, id: string, props: AuroraBackupRepositoryProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.props">props</a></code> | <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepositoryProps">AuroraBackupRepositoryProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.props"></a>

- *Type:* <a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepositoryProps">AuroraBackupRepositoryProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.containerImage">containerImage</a></code> | Returns an ECS container image for the backup Docker image. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPull">grantPull</a></code> | Grants permissions to pull images from the ECR repository. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPullPush">grantPullPush</a></code> | Grants full permissions to the ECR repository. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPush">grantPush</a></code> | Grants permissions to push images to the ECR repository. |

---

##### `toString` <a name="toString" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `containerImage` <a name="containerImage" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.containerImage"></a>

```typescript
public containerImage(): ContainerImage
```

Returns an ECS container image for the backup Docker image.

##### `grantPull` <a name="grantPull" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPull"></a>

```typescript
public grantPull(grantee: IPrincipal): Grant
```

Grants permissions to pull images from the ECR repository.

###### `grantee`<sup>Required</sup> <a name="grantee" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPull.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IPrincipal

The IAM principal to grant pull permissions to.

---

##### `grantPullPush` <a name="grantPullPush" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPullPush"></a>

```typescript
public grantPullPush(grantee: IPrincipal): Grant
```

Grants full permissions to the ECR repository.

###### `grantee`<sup>Required</sup> <a name="grantee" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPullPush.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IPrincipal

The IAM principal to grant full permissions to.

---

##### `grantPush` <a name="grantPush" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPush"></a>

```typescript
public grantPush(grantee: IPrincipal): Grant
```

Grants permissions to push images to the ECR repository.

###### `grantee`<sup>Required</sup> <a name="grantee" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPush.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IPrincipal

The IAM principal to grant push permissions to.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.isConstruct"></a>

```typescript
import { AuroraBackupRepository } from '@renovosolutions/cdk-library-aurora-native-backup'

AuroraBackupRepository.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.imageUri">imageUri</a></code> | <code>string</code> | The complete URI of the Docker image for ECS task definitions. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.repository">repository</a></code> | <code>aws-cdk-lib.aws_ecr.IRepository</code> | The ECR repository containing the backup Docker image. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.imageAsset">imageAsset</a></code> | <code>aws-cdk-lib.aws_ecr_assets.DockerImageAsset</code> | The Docker image asset containing the built backup image. |

---

##### `node`<sup>Required</sup> <a name="node" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `imageUri`<sup>Required</sup> <a name="imageUri" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.imageUri"></a>

```typescript
public readonly imageUri: string;
```

- *Type:* string

The complete URI of the Docker image for ECS task definitions.

Format: `<account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:latest`

---

##### `repository`<sup>Required</sup> <a name="repository" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.repository"></a>

```typescript
public readonly repository: IRepository;
```

- *Type:* aws-cdk-lib.aws_ecr.IRepository

The ECR repository containing the backup Docker image.

---

##### `imageAsset`<sup>Optional</sup> <a name="imageAsset" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.imageAsset"></a>

```typescript
public readonly imageAsset: DockerImageAsset;
```

- *Type:* aws-cdk-lib.aws_ecr_assets.DockerImageAsset

The Docker image asset containing the built backup image.

---


### AuroraNativeBackupService <a name="AuroraNativeBackupService" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService"></a>

A construct for Aurora PostgreSQL native backup service.

Creates a scheduled ECS Fargate service that performs PostgreSQL backups using pg_dump.
Backups are stored on EFS and optionally synced to S3.

*Example*

```typescript
const backupService = new AuroraNativeBackupService(this, 'BackupService', {
  cluster: myAuroraCluster,
  vpc: vpc,
  backupBucket: backupBucket,
  databaseUser: {
    username: 'backup_user',
    databaseName: 'production',
    passwordSecret: backupUserSecret,
  },
  containerImage: ecs.ContainerImage.fromRegistry('my-backup-image:latest'),
});
```


#### Initializers <a name="Initializers" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer"></a>

```typescript
import { AuroraNativeBackupService } from '@renovosolutions/cdk-library-aurora-native-backup'

new AuroraNativeBackupService(scope: Construct, id: string, props: AuroraNativeBackupServiceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.props">props</a></code> | <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps">AuroraNativeBackupServiceProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.props"></a>

- *Type:* <a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps">AuroraNativeBackupServiceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.grantS3Access">grantS3Access</a></code> | Grants additional S3 permissions to the task role if needed. |

---

##### `toString` <a name="toString" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `grantS3Access` <a name="grantS3Access" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.grantS3Access"></a>

```typescript
public grantS3Access(bucket: IBucket, prefix?: string): void
```

Grants additional S3 permissions to the task role if needed.

###### `bucket`<sup>Required</sup> <a name="bucket" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.grantS3Access.parameter.bucket"></a>

- *Type:* aws-cdk-lib.aws_s3.IBucket

---

###### `prefix`<sup>Optional</sup> <a name="prefix" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.grantS3Access.parameter.prefix"></a>

- *Type:* string

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.isConstruct"></a>

```typescript
import { AuroraNativeBackupService } from '@renovosolutions/cdk-library-aurora-native-backup'

AuroraNativeBackupService.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.accessPoint">accessPoint</a></code> | <code>aws-cdk-lib.aws_efs.IAccessPoint</code> | The EFS access point for backup storage. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.cluster">cluster</a></code> | <code>aws-cdk-lib.aws_ecs.ICluster</code> | The ECS cluster running the backup service. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.efsMountPath">efsMountPath</a></code> | <code>string</code> | The EFS mount path inside the container. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.fileSystem">fileSystem</a></code> | <code>aws-cdk-lib.aws_efs.IFileSystem</code> | The EFS file system for backup storage. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.scheduledTask">scheduledTask</a></code> | <code>aws-cdk-lib.aws_ecs_patterns.ScheduledFargateTask</code> | The ECS scheduled task that runs the backup process. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.securityGroup">securityGroup</a></code> | <code>aws-cdk-lib.aws_ec2.SecurityGroup</code> | The security group for the backup service. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.taskDefinition">taskDefinition</a></code> | <code>aws-cdk-lib.aws_ecs.FargateTaskDefinition</code> | The ECS task definition for the backup container. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.taskRole">taskRole</a></code> | <code>aws-cdk-lib.aws_iam.Role</code> | The IAM role for backup tasks. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.backupBucket">backupBucket</a></code> | <code>aws-cdk-lib.aws_s3.IBucket</code> | The S3 bucket for backup storage. |

---

##### `node`<sup>Required</sup> <a name="node" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `accessPoint`<sup>Required</sup> <a name="accessPoint" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.accessPoint"></a>

```typescript
public readonly accessPoint: IAccessPoint;
```

- *Type:* aws-cdk-lib.aws_efs.IAccessPoint

The EFS access point for backup storage.

---

##### `cluster`<sup>Required</sup> <a name="cluster" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.cluster"></a>

```typescript
public readonly cluster: ICluster;
```

- *Type:* aws-cdk-lib.aws_ecs.ICluster

The ECS cluster running the backup service.

---

##### `efsMountPath`<sup>Required</sup> <a name="efsMountPath" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.efsMountPath"></a>

```typescript
public readonly efsMountPath: string;
```

- *Type:* string

The EFS mount path inside the container.

---

##### `fileSystem`<sup>Required</sup> <a name="fileSystem" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.fileSystem"></a>

```typescript
public readonly fileSystem: IFileSystem;
```

- *Type:* aws-cdk-lib.aws_efs.IFileSystem

The EFS file system for backup storage.

---

##### `scheduledTask`<sup>Required</sup> <a name="scheduledTask" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.scheduledTask"></a>

```typescript
public readonly scheduledTask: ScheduledFargateTask;
```

- *Type:* aws-cdk-lib.aws_ecs_patterns.ScheduledFargateTask

The ECS scheduled task that runs the backup process.

---

##### `securityGroup`<sup>Required</sup> <a name="securityGroup" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.securityGroup"></a>

```typescript
public readonly securityGroup: SecurityGroup;
```

- *Type:* aws-cdk-lib.aws_ec2.SecurityGroup

The security group for the backup service.

---

##### `taskDefinition`<sup>Required</sup> <a name="taskDefinition" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.taskDefinition"></a>

```typescript
public readonly taskDefinition: FargateTaskDefinition;
```

- *Type:* aws-cdk-lib.aws_ecs.FargateTaskDefinition

The ECS task definition for the backup container.

---

##### `taskRole`<sup>Required</sup> <a name="taskRole" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.taskRole"></a>

```typescript
public readonly taskRole: Role;
```

- *Type:* aws-cdk-lib.aws_iam.Role

The IAM role for backup tasks.

---

##### `backupBucket`<sup>Optional</sup> <a name="backupBucket" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.backupBucket"></a>

```typescript
public readonly backupBucket: IBucket;
```

- *Type:* aws-cdk-lib.aws_s3.IBucket

The S3 bucket for backup storage.

---


## Structs <a name="Structs" id="Structs"></a>

### AuroraBackupRepositoryProps <a name="AuroraBackupRepositoryProps" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepositoryProps"></a>

Configuration properties for the Aurora backup Docker image.

#### Initializer <a name="Initializer" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepositoryProps.Initializer"></a>

```typescript
import { AuroraBackupRepositoryProps } from '@renovosolutions/cdk-library-aurora-native-backup'

const auroraBackupRepositoryProps: AuroraBackupRepositoryProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepositoryProps.property.repositoryName">repositoryName</a></code> | <code>string</code> | The name of the ECR repository to create. |

---

##### `repositoryName`<sup>Optional</sup> <a name="repositoryName" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepositoryProps.property.repositoryName"></a>

```typescript
public readonly repositoryName: string;
```

- *Type:* string
- *Default:* CloudFormation-generated name

The name of the ECR repository to create.

If not provided, CDK will generate a unique name based on the stack and construct ID.

---

### AuroraBackupUser <a name="AuroraBackupUser" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupUser"></a>

Configuration for database user authentication.

#### Initializer <a name="Initializer" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupUser.Initializer"></a>

```typescript
import { AuroraBackupUser } from '@renovosolutions/cdk-library-aurora-native-backup'

const auroraBackupUser: AuroraBackupUser = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupUser.property.username">username</a></code> | <code>string</code> | The database username for backup operations. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupUser.property.databaseName">databaseName</a></code> | <code>string</code> | The database name to backup. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupUser.property.passwordSecret">passwordSecret</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | Secrets Manager secret containing the database password. |

---

##### `username`<sup>Required</sup> <a name="username" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupUser.property.username"></a>

```typescript
public readonly username: string;
```

- *Type:* string

The database username for backup operations.

Must exist in the Aurora cluster with appropriate permissions.

---

*Example*

```typescript
'backup_user'
```


##### `databaseName`<sup>Optional</sup> <a name="databaseName" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupUser.property.databaseName"></a>

```typescript
public readonly databaseName: string;
```

- *Type:* string
- *Default:* Uses the cluster's default database

The database name to backup.

---

##### `passwordSecret`<sup>Optional</sup> <a name="passwordSecret" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupUser.property.passwordSecret"></a>

```typescript
public readonly passwordSecret: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

Secrets Manager secret containing the database password.

If not provided, IAM database authentication will be used.

---

### AuroraNativeBackupServiceProps <a name="AuroraNativeBackupServiceProps" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps"></a>

Configuration properties for Aurora PostgreSQL native backup service.

#### Initializer <a name="Initializer" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.Initializer"></a>

```typescript
import { AuroraNativeBackupServiceProps } from '@renovosolutions/cdk-library-aurora-native-backup'

const auroraNativeBackupServiceProps: AuroraNativeBackupServiceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.cluster">cluster</a></code> | <code>aws-cdk-lib.aws_rds.IDatabaseCluster</code> | The Aurora PostgreSQL cluster to backup. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.containerImage">containerImage</a></code> | <code>aws-cdk-lib.aws_ecs.ContainerImage</code> | Container image for backup operations. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.databaseUser">databaseUser</a></code> | <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupUser">AuroraBackupUser</a></code> | Database user configuration for authentication. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | The VPC where the backup service will run. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.accessPoint">accessPoint</a></code> | <code>aws-cdk-lib.aws_efs.IAccessPoint</code> | Existing EFS access point for backup storage. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.backupBucket">backupBucket</a></code> | <code>aws-cdk-lib.aws_s3.IBucket</code> | S3 bucket for backup storage. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.backupSchedule">backupSchedule</a></code> | <code>string</code> | Backup schedule cron expression (UTC). |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.cpu">cpu</a></code> | <code>number</code> | Fargate task CPU units. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.efsMountPath">efsMountPath</a></code> | <code>string</code> | EFS mount path inside the container. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.fileSystem">fileSystem</a></code> | <code>aws-cdk-lib.aws_efs.IFileSystem</code> | Existing EFS file system for backup storage. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.memoryLimitMiB">memoryLimitMiB</a></code> | <code>number</code> | Fargate task memory in MB. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.retentionDays">retentionDays</a></code> | <code>number</code> | Backup retention period in days. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.securityGroups">securityGroups</a></code> | <code>aws-cdk-lib.aws_ec2.ISecurityGroup[]</code> | Custom security groups for the backup service. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.subnets">subnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | VPC subnets where the backup service should run. |

---

##### `cluster`<sup>Required</sup> <a name="cluster" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.cluster"></a>

```typescript
public readonly cluster: IDatabaseCluster;
```

- *Type:* aws-cdk-lib.aws_rds.IDatabaseCluster

The Aurora PostgreSQL cluster to backup.

---

##### `containerImage`<sup>Required</sup> <a name="containerImage" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.containerImage"></a>

```typescript
public readonly containerImage: ContainerImage;
```

- *Type:* aws-cdk-lib.aws_ecs.ContainerImage

Container image for backup operations.

---

##### `databaseUser`<sup>Required</sup> <a name="databaseUser" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.databaseUser"></a>

```typescript
public readonly databaseUser: AuroraBackupUser;
```

- *Type:* <a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupUser">AuroraBackupUser</a>

Database user configuration for authentication.

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

The VPC where the backup service will run.

---

##### `accessPoint`<sup>Optional</sup> <a name="accessPoint" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.accessPoint"></a>

```typescript
public readonly accessPoint: IAccessPoint;
```

- *Type:* aws-cdk-lib.aws_efs.IAccessPoint

Existing EFS access point for backup storage.

If provided, fileSystem must also be provided.

---

##### `backupBucket`<sup>Optional</sup> <a name="backupBucket" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.backupBucket"></a>

```typescript
public readonly backupBucket: IBucket;
```

- *Type:* aws-cdk-lib.aws_s3.IBucket

S3 bucket for backup storage.

If not provided, backups will only be stored on EFS.

---

##### `backupSchedule`<sup>Optional</sup> <a name="backupSchedule" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.backupSchedule"></a>

```typescript
public readonly backupSchedule: string;
```

- *Type:* string
- *Default:* '0 5 * * ? *' - Daily at 5:00 AM UTC

Backup schedule cron expression (UTC).

---

##### `cpu`<sup>Optional</sup> <a name="cpu" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.cpu"></a>

```typescript
public readonly cpu: number;
```

- *Type:* number
- *Default:* 256

Fargate task CPU units.

---

##### `efsMountPath`<sup>Optional</sup> <a name="efsMountPath" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.efsMountPath"></a>

```typescript
public readonly efsMountPath: string;
```

- *Type:* string
- *Default:* '/mnt/aurora-backups'

EFS mount path inside the container.

---

##### `fileSystem`<sup>Optional</sup> <a name="fileSystem" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.fileSystem"></a>

```typescript
public readonly fileSystem: IFileSystem;
```

- *Type:* aws-cdk-lib.aws_efs.IFileSystem

Existing EFS file system for backup storage.

If provided, accessPoint must also be provided.

---

##### `memoryLimitMiB`<sup>Optional</sup> <a name="memoryLimitMiB" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.memoryLimitMiB"></a>

```typescript
public readonly memoryLimitMiB: number;
```

- *Type:* number
- *Default:* 512

Fargate task memory in MB.

---

##### `retentionDays`<sup>Optional</sup> <a name="retentionDays" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.retentionDays"></a>

```typescript
public readonly retentionDays: number;
```

- *Type:* number
- *Default:* 7

Backup retention period in days.

---

##### `securityGroups`<sup>Optional</sup> <a name="securityGroups" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.securityGroups"></a>

```typescript
public readonly securityGroups: ISecurityGroup[];
```

- *Type:* aws-cdk-lib.aws_ec2.ISecurityGroup[]

Custom security groups for the backup service.

---

##### `subnets`<sup>Optional</sup> <a name="subnets" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.subnets"></a>

```typescript
public readonly subnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* Private subnets with egress

VPC subnets where the backup service should run.

---



