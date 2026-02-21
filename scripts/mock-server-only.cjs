// Preload hook: replace 'server-only' with an empty module
// so we can run server-side code outside Next.js
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') return request;
  return origResolve.call(this, request, parent, isMain, options);
};
require.cache['server-only'] = {
  id: 'server-only',
  filename: 'server-only',
  loaded: true,
  exports: {},
};
