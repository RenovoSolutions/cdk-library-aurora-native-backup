# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### AuroraBackupRepository <a name="AuroraBackupRepository" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository"></a>

A construct that creates and manages a Docker image for Aurora PostgreSQL native backups.

Creates an ECR repository and builds a Docker image containing PostgreSQL 17 client tools,
AWS CLI v2, and backup scripts. The image is designed for use with the `AuroraNativeBackupService`
construct in this same library.

*Example*

```typescript
const backupRepository = new AuroraBackupRepository(this, 'BackupRepository', {
  repositoryName: 'aurora-postgres-backup',
});

const backupService = new AuroraNativeBackupService(this, 'BackupService', {
  cluster: myAuroraCluster,
  vpc: vpc,
  backupBucketName: 'my-aurora-backups',
  ecrRepository: backupRepository.repository,
  connection: {
    username: 'backup_user',
    databaseNames: ['production'],
    passwordSecret: backupUserSecret,
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
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | The scope in which to create this Construct. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.id">id</a></code> | <code>string</code> | The Construct ID of the backup repository. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.props">props</a></code> | <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepositoryProps">AuroraBackupRepositoryProps</a></code> | The properties for the backup repository, as defined in the `AuroraBackupRepositoryProps` interface. |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

The scope in which to create this Construct.

Normally this is a stack.

---

##### `id`<sup>Required</sup> <a name="id" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.id"></a>

- *Type:* string

The Construct ID of the backup repository.

---

##### `props`<sup>Required</sup> <a name="props" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.Initializer.parameter.props"></a>

- *Type:* <a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepositoryProps">AuroraBackupRepositoryProps</a>

The properties for the backup repository, as defined in the `AuroraBackupRepositoryProps` interface.

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPull">grantPull</a></code> | Grants permissions to pull images from the ECR repository. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPullPush">grantPullPush</a></code> | Grants full permissions to the ECR repository. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.grantPush">grantPush</a></code> | Grants permissions to push images to the ECR repository. |

---

##### `toString` <a name="toString" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

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
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.imageAsset">imageAsset</a></code> | <code>aws-cdk-lib.aws_ecr_assets.DockerImageAsset</code> | The Docker image asset containing the built backup image. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.imageUri">imageUri</a></code> | <code>string</code> | The complete URI of the Docker image for ECS task definitions. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.repository">repository</a></code> | <code>aws-cdk-lib.aws_ecr.IRepository</code> | The ECR repository containing the backup Docker image. |

---

##### `node`<sup>Required</sup> <a name="node" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `imageAsset`<sup>Required</sup> <a name="imageAsset" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupRepository.property.imageAsset"></a>

```typescript
public readonly imageAsset: DockerImageAsset;
```

- *Type:* aws-cdk-lib.aws_ecr_assets.DockerImageAsset

The Docker image asset containing the built backup image.

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


### AuroraNativeBackupService <a name="AuroraNativeBackupService" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService"></a>

A construct for Aurora PostgreSQL native backup service.

Creates a scheduled ECS Fargate service that performs PostgreSQL backups using `pg_dump`.
Backups are written to EFS and then copied to S3. They are removed from EFS after the
configured `retentionDays`.
The S3 bucket for backups can be provided or will be created automatically.

*Example*

```typescript
const backupService = new AuroraNativeBackupService(this, 'BackupService', {
  cluster: dbCluster,
  vpc: vpc,
  backupBucketName: 'my-aurora-backups',
  ecrRepository: backupRepository.repository,
  connection: {
    username: 'backup_user',
    databaseNames: ['production', 'analytics', 'reporting'],
    passwordSecret: backupUserSecret,
  },
});
```


#### Initializers <a name="Initializers" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer"></a>

```typescript
import { AuroraNativeBackupService } from '@renovosolutions/cdk-library-aurora-native-backup'

