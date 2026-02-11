/**
 * File installation utilities for claude-habitat preset system.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { CLAUDE_MD_MARKER, HABITAT_BEGIN_MARKER, HABITAT_END_MARKER } from './constants.js';

/**
 * Copy files with a given extension from srcDir to destDir.
 * Skips files whose content is identical to the destination.
 * Returns the number of files written.
 */
export async function installFiles(
  srcDir: string,
  destDir: string,
  ext: string,
): Promise<number> {
  await fs.mkdir(destDir, { recursive: true });

  let entries: string[];
  try {
    entries = await fs.readdir(srcDir);
  } catch {
    return 0;
  }

  const files = entries.filter((f) => f.endsWith(ext));
  let written = 0;

  for (const file of files) {
    const src = join(srcDir, file);
    const dest = join(destDir, file);
    const content = await fs.readFile(src, 'utf-8');

    if (await isSameContent(dest, content)) continue;

    await fs.writeFile(dest, content);
    written++;
  }

  return written;
}

/**
 * Install CLAUDE.md content to destPath.
 * - If destPath doesn't exist, write it.
 * - If destPath exists and contains the managed marker, overwrite it.
 * - If destPath exists without the marker, leave it alone (user-managed).
 * - If content is identical, skip.
 * Returns true if the file was written.
 */
export async function installClaudeMd(
  content: string,
  destPath: string,
): Promise<boolean> {
  let existing: string | null = null;
  try {
    existing = await fs.readFile(destPath, 'utf-8');
  } catch {
    // File doesn't exist
  }

  if (existing !== null) {
    if (existing === content) return false;
    if (!existing.includes(CLAUDE_MD_MARKER)) return false;
  }

  const dir = destPath.substring(0, destPath.lastIndexOf('/'));
  if (dir) await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(destPath, content);
  return true;
}

async function isSameContent(filePath: string, content: string): Promise<boolean> {
  try {
    const existing = await fs.readFile(filePath, 'utf-8');
    return existing === content;
  } catch {
    return false;
  }
}

/**
 * Inject or update a marker-delimited section in a file.
 * - File doesn't exist → create with marker section
 * - File exists with marker pair → replace content between markers
 * - File exists without markers → append marker section at end
 * - Only one marker found → throw (user corruption)
 * - Content identical → skip write
 * Returns true if the file was modified.
 */
export async function injectMarkerSection(
  filePath: string,
  section: string,
): Promise<boolean> {
  let existing = '';
  try {
    existing = await fs.readFile(filePath, 'utf-8');
  } catch {
    // File doesn't exist
  }

  // Migrate: remove old marker if present
  if (existing.includes(CLAUDE_MD_MARKER)) {
    existing = existing.replace(CLAUDE_MD_MARKER, '').replace(/^\n+/, '');
  }

  const markerBlock = `${HABITAT_BEGIN_MARKER}\n${section}\n${HABITAT_END_MARKER}`;

  const beginIdx = existing.indexOf(HABITAT_BEGIN_MARKER);
  const endIdx = existing.indexOf(HABITAT_END_MARKER);

  let newContent: string;

  if (beginIdx !== -1 && endIdx !== -1) {
    // Both markers found — replace between them (inclusive)
    newContent =
      existing.slice(0, beginIdx) +
      markerBlock +
      existing.slice(endIdx + HABITAT_END_MARKER.length);
  } else if (beginIdx === -1 && endIdx === -1) {
    // No markers — append
    const sep = existing.length > 0 && !existing.endsWith('\n\n') ? '\n\n' : '';
    newContent = existing + sep + markerBlock + '\n';
  } else {
    // Only one marker — corrupted
    throw new Error(
      'CLAUDE.md has unpaired habitat markers. Please fix or remove the stale marker manually.',
    );
  }

  if (newContent === existing) return false;

  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  if (dir) await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(filePath, newContent);
  return true;
}

/**
 * Remove the marker-delimited section from a file.
 * If the file becomes empty (only whitespace), delete it.
 * Returns true if modified.
 */
export async function removeMarkerSection(filePath: string): Promise<boolean> {
  let existing: string;
  try {
    existing = await fs.readFile(filePath, 'utf-8');
  } catch {
    return false; // file doesn't exist
  }

  const beginIdx = existing.indexOf(HABITAT_BEGIN_MARKER);
  const endIdx = existing.indexOf(HABITAT_END_MARKER);

  if (beginIdx === -1 || endIdx === -1) return false; // no markers

  const before = existing.slice(0, beginIdx);
  const after = existing.slice(endIdx + HABITAT_END_MARKER.length);
  const newContent = (before + after).replace(/\n{3,}/g, '\n\n').trim();

  if (!newContent) {
    await fs.unlink(filePath);
    return true;
  }

  await fs.writeFile(filePath, newContent + '\n');
  return true;
}
