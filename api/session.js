// Build the complete authoritative domain into one CommonJS module. Relative
// extensionless TypeScript imports must never reach Node's native ESM loader.
module.exports = require('../build-server/session.cjs');
module.exports.config = {api: {bodyParser: false}};
