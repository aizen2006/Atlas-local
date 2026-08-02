import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { db, memories, skills } from "@repo/memory";
import { models } from "@repo/agents";
import { openai } from "./openai";
import { Embedding } from "openai/resources/embeddings.mjs";
import { sql, inArray, eq } from "drizzle-orm";

const EMBEDDING_DIM = 1536;

interface Memory{
    content:string,
    category:"user"|"project"|"workflow"|"tool"|"fact",
    confidence?: number,
    importance?: number,
    sourceExperienceId?:number
}

export async function embed(text:string):Promise<Embedding[]>{
    try {
        const response = await openai.embeddings.create({
            input:text,
            model:models.embedding
        });
        return response.data
    } catch (error) {
        console.error(error);
        throw new Error(" Failed to convert the text to embedding ",{cause:error});
    }
}

export async function createMemory({
    content,
    category,
    confidence,
    importance,
    sourceExperienceId
}:Memory):Promise<number>{
    const [result] = await db
        .insert(memories)
        .values({content,category,confidence,importance,sourceExperienceId})
        .returning({id:memories.id});

    if(!result) throw new Error("Failed to insert memory");

    const [embedding] = await embed(content);
    if(!embedding) throw new Error("Failed to embed memory");

    // vec_memories is a sqlite-vec virtual table, invisible to the drizzle schema
    db.run(sql`
        INSERT INTO vec_memories (memory_id, embedding)
        VALUES (${result.id}, ${JSON.stringify(embedding.embedding)})
    `);

    return result.id;
}

export async function searchMemory(query:string,k:number){
    const [embedding] = await embed(query);
    if(!embedding) throw new Error("Failed to embed query");

    // nearest-neighbour lookup on the vec table returns ids ordered by distance
    const hits = db.all<{memory_id:number,distance:number}>(sql`
        SELECT memory_id, distance FROM vec_memories
        WHERE embedding MATCH ${JSON.stringify(embedding.embedding)} AND k = ${k}
        ORDER BY distance
    `);

    if(hits.length === 0) return [];

    const ids = hits.map(h=>h.memory_id);
    const rows = await db.select().from(memories).where(inArray(memories.id,ids));

    // db.select() does not preserve the MATCH order, so re-align to the hits order
    const rowById = new Map(rows.map(r=>[r.id,r]));
    return hits
        .map(h=>{
            const row = rowById.get(h.memory_id);
            return row ? {...row, distance:h.distance} : undefined;
        })
        .filter((r):r is NonNullable<typeof r> => r !== undefined);
}

export async function deleteMemory(id:number){
    // twin delete: nothing cascades into a virtual table automatically
    await db.delete(memories).where(eq(memories.id,id));
    db.run(sql`DELETE FROM vec_memories WHERE memory_id = ${id}`);
}

// the catalog the planner chooses from. Descriptions only — the full SKILL.md
// bodies are loaded later, and only for the skills it actually picks.
export async function listEnabledSkills():Promise<{name:string,description:string|null}[]>{
    return db
        .select({name:skills.name,description:skills.description})
        .from(skills)
        .where(eq(skills.enabled,true))
        .limit(50);
}

// reads the full SKILL.md instructions for the given skill names off disk
export async function loadSkills(names:string[]):Promise<{name:string,content:string}[]>{
    if(names.length === 0) return [];

    const rows = await db
        .select({name:skills.name,path:skills.path})
        .from(skills)
        .where(inArray(skills.name,names));

    const loaded = await Promise.all(
        rows.map(async(row)=>{
            try {
                const raw = await readFile(row.path,"utf-8");
                // drop the yaml frontmatter block, keep only the instructions
                const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,"").trim();
                return {name:row.name,content};
            } catch (error) {
                // a registered skill whose file has been deleted or renamed should
                // not take the whole turn down with it
                console.error(`Skill "${row.name}" could not be read from ${row.path}`,error);
                return undefined;
            }
        })
    );

    const usable = loaded.filter((s):s is {name:string,content:string} => s !== undefined);

    // usage is what makes a skill's value visible later — which ones actually get
    // pulled in, and which sit in the registry untouched. Not awaited: it must not
    // add latency to the turn, and a lost increment is harmless.
    if(usable.length){
        void db
            .update(skills)
            .set({usageCount:sql`${skills.usageCount} + 1`})
            .where(inArray(skills.name,usable.map(s=>s.name)))
            .catch((error)=>console.error("Failed to record skill usage",error));
    }

    return usable;
}

// resolved off this module rather than cwd, so the scan works whatever
// directory the server was started from
const SKILLS_DIR = join(import.meta.dir,"../../../../packages/skills");

// pulls `name` and `description` out of the SKILL.md yaml frontmatter.
// the frontmatter is a flat two-key block, so a full yaml parser would be overkill.
function parseFrontmatter(raw:string){
    const block = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if(!block?.[1]) return undefined;

    const name = block[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = block[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if(!name) return undefined;

    return {name,description};
}

// walks packages/skills/*/SKILL.md and upserts each one into the skills table.
// loadSkills and the getSkills tool both read that table, so without this the
// whole skills layer stays empty no matter what is on disk.
export async function syncSkills():Promise<number>{
    let entries;
    try {
        entries = await readdir(SKILLS_DIR,{withFileTypes:true});
    } catch (error) {
        console.error(`Could not read skills directory at ${SKILLS_DIR}`,error);
        return 0;
    }

    let synced = 0;
    for(const entry of entries){
        if(!entry.isDirectory()) continue;

        const path = join(SKILLS_DIR,entry.name,"SKILL.md");
        let raw;
        try {
            raw = await readFile(path,"utf-8");
        } catch {
            // a directory without a SKILL.md is not a skill
            continue;
        }

        const meta = parseFrontmatter(raw);
        if(!meta){
            console.warn(`Skipping ${path}: missing or malformed frontmatter`);
            continue;
        }

        // name is unique, so re-running this just refreshes description and path
        // and leaves usageCount / successRate / enabled alone
        await db
            .insert(skills)
            .values({name:meta.name,description:meta.description,path})
            .onConflictDoUpdate({
                target:skills.name,
                set:{description:meta.description,path}
            });
        synced++;
    }

    return synced;
}