new AuroraNativeBackupService(scope: Construct, id: string, props: AuroraNativeBackupServiceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | The scope in which to create this Construct. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.id">id</a></code> | <code>string</code> | The Construct ID of the backup service. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.props">props</a></code> | <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps">AuroraNativeBackupServiceProps</a></code> | The properties for the backup service, as defined in the `AuroraNativeBackupServiceProps` interface. |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

The scope in which to create this Construct.

Normally this is a stack.

---

##### `id`<sup>Required</sup> <a name="id" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.id"></a>

- *Type:* string

The Construct ID of the backup service.

---

##### `props`<sup>Required</sup> <a name="props" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.Initializer.parameter.props"></a>

- *Type:* <a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps">AuroraNativeBackupServiceProps</a>

The properties for the backup service, as defined in the `AuroraNativeBackupServiceProps` interface.

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

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
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.backupBucket">backupBucket</a></code> | <code>aws-cdk-lib.aws_s3.Bucket</code> | The S3 bucket for backup storage. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.backupSecurityGroup">backupSecurityGroup</a></code> | <code>aws-cdk-lib.aws_ec2.SecurityGroup</code> | The security group for the backup service. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.ecsCluster">ecsCluster</a></code> | <code>aws-cdk-lib.aws_ecs.ICluster</code> | The ECS cluster running the backup service. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.executionRole">executionRole</a></code> | <code>aws-cdk-lib.aws_iam.Role</code> | The IAM execution role for ECS tasks. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.fileSystem">fileSystem</a></code> | <code>aws-cdk-lib.aws_efs.IFileSystem</code> | The EFS file system for backup storage. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.scheduledTask">scheduledTask</a></code> | <code>aws-cdk-lib.aws_ecs_patterns.ScheduledFargateTask</code> | The ECS scheduled task that runs the backup process. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.taskDefinition">taskDefinition</a></code> | <code>aws-cdk-lib.aws_ecs.FargateTaskDefinition</code> | The ECS task definition for the backup container. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.taskRole">taskRole</a></code> | <code>aws-cdk-lib.aws_iam.Role</code> | The IAM role for backup tasks. |

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

##### `backupBucket`<sup>Required</sup> <a name="backupBucket" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.backupBucket"></a>

```typescript
public readonly backupBucket: Bucket;
```

- *Type:* aws-cdk-lib.aws_s3.Bucket

The S3 bucket for backup storage.

---

##### `backupSecurityGroup`<sup>Required</sup> <a name="backupSecurityGroup" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.backupSecurityGroup"></a>

```typescript
public readonly backupSecurityGroup: SecurityGroup;
```

- *Type:* aws-cdk-lib.aws_ec2.SecurityGroup

The security group for the backup service.

---

##### `ecsCluster`<sup>Required</sup> <a name="ecsCluster" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.ecsCluster"></a>

```typescript
public readonly ecsCluster: ICluster;
```

- *Type:* aws-cdk-lib.aws_ecs.ICluster

The ECS cluster running the backup service.

---

##### `executionRole`<sup>Required</sup> <a name="executionRole" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupService.property.executionRole"></a>

```typescript
public readonly executionRole: Role;
```

- *Type:* aws-cdk-lib.aws_iam.Role

The IAM execution role for ECS tasks.

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


## Structs <a name="Structs" id="Structs"></a>

### AuroraBackupConnectionProps <a name="AuroraBackupConnectionProps" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupConnectionProps"></a>

Database connection configuration for the Aurora backup service.

#### Initializer <a name="Initializer" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupConnectionProps.Initializer"></a>

```typescript
import { AuroraBackupConnectionProps } from '@renovosolutions/cdk-library-aurora-native-backup'

const auroraBackupConnectionProps: AuroraBackupConnectionProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupConnectionProps.property.passwordSecret">passwordSecret</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | Secrets Manager secret containing the database password. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupConnectionProps.property.username">username</a></code> | <code>string</code> | The database username for backup operations. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupConnectionProps.property.databaseNames">databaseNames</a></code> | <code>string[]</code> | The database names to backup. |

---

##### `passwordSecret`<sup>Required</sup> <a name="passwordSecret" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupConnectionProps.property.passwordSecret"></a>

```typescript
public readonly passwordSecret: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

Secrets Manager secret containing the database password.

Required for database authentication.

---

##### `username`<sup>Required</sup> <a name="username" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupConnectionProps.property.username"></a>

```typescript
public readonly username: string;
```

- *Type:* string

The database username for backup operations.

Must exist in the Aurora PostgreSQL database cluster with read permissions on ALL databases to be backed up.

For PostgreSQL 14+ (recommended), use the pg_read_all_data role:
- GRANT CONNECT ON DATABASE your_database TO backup_user;
- GRANT pg_read_all_data TO backup_user;

The pg_read_all_data role automatically provides SELECT on all tables/views, USAGE on schemas/sequences,
and access to future objects without additional grants.

---

*Example*

```typescript
'backup_user'
```


##### `databaseNames`<sup>Optional</sup> <a name="databaseNames" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupConnectionProps.property.databaseNames"></a>

```typescript
public readonly databaseNames: string[];
```

- *Type:* string[]
- *Default:* ['postgres'] - Uses the cluster's default database

The database names to backup.

The backup user must have appropriate permissions on all databases in this array.

---

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
- *Default:* CDK-generated name

The name of the ECR repository to create.

If not provided, CDK will generate a unique name based on the stack and construct ID.

---

### AuroraNativeBackupServiceProps <a name="AuroraNativeBackupServiceProps" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps"></a>

Infrastructure configuration properties for Aurora PostgreSQL native backup service.

#### Initializer <a name="Initializer" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.Initializer"></a>

```typescript
import { AuroraNativeBackupServiceProps } from '@renovosolutions/cdk-library-aurora-native-backup'

const auroraNativeBackupServiceProps: AuroraNativeBackupServiceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.backupBucketName">backupBucketName</a></code> | <code>string</code> | Name for the S3 backup bucket that will be created by the construct. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.cluster">cluster</a></code> | <code>aws-cdk-lib.aws_rds.IDatabaseCluster</code> | The Aurora PostgreSQL database cluster to backup. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.connection">connection</a></code> | <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupConnectionProps">AuroraBackupConnectionProps</a></code> | Database connection configuration. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.ecrRepository">ecrRepository</a></code> | <code>aws-cdk-lib.aws_ecr.IRepository</code> | ECR repository containing the backup Docker image. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | The VPC where the backup service will run. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.backupSchedule">backupSchedule</a></code> | <code>string</code> | Backup schedule in EventBridge cron expression format (UTC). |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.cpu">cpu</a></code> | <code>number</code> | Fargate task CPU units. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.memoryLimitMiB">memoryLimitMiB</a></code> | <code>number</code> | Fargate task memory in MB. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.retentionDays">retentionDays</a></code> | <code>number</code> | Backup retention period in days. |
| <code><a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.subnetSelection">subnetSelection</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Subnet selection for the backup task. |

---

##### `backupBucketName`<sup>Required</sup> <a name="backupBucketName" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.backupBucketName"></a>

```typescript
public readonly backupBucketName: string;
```

- *Type:* string

Name for the S3 backup bucket that will be created by the construct.

The bucket will be configured with appropriate settings for backup storage.

---

##### `cluster`<sup>Required</sup> <a name="cluster" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.cluster"></a>

```typescript
public readonly cluster: IDatabaseCluster;
```

- *Type:* aws-cdk-lib.aws_rds.IDatabaseCluster

The Aurora PostgreSQL database cluster to backup.

---

##### `connection`<sup>Required</sup> <a name="connection" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.connection"></a>

```typescript
public readonly connection: AuroraBackupConnectionProps;
```

- *Type:* <a href="#@renovosolutions/cdk-library-aurora-native-backup.AuroraBackupConnectionProps">AuroraBackupConnectionProps</a>

Database connection configuration.

---

##### `ecrRepository`<sup>Required</sup> <a name="ecrRepository" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.ecrRepository"></a>

```typescript
public readonly ecrRepository: IRepository;
```

- *Type:* aws-cdk-lib.aws_ecr.IRepository

ECR repository containing the backup Docker image.

The image will be pulled using the imageUri from the `AuroraBackupRepository` construct.

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

The VPC where the backup service will run.

---

##### `backupSchedule`<sup>Optional</sup> <a name="backupSchedule" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.backupSchedule"></a>

```typescript
public readonly backupSchedule: string;
```

- *Type:* string
- *Default:* '0 5 * * ? *' - Daily at 5:00 AM UTC

Backup schedule in EventBridge cron expression format (UTC).

Can be either a cron fragment (e.g., '0 5 * * ? *') or a full expression (e.g., 'cron(0 5 * * ? *)').
Also supports rate expressions (e.g., 'rate(1 day)').

> [https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html)

---

##### `cpu`<sup>Optional</sup> <a name="cpu" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.cpu"></a>

```typescript
public readonly cpu: number;
```

- *Type:* number
- *Default:* 256

Fargate task CPU units.

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

##### `subnetSelection`<sup>Optional</sup> <a name="subnetSelection" id="@renovosolutions/cdk-library-aurora-native-backup.AuroraNativeBackupServiceProps.property.subnetSelection"></a>

```typescript
public readonly subnetSelection: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } - Uses private subnets with egress

Subnet selection for the backup task.

---



