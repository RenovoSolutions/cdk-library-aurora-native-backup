# cdk-library-aurora-native-backup

A CDK construct library that creates and manages Docker images for Aurora PostgreSQL native backups using `pg_dump`. 
The resulting images are designed for use with Amazon ECS Fargate for scalable, serverless backup operations.


## Features

- **Pre-built Docker Image**: Amazon Linux 2023 base with PostgreSQL 17 client tools and AWS CLI v2
- **ECR Repository Management**: Automatically creates and manages ECR repositories with security best practices
- **Complete Backup Service**: Ready-to-use ECS Fargate service for scheduled Aurora backups
- **EFS and S3 Support**: Built-in support for backing up to EFS with S3 sync
- **Comprehensive Backup**: Uses `pg_dump` directory format with maximum compression for efficient storage
- **Production Ready**: Includes proper error handling, logging, and cleanup mechanisms
- **Secure Authentication**: Uses AWS Secrets Manager for database password management

## API Doc

See [API](API.md)

## Shortcomings

- The backup service currently only supports password-based authentication with Secrets Manager
- The backup container runs as a scheduled task, not continuously, so it cannot capture incremental changes
- Custom backup scripts are not currently supported, only the built-in pg_dump functionality

## License

This project is licensed under the Apache License, Version 2.0 - see the [LICENSE](LICENSE) file for details.

## Examples

This construct requires some dependencies to instantiate:

- A stack with a definite environment (account and region)
- A VPC where the backup service will run
- An Aurora PostgreSQL cluster to backup
- A Secrets Manager secret containing database credentials


### Complete Backup Service (Recommended)

For most use cases, use the `AuroraNativeBackupService` which provides a complete, ready-to-use backup solution:

#### TypeScript
```typescript
import { Stack, StackProps, aws_ec2 as ec2, aws_rds as rds, aws_s3 as s3, aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AuroraNativeBackupService, AuroraBackupRepository } from '@renovosolutions/cdk-library-aurora-native-backup';

export class BackupServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Your existing Aurora cluster and VPC
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { isDefault: true });
    const cluster = rds.DatabaseCluster.fromDatabaseClusterAttributes(this, 'Cluster', {
      clusterIdentifier: 'my-production-cluster',
      clusterEndpointAddress: 'cluster.xyz.region.rds.amazonaws.com',
      port: 5432,
    });

    // S3 bucket for backup storage
    const backupBucket = new s3.Bucket(this, 'BackupBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    // First create the backup repository
    const backupRepository = new AuroraBackupRepository(this, 'BackupRepository', {
      repositoryName: 'aurora-postgres-backup',
    });

    // Create the complete backup service
    const backupService = new AuroraNativeBackupService(this, 'BackupService', {
      cluster,
      vpc,
      backupBucket,
      ecrRepository: backupRepository.repository,
      databaseUser: {
        username: 'backup_user',
        databaseName: 'production',
      },
      retentionDays: 30,
      backupSchedule: '0 2 * * *', // Daily at 2 AM UTC
      cpu: 1024,
      memoryLimitMiB: 2048,
    });
  }
}
```

#### Python
```python
from aws_cdk import (
  Stack,
  aws_ec2 as ec2,
  aws_rds as rds,
  aws_s3 as s3
)
from constructs import Construct
from cdk_library_aurora_native_backup import AuroraNativeBackupService, AuroraBackupRepository

class BackupServiceStack(Stack):
  def __init__(self, scope: Construct, id: str, **kwargs):
    super().__init__(scope, id, **kwargs)

    # Your existing Aurora cluster and VPC
    vpc = ec2.Vpc.from_lookup(self, "Vpc", is_default=True)
    cluster = rds.DatabaseCluster.from_database_cluster_attributes(self, "Cluster",
      cluster_identifier="my-production-cluster",
      cluster_endpoint_address="cluster.xyz.region.rds.amazonaws.com",
      port=5432
    )

    # S3 bucket for backup storage
    backup_bucket = s3.Bucket(self, "BackupBucket",
      encryption=s3.BucketEncryption.S3_MANAGED,
      versioned=True
    )

    # First create the backup repository
    backup_repository = AuroraBackupRepository(self, "BackupRepository",
      repository_name="aurora-postgres-backup"
    )

    # Create the complete backup service
    backup_service = AuroraNativeBackupService(self, "BackupService",
      cluster=cluster,
      vpc=vpc,
      backup_bucket=backup_bucket,
      ecr_repository=backup_repository.repository,
      database_user={
        "username": "backup_user",
        "database_name": "production"
        # password_secret will be created and managed by the construct
      },
      retention_days=30,
      backup_schedule="0 2 * * *",  # Daily at 2 AM UTC
      cpu=1024,
      memory_limit_mi_b=2048
    )

    # Access the generated secret if needed:
    # backup_user_secret = backup_service.backup_user_secret
```



## Environment Variables

The backup container requires these environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_HOST` | Aurora cluster endpoint | ✅ |
| `DB_NAME` | Database name to backup | ✅ |
| `DB_USER` | Database username | ✅ |
| `DB_PASSWORD` | Database password | ✅ |
| `AWS_REGION` | AWS region | ✅ |
| `DB_PORT` | Database port (default: 5432) | ❌ |
| `BACKUP_ROOT` | Backup directory (default: /mnt/aurora-backups) | ❌ |
| `S3_BUCKET` | S3 bucket for backup sync | ✅ |
| `S3_PREFIX` | S3 prefix (default: backups) | ❌ |
| `CLUSTER_IDENTIFIER` | Cluster ID for S3 organization (**required**) | ✅ |

## Backup Process

1. **Validation**: Checks AWS credentials and creates backup directories
2. **Database Backup**: Uses `pg_dump --format=directory` with maximum compression
3. **Verification**: Validates backup contains `toc.dat` file
4. **S3 Sync**: Syncs backup to S3 bucket (required)
5. **Cleanup**: Removes local backup after successful S3 sync

## Security Considerations

- ECR repositories created with image scanning enabled
- EFS encryption in transit supported
- IAM permissions follow principle of least privilege
- Use AWS Secrets Manager for database passwords in production
- Consider VPC endpoints for S3 to avoid internet traffic

## Backup Storage Structure

```
/mnt/aurora-backups/
└── YYYY-MM-DD/
    ├── toc.dat                 # PostgreSQL table of contents
    ├── ####.dat.gz            # Compressed table data files
    └── ####.dat.gz            # Additional data files
```

S3 structure:
```
s3://my-backup-bucket/
└── backups/
    └── {CLUSTER_IDENTIFIER}/
        └── YYYY-MM-DD/
            ├── toc.dat
            └── ####.dat.gz
```

## Restoration

Use `pg_restore` with the backup directory:

```bash
# Full database restore
pg_restore -h target-host -U username -d target_db -v -C /path/to/backup/directory/

# List backup contents
pg_restore --list /path/to/backup/directory/

# Selective table restore
pg_restore -h target-host -U username -d target_db -v -t table_name /path/to/backup/directory/
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our GitHub repository.

## License

This project is licensed under the Apache License, Version 2.0 - see the [LICENSE](LICENSE) file for details.
