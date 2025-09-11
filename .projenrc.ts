import { awscdk, javascript } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Renovo Solutions',
  authorAddress: 'webmaster+cdk@renovo1.com',
  cdkVersion: '2.202.0',
  defaultReleaseBranch: 'master',
  jsiiVersion: '~5.8.0',
  name: '@renovosolutions/cdk-library-aurora-native-backup',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/RenovoSolutions/cdk-library-aurora-native-backup.git',
  description: 'AWS CDK Construct Library to deploy Aurora Serverless Native Backup',
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
  depsUpgrade: true,
  depsUpgradeOptions: {
    workflow: false,
    exclude: ['projen'],
  },
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
  release: true,
  npmAccess: javascript.NpmAccess.PUBLIC,
  docgen: true,
  eslint: true,
  publishToPypi: {
    distName: 'renovosolutions.aws-cdk-aurora-native-backup',
    module: 'renovosolutions_aurora_native_backup',
  },
  publishToNuget: {
    dotNetNamespace: 'renovosolutions',
    packageId: 'Renovo.AWSCDK.AuroraNativeBackup',
  },
  experimentalIntegRunner: true,

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
