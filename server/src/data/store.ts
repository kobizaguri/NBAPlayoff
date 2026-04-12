import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(__dirname, '../../data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readStore<T>(name: string): T[] {
  ensureDataDir();
  const fp = filePath(name);
  if (!fs.existsSync(fp)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function writeStore<T>(name: string, data: T[]): void {
  ensureDataDir();
  const fp = filePath(name);
  const tmpPath = `${fp}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, fp);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
    throw err;
  }
}

export function integrityCheck(): void {
  const stores = [
    'users',
    'leagues',
    'members',
    'series',
    'predictions',
    'notifications',
    'refreshTokens',
  ];
  for (const name of stores) {
    const fp = filePath(name);
    if (fs.existsSync(fp)) {
      try {
        const raw = fs.readFileSync(fp, 'utf-8');
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error(`${name}.json root is not an array`);
        }
        console.info(`[integrity] ${name}.json OK  (${parsed.length} records)`);
      } catch (err) {
        console.error(`[integrity] ${name}.json FAILED: ${(err as Error).message}`);
        throw err;
      }
    } else {
      console.info(`[integrity] ${name}.json not found — will be created on first write`);
    }
  }
}
