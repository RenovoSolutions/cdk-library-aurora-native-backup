import { App, Stack, aws_ec2 as ec2, aws_ecr as ecr, aws_rds as rds, aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuroraBackupRepository, AuroraNativeBackupService } from '../src';

// Standard snapshot test for the AuroraBackupRepository construct
test('AuroraBackupRepository construct snapshot', () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack');

  new AuroraBackupRepository(stack, 'TestBackupRepository', {
    repositoryName: 'test-aurora-backup',
  });

  const template = Template.fromStack(stack).toJSON();
  expect(template).toMatchSnapshot();
});

// Snapshot test for the AuroraNativeBackupService construct
test('AuroraNativeBackupService construct snapshot', () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack');

  // Create test VPC
  const vpc = new ec2.Vpc(stack, 'TestVpc', {
    maxAzs: 2,
    natGateways: 1,
  });

  // Create test Aurora cluster
  const cluster = rds.DatabaseCluster.fromDatabaseClusterAttributes(stack, 'TestCluster', {
    clusterIdentifier: 'test-cluster',
    clusterEndpointAddress: 'test-cluster.cluster-xyz.us-east-1.rds.amazonaws.com',
    clusterResourceIdentifier: 'cluster-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    port: 5432,
  });

  // Create test secret
  const secret = new secretsmanager.Secret(stack, 'TestSecret', {
    generateSecretString: {
      secretStringTemplate: JSON.stringify({ username: 'backup_user' }),
      generateStringKey: 'password',
      excludeCharacters: '"@/\\',
    },
  });

  // Create ECR repository for testing
  const testRepository = new ecr.Repository(stack, 'TestRepository');

  // Create backup service
  new AuroraNativeBackupService(stack, 'TestBackupService', {
    cluster,
    vpc,
    ecrRepository: testRepository,
    databaseUser: {
      username: 'backup_user',
      databaseName: 'test_db',
      passwordSecret: secret,
    },
  });

  const template = Template.fromStack(stack).toJSON();
  expect(template).toMatchSnapshot();
});