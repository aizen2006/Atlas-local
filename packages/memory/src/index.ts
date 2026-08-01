import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as sqliteVec from 'sqlite-vec';
import { existsSync, type PathLike } from 'node:fs';

if(process.env.DB_FILE_NAME){
    throw new Error("DB file path incorrect or missing");
}


const dbExisted = existsSync(process.env.DB_FILE_NAME as PathLike );
console.log(`DB: ${process.env.DB_FILE_NAME} (${dbExisted ? "existing" : "new — will be created"})`);

const sqlite = new Database(process.env.DB_FILE_NAME);
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