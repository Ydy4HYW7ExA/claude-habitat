import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
/** Locate the claude-habitat package root directory. */
export function getPackageRoot() {
    const thisFile = fileURLToPath(import.meta.url);
    const dir = path.dirname(thisFile);
    // src/cli/package-utils.ts → up 2 levels = project root
    // dist/src/cli/package-utils.js → up 3 levels = project root
    const inDist = dir.includes(path.sep + 'dist' + path.sep) || dir.includes('/dist/');
    const levels = inDist ? 3 : 2;
    return path.resolve(dir, ...Array(levels).fill('..'));
}
/** Read a built-in workflow file by name (without extension). */
export async function readBuiltinWorkflow(name) {
    const root = getPackageRoot();
    // Try .mjs first (portable, no type imports), then .ts/.js fallback
    for (const ext of ['.mjs', '.ts', '.js']) {
        try {
            return await fs.readFile(path.join(root, 'workflows', name + ext), 'utf-8');
        }
        catch { /* try next */ }
    }
    // Try dist/workflows/ (compiled environment)
    try {
        return await fs.readFile(path.join(root, 'dist', 'workflows', name + '.js'), 'utf-8');
    }
    catch { /* fall through */ }
    throw new Error(`Built-in workflow '${name}' not found`);
}
//# sourceMappingURL=package-utils.js.map