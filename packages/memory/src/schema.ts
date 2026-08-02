import { integer, sqliteTable as tb, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";


// alias for converstions
export const sessions = tb('sessions',{
    id: integer().primaryKey({autoIncrement:true}),
    title:text(),
    path:text(), // path
    createdAt:integer({mode:"timestamp"}).notNull().default(sql`(unixepoch())`),
    lastOpenedAt:integer({mode:"timestamp"}).notNull().default(sql`(unixepoch())`)
});
// store's user's messages
export const messages = tb(`messages`,{
    id: integer().primaryKey({autoIncrement:true}),
    sessionId:integer().references(()=>sessions.id),
    role:text({enum:["user","agent"]}),
    content:text(),
    metadata: text({ mode: "json" }),
    createdAt:integer({mode:"timestamp"})
});
// experinces's / learning's from user - an entire solved problem
export const experiences = tb("experiences", {
    id: integer().primaryKey({ autoIncrement: true }),
    sessionId: integer()
        .references(() => sessions.id),
    task: text().notNull(),
    success: integer({ mode: "boolean" }).notNull().default(true),
    result: text(),
    reflection: text(),
    confidence: integer(),
    createdAt: integer({ mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});
//skills - set of formated instructions to do a specific task 
export const skills = tb('skills',{
    id: integer().primaryKey({autoIncrement:true}),
    name:text().unique().notNull(), // Name of the skill
    description:text(), // short description of the skill
    path:text().notNull(), // path where skill is stored at (SKILL.md)
    usageCount: integer().default(0),
    successRate: integer().default(100),
    enabled: integer({ mode: "boolean" })
        .default(true),
    createdAt: integer({ mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull()
});
// Memory - small reusable facts extracted from experiences
export const memories = tb("memories", {
    id: integer().primaryKey({ autoIncrement: true }),
    content: text().notNull(),
    category: text({
        enum: [
            "user",
            "project",
            "workflow",
            "tool",
            "fact"
        ]
    }),
    confidence: integer().default(100),
    importance: integer().default(50),
    sourceExperienceId: integer()
        .references(() => experiences.id),
    lastAccessed: integer({ mode: "timestamp" })
        .default(sql`(unixepoch())`),
    createdAt: integer({ mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});

// key/value app settings — user-facing toggles that must survive a restart.
// Deliberately schemaless: each setting is one row, so adding one later needs no
// migration.
export const settings = tb("settings", {
    key: text().primaryKey(),
    value: text().notNull(),
    updatedAt: integer({ mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});

// For background jobs

export const jobs = tb("jobs", {
    id: integer().primaryKey({ autoIncrement: true }),
    type: text(),
    payload:text({ mode: "json" }),
    status: text({
        enum: [
            "pending",
            "running",
            "completed",
            "failed"
        ]
    }),
    attempts: integer().default(0),
    error: text(),
    createdAt: integer({ mode: "timestamp" })
        .default(sql`(unixepoch())`),
    completedAt: integer({ mode: "timestamp" }),
});