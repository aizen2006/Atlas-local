import { tool } from "@openai/agents";
import { z } from "zod";
import { db , skills } from "@repo/memory";
import { eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";

// packages/agents/src/tools -> packages/skills
const SKILLS_DIR = resolve(import.meta.dir, "../../../skills");

// Skill names become directory names and the unique key in the skills table, so
// they are normalised rather than trusted: a model-supplied name like
// "../../etc/passwd" or "Weekly Report!" must never reach the filesystem as-is.
function slugify(raw: string): string {
    return raw
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
}


interface SkillList {
    id:number,
    name:string,
    description:string | null,
    path:string,
    successRate:number | null,
    usageCount:number | null
}

export const getSkills = tool({
    name:"Get Skills",
    description:`Fetch's the skils from the database with there descriptions `,
    parameters:z.object(),
    async execute(){
        try {
            const skills_list: SkillList[] = await db.select({
                id:skills.id,
                name:skills.name,
                description:skills.description ,
                path:skills.path,
                successRate:skills.successRate,
                usageCount:skills.usageCount
            })
            .from(skills)
            .where(
                eq(skills.enabled,true)
            );
            return skills_list;
        } catch (error) {
            console.error(error);
            return {
                message:"Failed to get skills, try again",
                error:error
            }
        }
    }
});

export const createSkill = tool({
    name:"Create Skill",
    description:`
        Write a new reusable SKILL.md playbook so a workflow you just worked out can be
        loaded again on a future task, instead of being re-derived from scratch.

        Only create a skill for a REPEATABLE procedure — something with steps that would
        apply to a different request of the same kind. Good candidates: a multi-step
        format the user asked for twice, a checklist that made a task come out right, a
        procedure with rules worth following exactly.

        Do NOT create a skill for: a one-off answer, a fact about the user (that belongs
        in memory, not a skill), a task you only did once with no sign it recurs, or
        anything already covered by an existing skill — call getSkills and check first.

        A weak skill is worse than none: the planner loads skills by description, so a
        vague or redundant one gets pulled into unrelated tasks and degrades them.
        `,
    parameters:z.object({
        name: z.string().describe("Short kebab-case name, e.g. 'weekly-status-report'. Becomes the folder name."),
        description: z.string().describe("One or two sentences on what this skill does and exactly when to use it. This is the ONLY thing the planner sees when deciding whether to load it, so lead with the triggering situations."),
        content: z.string().describe("The playbook body in markdown, without frontmatter: purpose, when to use, the steps, and what a good result looks like."),
        overwrite: z.boolean().default(false).describe("Set true only to deliberately replace an existing skill of the same name.")
    }),
    async execute({name,description,content,overwrite}){
        try {
            const slug = slugify(name);
            if(!slug) return { message:`"${name}" is not a usable skill name — use letters and numbers.` };

            const dir = join(SKILLS_DIR,slug);
            // defence in depth: slugify already strips separators, but verify the
            // resolved path really is inside the skills directory before writing.
            if(!resolve(dir).startsWith(SKILLS_DIR + sep)){
                return { message:"Refused: resolved skill path escapes the skills directory." };
            }

            const file = join(dir,"SKILL.md");
            if(existsSync(file) && !overwrite){
                return { message:`A skill named "${slug}" already exists. Re-run with overwrite: true only if you intend to replace it.` };
            }

            // frontmatter is the two-key block parseFrontmatter expects on boot sync
            const markdown = `---\nname: ${slug}\ndescription: ${description.replace(/\r?\n/g," ").trim()}\n---\n\n${content.trim()}\n`;

            await mkdir(dir,{recursive:true});
            await writeFile(file,markdown,"utf-8");

            // register immediately so the planner can use it on the very next turn,
            // rather than waiting for the next boot's syncSkills()
            await db
                .insert(skills)
                .values({name:slug,description,path:file})
                .onConflictDoUpdate({target:skills.name,set:{description,path:file}});

            return { message:`Created skill "${slug}".`, path:file };
        } catch (error) {
            console.error(error);
            return {
                message:"Failed to create the skill",
                error:String(error)
            }
        }
    }
});