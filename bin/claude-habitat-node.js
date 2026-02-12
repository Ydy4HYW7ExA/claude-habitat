#!/usr/bin/env node
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Register tsx loader so dynamic import of .ts workflow files works at runtime
try {
  register('tsx/esm', pathToFileURL(import.meta.url));
} catch {
  // tsx not available — only .js workflows will be supported
}

const { run } = await import('../dist/src/cli/index.js');
run(process.argv.slice(2)).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
