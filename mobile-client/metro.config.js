const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// In multi-folder repos, Expo/Metro can sometimes resolve modules relative to the
// workspace root instead of the app root. Pin resolution to this app's
// node_modules first.
config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  ...(config.resolver.nodeModulesPaths || []),
];

module.exports = config;
