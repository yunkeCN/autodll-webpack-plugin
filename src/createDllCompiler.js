import webpack from 'webpack';
import webpackMerge from 'webpack-merge';

const createDllCompiler = (config) => (additionalConfig) => {
  return webpack(webpackMerge.smart(config, additionalConfig));
};

export default createDllCompiler;
