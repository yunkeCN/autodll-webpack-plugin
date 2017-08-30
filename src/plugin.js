import { DllReferencePlugin } from 'webpack';
import path from 'path';

import createConfig from './createConfig';
import compileIfNeeded from './compileIfNeeded';
import createDllCompiler from './createDllCompiler';
import { cacheDir, createGetPublicDllPath } from './paths';
import { concat, merge, keys } from './utils/index.js';
import createSettings from './createSettings';
import getInstanceIndex from './getInstanceIndex';
import createMemory from './createMemory';

export const getManifestPath = hash => bundleName =>
  path.resolve(cacheDir, hash, `${bundleName}.manifest.json`);

class AutoDLLPlugin {
  constructor(settings) {
    this._originalSettings = settings;
  }

  apply(compiler) {
    const settings = createSettings({
      originalSettings: this._originalSettings,
      index: getInstanceIndex(compiler.options.plugins, this),
      parentConfig: compiler.options
    });

    const dllConfig = createConfig(settings, compiler.options);

    // exposed for better clarity while debugging 
    this._settings = settings;
    this._dllConfig = dllConfig;

    const { context, inject } = settings;

    console.log('context:', context);
    const getPublicDllPath = createGetPublicDllPath(settings);

    keys(dllConfig.entry).map(getManifestPath(settings.hash)).forEach(manifestPath => {
      new DllReferencePlugin({
        context: context,
        manifest: manifestPath
      }).apply(compiler);
    });

    compiler.plugin('before-compile', (params, callback) => {
      params.compilationDependencies = params.compilationDependencies.filter(
        path => !path.startsWith(cacheDir)
      );

      callback();
    });

    compiler.plugin(['run', 'watch-run'], (compiler, callback) => {
      const config = Object.assign({}, dllConfig);
      delete config.entry;
      compileIfNeeded(settings, createDllCompiler(config))
        .then((state) => {
          this.state = state;

          createMemory(settings.hash)
            .then(memory => {
              this.initialized = true;
              this.memory = memory;
            });
        })
        .then(callback);
    });

    compiler.plugin('emit', (compilation, callback) => {
      const { memory } = this;

      const assets = memory.getBundles().map(({ filename, buffer }) => {
        const relativePath = getPublicDllPath(filename, true);

        return {
          [relativePath]: {
            source: () => buffer.toString(),
            size: () => buffer.length
          }
        };
      });

      compilation.assets = merge(compilation.assets, ...assets);
      callback();
    });

    if (inject) {
      compiler.plugin('compilation', compilation => {
        compilation.plugin(
          'html-webpack-plugin-before-html-generation',
          (htmlPluginData, callback) => {
            const { memory } = this;
            const entrypoints = compilation.entrypoints;

            const htmlChunks = Object.keys(htmlPluginData.assets.chunks);

            const bundlesPublicPaths = memory.getBundles()
              .filter((item) => {
                let isDep = false;
                const moduleId = `external "${item.filename.replace(/\.js$/, '')}"`;
                const dllExternalModule = compilation.findModule(moduleId);
                if (dllExternalModule) {
                  htmlChunks.every((htmlChunk) => {
                    const entrypoint = entrypoints[htmlChunk];
                    if (entrypoint) {
                      entrypoint.chunks.every((entrypointChunk) => {
                        if (entrypointChunk.containsModule(dllExternalModule)) {
                          isDep = true;
                        }
                        return !isDep;
                      });
                    }

                    return !isDep;
                  });
                }

                return isDep;
              })
              .map((item) => {
                return getPublicDllPath(item.filename);
              });

            htmlPluginData.assets.js = [].concat(bundlesPublicPaths).concat(htmlPluginData.assets.js);

            callback(null, htmlPluginData);
          }
        );
      });
    }
  }
}

export default AutoDLLPlugin;
