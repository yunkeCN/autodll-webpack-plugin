import MemoryFileSystem from 'memory-fs';
import fs from './utils/fs';
import { join } from 'bluebird';
import { cacheDir } from './paths';
import path from 'path';

const getBundles = mfs => {
  return mfs.readdirSync('/').map(filename => ({
    filename,
    buffer: mfs.readFileSync(`/${filename}`)
  }));
};

export const createMemory = (fs, cacheDir) => hash => {
  const mfs = new MemoryFileSystem();

  return fs
    .readdirAsync(path.join(cacheDir, hash))
    .catch(() => [])
    .filter(filename => /\.(js|map|css|)$/.test(path.extname(filename)))
    .map(filename =>
      join(filename, Promise.resolve(fs.readFileSync(path.join(cacheDir, hash, filename))))
    )
    .map(([filename, buffer]) => {
      mfs.writeFileSync(`/${filename}`, buffer);
    })
    .then(() => ({
      getBundles: getBundles.bind(null, mfs)
    }));
};

export default createMemory(fs, cacheDir);
