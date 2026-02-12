#!/usr/bin/env node
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Register tsx loader so dynamic import of .ts workflow files works at runtime
try {
  register('tsx/esm', pathToFileURL(import.meta.url));
} catch {
  // tsx not available — only .js workflows will be supported
}

// Load credentials from ~/.claude-habitat/.claude-habitat.json
try {
  const configPath = join(homedir(), '.claude-habitat', '.claude-habitat.json');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const creds = config.credentials;
  if (creds) {
    if (creds.apiKey && !process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = creds.apiKey;
    }
    if (creds.baseUrl && !process.env.ANTHROPIC_BASE_URL) {
      process.env.ANTHROPIC_BASE_URL = creds.baseUrl;
    }
  }
} catch {
  // No config file or invalid — credentials must come from environment
}

const { run } = await import('../dist/src/cli/index.js');
run(process.argv.slice(2)).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
