import findCacheDir from 'find-cache-dir';
import { join } from 'path';
import { resolve } from 'url';

export const cacheDir = findCacheDir({ name: 'autodll-webpack-plugin' });

export const createGetPublicDllPath = (settings) => {
  return (filename, relative = false) => {
    const relativePath = join(settings.path, filename);

    return relative ? relativePath : resolve(settings.publicPath, relativePath);
  };
};
