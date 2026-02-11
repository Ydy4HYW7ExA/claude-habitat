#!/usr/bin/env node
/**
 * Build script: resolves {{PLACEHOLDER}} templates in preset files.
 * Reads constants from compiled dist/preset/constants.js,
 * processes src/preset/templates/**, outputs to dist/presets/.
 */

import { promises as fs } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname || '.');
const PROJECT = resolve(ROOT, '..');
const TEMPLATES_DIR = join(PROJECT, 'src', 'preset', 'templates');
const OUTPUT_DIR = join(PROJECT, 'dist', 'presets');

async function main() {
  // 1. Import constants from compiled output
  const constantsPath = join(PROJECT, 'dist', 'preset', 'constants.js');
  const constants = await import(pathToFileURL(constantsPath).href);

  // 2. Build replacement map — only naming/ID constants, not runtime paths
  const TEMPLATE_KEYS = [
    'HABITAT_PREFIX',
    'SKILL_PROJECT_ITERATE',
    'SKILL_MANAGE_COMMANDS',
    'SKILL_MANAGE_MCP',
    'SKILL_MANAGE_RULES',
    'SKILL_MANAGE_SKILLS',
    'RULE_WORKFLOW_ID',
  ];

  const replacements = {};
  for (const key of TEMPLATE_KEYS) {
    const value = constants[key];
    if (typeof value !== 'string') {
      console.error(`Missing or non-string constant: ${key}`);
      process.exit(1);
    }
    replacements[`{{${key}}}`] = value;
  }

  console.log('Replacement map:');
  for (const [k, v] of Object.entries(replacements)) {
    console.log(`  ${k} → ${v}`);
  }

  // 3. Process all template files
  const files = await collectFiles(TEMPLATES_DIR);
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });

  let processed = 0;
  for (const filePath of files) {
    const rel = relative(TEMPLATES_DIR, filePath);
    const outPath = join(OUTPUT_DIR, rel);
    await fs.mkdir(join(outPath, '..'), { recursive: true });

    let content = await fs.readFile(filePath, 'utf-8');
    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.replaceAll(placeholder, value);
    }

    await fs.writeFile(outPath, content);
    processed++;
  }

  console.log(`\nProcessed ${processed} files → ${OUTPUT_DIR}`);

  // 4. Validate: no residual {{...}} placeholders
  const outputFiles = await collectFiles(OUTPUT_DIR);
  const errors = [];
  for (const filePath of outputFiles) {
    const content = await fs.readFile(filePath, 'utf-8');
    const matches = content.match(/\{\{[A-Z_]+\}\}/g);
    if (matches) {
      const rel = relative(OUTPUT_DIR, filePath);
      errors.push(`${rel}: residual placeholders: ${[...new Set(matches)].join(', ')}`);
    }
  }

  if (errors.length > 0) {
    console.error('\nERROR: Unresolved placeholders found:');
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }

  console.log('Validation passed: no residual placeholders.');
}

async function collectFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
