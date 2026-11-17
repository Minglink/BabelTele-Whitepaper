import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

/**
 * Minimal zero-dependency `.env` loader scoped strictly to `babeltele-studio/.env`.
 * Never overrides environment variables already explicitly set in `process.env`.
 */
export function loadDotEnv(): void {
  if (loaded) return;
  loaded = true;

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    // Works from both `src/env.ts` (.. -> project root) and `dist/env.js` (.. -> project root)
    const projectRoot = path.resolve(currentDir, "..");
    const envPath = path.join(projectRoot, ".env");
    if (!fs.existsSync(envPath)) return;

    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined && val !== "") {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore optional .env read errors
  }
}
