import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as sqliteVec from 'sqlite-vec';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

// shadow index for the memories table; memory_id mirrors memories.id
sqlite.run(`
CREATE VIRTUAL TABLE IF NOT EXISTS vec_memories USING vec0(
    memory_id INTEGER PRIMARY KEY,
    embedding FLOAT[1536] distance_metric=cosine
);
`);

export const db = drizzle(sqlite);


export * from "./schema";