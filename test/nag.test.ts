import { App, Stack, Aspects } from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { AwsSolutionsChecks, NIST80053R5Checks, NagSuppressions } from 'cdk-nag';
import { AuroraBackupRepository, AuroraNativeBackupService } from '../src';

describe('CDK Nag Checks', () => {
  describe('AuroraBackupRepository', () => {
    test('passes AWS Solutions and NIST 800-53 R5 checks', () => {
      // GIVEN
      const app = new App();
      const stack = new Stack(app, 'NagTestStackRepo');

      // WHEN
      new AuroraBackupRepository(stack, 'BackupRepo', {
        repositoryName: 'aurora-backup-nag-test',
      });

      // Apply cdk-nag aspects
      Aspects.of(stack).add(new AwsSolutionsChecks());
      Aspects.of(stack).add(new NIST80053R5Checks());

      // THEN
      const template = Template.fromStack(stack);

      // Check for cdk-nag errors
      const errors = Annotations.fromStack(stack).findError('*', Match.anyValue());
      if (errors.length > 0) {
        console.error('Error Annotations:');
        errors.forEach(error => {
          console.error(`  [${error.id}] ${error.entry.data}`);
        });
      }
      expect(errors).toHaveLength(0);
    });
  });

  describe('AuroraNativeBackupService', () => {
    test('passes AWS Solutions and NIST 800-53 R5 checks', () => {
      // GIVEN
      const app = new App();
      const stack = new Stack(app, 'NagTestStackService');

      // Create test infrastructure
      const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });

      // Suppress test VPC violations
      NagSuppressions.addResourceSuppressions(
        vpc,
        [
          {
            id: 'AwsSolutions-VPC7',
            reason: 'Test VPC does not require VPC Flow Logs - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-VPCFlowLogsEnabled',
            reason: 'Test VPC does not require VPC Flow Logs - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-VPCSubnetAutoAssignPublicIpDisabled',
            reason: 'Test VPC uses public subnets with auto-assign public IP - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-VPCNoUnrestrictedRouteToIGW',
            reason: 'Test VPC uses public subnet routes to IGW - this is test infrastructure',
          },
        ],
        true,
      );

      const cluster = new rds.DatabaseCluster(stack, 'Cluster', {
        engine: rds.DatabaseClusterEngine.auroraMysql({
          version: rds.AuroraMysqlEngineVersion.VER_3_04_0,
        }),
        writer: rds.ClusterInstance.provisioned('writer'),
        vpc,
      });

      // Suppress test RDS cluster violations
      NagSuppressions.addResourceSuppressions(
        cluster,
        [
          {
            id: 'AwsSolutions-RDS2',
            reason: 'Test RDS cluster does not require storage encryption - this is test infrastructure',
          },
          {
            id: 'AwsSolutions-RDS6',
            reason: 'Test RDS cluster does not require IAM authentication - this is test infrastructure',
          },
          {
            id: 'AwsSolutions-RDS10',
            reason: 'Test RDS cluster does not require deletion protection - this is test infrastructure',
          },
          {
            id: 'AwsSolutions-RDS11',
            reason: 'Test RDS cluster uses default port for simplicity - this is test infrastructure',
          },
          {
            id: 'AwsSolutions-RDS14',
            reason: 'Test RDS cluster is minimally configured - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-RDSInstanceDeletionProtectionEnabled',
            reason: 'Test RDS cluster does not require deletion protection - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-RDSLoggingEnabled',
            reason: 'Test RDS cluster does not require CloudWatch log exports - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-RDSEnhancedMonitoringEnabled',
            reason: 'Test RDS cluster does not require enhanced monitoring - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-RDSInBackupPlan',
            reason: 'Test RDS cluster is not enrolled in AWS Backup - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-RDSStorageEncrypted',
            reason: 'Test RDS cluster does not require storage encryption - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-RDSInstancePublicAccess',
            reason: 'Test RDS cluster instance public access configuration - this is test infrastructure',
          },
        ],
        true,
      );

      // Suppress cluster secret violations using path-based suppression
      NagSuppressions.addResourceSuppressionsByPath(
        stack,
        '/NagTestStackService/Cluster/Secret/Resource',
        [
          {
            id: 'AwsSolutions-SMG4',
            reason: 'Test secret does not require rotation - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-SecretsManagerRotationEnabled',
            reason: 'Test secret does not require rotation - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-SecretsManagerUsingKMSKey',
            reason: 'Test secret uses default encryption settings - this is test infrastructure',
          },
        ],
        false,
      );

      const secret = new secretsmanager.Secret(stack, 'Secret');

      // Suppress user secret violations
      NagSuppressions.addResourceSuppressions(
        secret,
        [
          {
            id: 'AwsSolutions-SMG4',
            reason: 'Test secret does not require rotation - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-SecretsManagerRotationEnabled',
            reason: 'Test secret does not require rotation - this is test infrastructure',
          },
          {
            id: 'NIST.800.53.R5-SecretsManagerUsingKMSKey',
            reason: 'Test secret uses default encryption settings - this is test infrastructure',
          },
        ],
        false,
      );

      const repository = new ecr.Repository(stack, 'Repo');

      // WHEN
      new AuroraNativeBackupService(stack, 'BackupService', {
        vpc,
        cluster,
        ecrRepository: repository,
        backupBucketName: 'aurora-backup-nag-test-bucket',
        connection: {
          username: 'backup_user',
          passwordSecret: secret,
        },
      });

      // Apply cdk-nag aspects
      Aspects.of(stack).add(new AwsSolutionsChecks());
      Aspects.of(stack).add(new NIST80053R5Checks());

      // THEN
      const template = Template.fromStack(stack);

      // Check for cdk-nag errors
      const errors = Annotations.fromStack(stack).findError('*', Match.anyValue());
      if (errors.length > 0) {
        console.error('Error Annotations:');
        errors.forEach(error => {
          console.error(`  [${error.id}] ${error.entry.data}`);
        });
      }
      expect(errors).toHaveLength(0);
    });
  });
});
