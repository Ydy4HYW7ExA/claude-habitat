import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findProjectHabitatDir } from '../../src/cli/augment.js';

describe('findProjectHabitatDir', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = join(tmpdir(), `augment-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(rootDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('returns null when no marker.json exists', async () => {
    const result = await findProjectHabitatDir(rootDir);
    expect(result).toBeNull();
  });

  it('finds habitat dir in the start directory', async () => {
    const habitatDir = join(rootDir, '.claude-habitat');
    await fs.mkdir(habitatDir, { recursive: true });
    await fs.writeFile(join(habitatDir, 'marker.json'), '{}');

    const result = await findProjectHabitatDir(rootDir);
    expect(result).toBe(habitatDir);
  });

  it('finds habitat dir in a parent directory', async () => {
    const habitatDir = join(rootDir, '.claude-habitat');
    await fs.mkdir(habitatDir, { recursive: true });
    await fs.writeFile(join(habitatDir, 'marker.json'), '{}');

    const childDir = join(rootDir, 'src', 'deep', 'nested');
    await fs.mkdir(childDir, { recursive: true });

    const result = await findProjectHabitatDir(childDir);
    expect(result).toBe(habitatDir);
  });

  it('returns the closest habitat dir when nested', async () => {
    // Parent habitat
    const parentHabitat = join(rootDir, '.claude-habitat');
    await fs.mkdir(parentHabitat, { recursive: true });
    await fs.writeFile(join(parentHabitat, 'marker.json'), '{}');

    // Child project with its own habitat
    const childProject = join(rootDir, 'packages', 'sub');
    const childHabitat = join(childProject, '.claude-habitat');
    await fs.mkdir(childHabitat, { recursive: true });
    await fs.writeFile(join(childHabitat, 'marker.json'), '{}');

    const result = await findProjectHabitatDir(childProject);
    expect(result).toBe(childHabitat);
  });
});
