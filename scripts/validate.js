'use strict';

// Checks every data file without building the site. Run with `npm run validate`.
// The build runs the same checks and refuses to build from invalid data.

const { loadClients, loadPages } = require('./lib');

const { clients, errors } = loadClients();
let pages = [];
try {
  pages = loadPages();
} catch (err) {
  errors.push(err.message);
}
if (!clients.some((c) => c.featured)) errors.push('One client must be featured (featured: true)');

if (errors.length) {
  console.error(`${errors.length} problem${errors.length === 1 ? '' : 's'}:\n${errors.map((e) => `  ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`OK: ${clients.length} clients and tools, ${pages.length} pages.`);
