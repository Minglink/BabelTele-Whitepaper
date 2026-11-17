import * as fs from 'node:fs';
import * as path from 'node:path';

let cachedRoot: string | null = null;

/**
 * Resolves the babeltele-swarm project root reliably whether running via tsx (src/) or node (dist/src/).
 */
export function resolveProjectRoot(): string {
  if (cachedRoot) return cachedRoot;
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const pkgCandidate = path.join(dir, 'package.json');
    if (fs.existsSync(pkgCandidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgCandidate, 'utf8')) as { name?: string };
        if (pkg.name === '@babeltele/swarm') {
          cachedRoot = dir;
          return dir;
        }
      } catch {
        // continue walking up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  cachedRoot = process.cwd();
  return cachedRoot;
}

/**
 * Safely resolves a relative file path inside a workspace directory, preventing path traversal.
 */
export function safeResolveWorkspaceFile(workspaceDir: string, relFilePath: string): string {
  const rootResolved = path.resolve(workspaceDir);
  const cleaned = relFilePath.replace(/^[/\\]+/, '');
  const candidate = path.resolve(rootResolved, cleaned);
  if (candidate !== rootResolved && !candidate.startsWith(rootResolved + path.sep)) {
    throw new Error(`Path traversal rejected: ${relFilePath}`);
  }
  return candidate;
}
