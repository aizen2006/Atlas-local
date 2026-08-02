import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { Database } from 'bun:sqlite';
import * as sqliteVec from 'sqlite-vec';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

if(!process.env.DB_FILE_NAME){
    throw new Error("DB file path incorrect or missing");
}

// resolved to an absolute path so the cwd a process was launched from can no
// longer decide which database opens. `bun run dev` starts in apps/server and
// `bun run atlas` starts at the repo root — without this, the same relative
// DB_FILE_NAME silently points at two different files.
const DB_PATH = resolve(process.env.DB_FILE_NAME);

const dbExisted = existsSync(DB_PATH);
console.log(`DB: ${DB_PATH} (${dbExisted ? "existing" : "new — will be created"})`);

const sqlite = new Database(DB_PATH);
sqlite.loadExtension(sqliteVec.getLoadablePath());

sqlite.run(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`);

export const db = drizzle(sqlite);

// Schema is applied on every boot, not by a separate command the user has to
// remember. Without this a fresh database starts with no application tables at
// all — the server comes up, /health passes, and the first real request fails,
// which reads as a bug rather than a missing setup step. Drizzle records what it
// has applied in __drizzle_migrations, so re-running is a no-op.
const MIGRATIONS_DIR = join(import.meta.dir, "migrations");

try {
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    if (!dbExisted) console.log("DB: schema created");
} catch (error) {
    console.error(`Failed to apply migrations from ${MIGRATIONS_DIR}`);
    throw error;
}

// shadow index for the memories table; memory_id mirrors memories.id.
// Created after the migrations so it never races the table it shadows.
sqlite.run(`
CREATE VIRTUAL TABLE IF NOT EXISTS vec_memories USING vec0(
    memory_id INTEGER PRIMARY KEY,
    embedding FLOAT[1536] distance_metric=cosine
);
`);


export * from "./schema";