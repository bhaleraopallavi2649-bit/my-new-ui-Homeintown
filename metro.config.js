const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-svg@15.8.0 ships a package.json whose "react-native" field
// (and those of its sub-packages like /css, /filter-image) point at a
// non-existent src/*.ts entry, so Metro's default resolution fails with
// "could not be resolved (.../src/index.ts)". We intercept only
// react-native-svg (and its subpaths) and resolve them against the shipped
// compiled output under lib/, leaving every other package on Metro's
// default resolver.
const svgRoot = path.dirname(
  require.resolve('react-native-svg/package.json', { paths: [__dirname] })
);

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-svg' || moduleName.startsWith('react-native-svg/')) {
    const sub = moduleName.replace(/^react-native-svg\/?/, '');
    const target = sub
      ? path.join(svgRoot, 'lib', 'commonjs', sub, 'index.js')
      : path.join(svgRoot, 'lib', 'commonjs', 'index.js');
    return { type: 'sourceFile', filePath: target };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
