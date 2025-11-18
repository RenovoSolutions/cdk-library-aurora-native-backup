import { awscdk, javascript } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Renovo Solutions',
  authorAddress: 'webmaster+cdk@renovo1.com',
  cdkVersion: '2.225.0',
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
    'cdk-ecr-deployment@^4.0.3',
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
    '@aws-sdk/client-s3@^3.0.0',
    'prompts@^2.4.0',
    '@types/prompts@^2.4.0',
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

// Ignore the release workflow file so it's not committed to git
project.gitignore.exclude('!/.github/workflows/release.yml');
project.gitignore.addPatterns('.github/workflows/release.yml');

new javascript.UpgradeDependencies(project, {
  include: ['projen'],
  taskName: 'upgrade-projen',
  workflow: false,
});

project.synth();
