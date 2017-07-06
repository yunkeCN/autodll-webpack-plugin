export const concat = Array.prototype.concat.bind([]);

export const merge = (...args) => Object.assign({}, ...args);
export const keys = Object.keys;

export default {
  concat,
  merge,
  keys
};
