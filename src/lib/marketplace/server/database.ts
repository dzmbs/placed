import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

let instance: DatabaseSync | undefined;
export function database() {
  if (instance) return instance;
  const root = path.join(process.cwd(), 'data');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  instance = new DatabaseSync(path.join(root, 'marketplace.sqlite'));
  instance.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY, wallet TEXT NOT NULL, message TEXT NOT NULL,
      expires INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      digest TEXT PRIMARY KEY, wallet TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS world_requests (
      nonce TEXT PRIMARY KEY, wallet TEXT NOT NULL, signal TEXT NOT NULL,
      action TEXT NOT NULL, environment TEXT NOT NULL, expires INTEGER NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS participants (
      identity TEXT PRIMARY KEY, wallet TEXT UNIQUE NOT NULL, verified INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media (
      hash TEXT PRIMARY KEY, type TEXT NOT NULL, extension TEXT NOT NULL, owner TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS proofs (
      campaign TEXT PRIMARY KEY, wallet TEXT NOT NULL, result TEXT NOT NULL, created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY, wallet TEXT NOT NULL, created INTEGER NOT NULL
    );
  `);
  return instance;
}
