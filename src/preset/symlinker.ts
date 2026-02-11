/**
 * Symlink infrastructure for claude-habitat.
 * Creates/syncs/removes symlinks from habitat source-of-truth dirs to .claude/ consumer dirs.
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { readdirOrEmpty } from '../infra/fs-utils.js';

export interface SyncResult {
  created: number;
  skipped: number;
  removed: number;
}

/**
 * For single file: create symlink if not already correct.
 * Returns true if a new symlink was created.
 */
export async function ensureSymlink(
  srcPath: string,
  destPath: string,
): Promise<boolean> {
  const absSrc = resolve(srcPath);

  try {
    const stat = await fs.lstat(destPath);
    if (stat.isSymbolicLink()) {
      const target = await fs.readlink(destPath);
      if (resolve(target) === absSrc) return false; // already correct
      await fs.unlink(destPath); // wrong target, recreate
    } else {
      // Not a symlink — don't touch regular files
      return false;
    }
  } catch {
    // destPath doesn't exist, will create
  }

  const destDir = destPath.substring(0, destPath.lastIndexOf('/'));
  if (destDir) await fs.mkdir(destDir, { recursive: true });

  await fs.symlink(absSrc, destPath);
  return true;
}

/**
 * Remove a single symlink (only if it IS a symlink).
 * Returns true if removed.
 */
export async function removeSymlink(destPath: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(destPath);
    if (!stat.isSymbolicLink()) return false;
    await fs.unlink(destPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync symlinks: for every file in srcDir matching pattern, ensure a symlink in destDir.
 * Also cleans up stale symlinks in destDir that point into srcDir but whose source no longer exists.
 */
export async function syncSymlinks(
  srcDir: string,
  destDir: string,
  pattern: RegExp,
): Promise<SyncResult> {
  await fs.mkdir(destDir, { recursive: true });

  const srcEntries = await readdirOrEmpty(srcDir);
  const matched = srcEntries.filter((f) => pattern.test(f));

  let created = 0;
  let skipped = 0;

  for (const file of matched) {
    const wasCreated = await ensureSymlink(join(srcDir, file), join(destDir, file));
    if (wasCreated) created++;
    else skipped++;
  }

  // Clean stale symlinks: symlinks in destDir pointing into srcDir whose source is gone
  const absSrcDir = resolve(srcDir);
  const destEntries = await readdirOrEmpty(destDir);
  let removed = 0;

  for (const file of destEntries) {
    const destPath = join(destDir, file);
    try {
      const stat = await fs.lstat(destPath);
      if (!stat.isSymbolicLink()) continue;
      const target = resolve(await fs.readlink(destPath));
      if (!target.startsWith(absSrcDir + '/')) continue;
      // Points into srcDir — check if source still exists
      if (!srcEntries.includes(file)) {
        await fs.unlink(destPath);
        removed++;
      }
    } catch {
      // skip errors
    }
  }

  return { created, skipped, removed };
}

/**
 * Remove all symlinks in destDir that point into srcDir.
 * Only removes symlinks, never regular files.
 */
export async function removeSymlinks(
  srcDir: string,
  destDir: string,
): Promise<number> {
  const absSrcDir = resolve(srcDir);
  const entries = await readdirOrEmpty(destDir);
  let removed = 0;

  for (const file of entries) {
    const destPath = join(destDir, file);
    try {
      const stat = await fs.lstat(destPath);
      if (!stat.isSymbolicLink()) continue;
      const target = resolve(await fs.readlink(destPath));
      if (target.startsWith(absSrcDir + '/')) {
        await fs.unlink(destPath);
        removed++;
      }
    } catch {
      // skip errors
    }
  }

  return removed;
}
