import { promises as fs } from 'node:fs';

export function isEnoent(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    if (isEnoent(e)) return null;
    throw e;
  }
}

export async function readdirOrEmpty(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch (e) {
    if (isEnoent(e)) return [];
    throw e;
  }
}
