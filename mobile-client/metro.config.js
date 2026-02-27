const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Allow importing `.svg` as React components (requires `react-native-svg`).
// e.g. `import HomeIcon from "./assets/home.svg";`
config.transformer = config.transformer || {};
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');

config.resolver = config.resolver || {};
config.resolver.assetExts = (config.resolver.assetExts || []).filter((ext) => ext !== 'svg');
config.resolver.sourceExts = Array.from(new Set([...(config.resolver.sourceExts || []), 'svg']));

// In multi-folder repos, Expo/Metro can sometimes resolve modules relative to the
// workspace root instead of the app root. Pin resolution to this app's
// node_modules first.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  ...(config.resolver.nodeModulesPaths || []),
];

module.exports = config;
