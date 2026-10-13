export const onPreBuild = ({ netlifyConfig, packageJson }) => {
  netlifyConfig.build.environment.npm_package_version = packageJson.version;
};
