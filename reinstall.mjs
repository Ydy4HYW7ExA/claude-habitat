#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const dir = resolve(import.meta.dirname || '.');

console.log('Building...');
execSync('npm run build', { cwd: dir, stdio: 'inherit' });

console.log('Reinstalling...');
execSync('node install.mjs', { cwd: dir, stdio: 'inherit' });
