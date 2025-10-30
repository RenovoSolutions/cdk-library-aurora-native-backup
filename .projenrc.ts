import { awscdk, javascript } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Renovo Solutions',
  authorAddress: 'webmaster+cdk@renovo1.com',
  cdkVersion: '2.220.0',
  defaultReleaseBranch: 'master',
  jsiiVersion: '~5.8.0',
  name: '@renovosolutions/cdk-library-aurora-native-backup',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/RenovoSolutions/cdk-library-aurora-native-backup.git',
  description: 'AWS CDK construct library for Aurora backup and restore using ECS on a schedule, storing backups in S3.',
  keywords: [
    'cdk',
    'aws-cdk',
    'aws-cdk-construct',
    'aurora',
    'serverless',
    'backup',
    'projen',
  ],
  deps: [
    'cdk-ecr-deployment',
  ],
  peerDeps: [
    'constructs',
    'aws-cdk-lib',
  ],
  depsUpgrade: true,
  depsUpgradeOptions: {
    workflow: false,
    exclude: ['projen'],
  },
  devDeps: [
    '@types/jest',
    'constructs',
    'aws-cdk-lib',
  ],
  gitignore: [
    'test/read*',
  ],
  githubOptions: {
    mergify: false,
    pullRequestLintOptions: {
      semanticTitle: false,
    },
  },
  stale: false,
  releaseToNpm: true,
  buildWorkflow: false,
  release: true,
  npmAccess: javascript.NpmAccess.PUBLIC,
  docgen: true,
  eslint: true,
  tsconfigDev: {
    compilerOptions: {
      isolatedModules: true,
    },
  },
  publishToPypi: {
    distName: 'renovosolutions.aws-cdk-aurora-native-backup',
    module: 'renovosolutions_aurora_native_backup',
  },
  publishToNuget: {
    dotNetNamespace: 'renovosolutions',
    packageId: 'Renovo.AWSCDK.AuroraNativeBackup',
  },
});

new javascript.UpgradeDependencies(project, {
  include: ['projen'],
  taskName: 'upgrade-projen',
  workflow: true,
  workflowOptions: {
    schedule: javascript.UpgradeDependenciesSchedule.WEEKLY,
  },
});

project.synth();
