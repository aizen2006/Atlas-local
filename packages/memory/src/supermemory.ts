import Supermemory from "supermemory";
import fs from "fs";

// Mode is decided once, on first use, from the environment:
//
//   nothing set              -> local. Supermemory.local() installs and starts the
//                               server if it isn't already up, and embeddings run
//                               on-device. This is the default so a fresh install
//                               keeps working with no account and no key.
//   SUPERMEMORY_API_KEY set  -> cloud. Opt-in, because it sends memories off the machine.
//   SUPERMEMORY_BASE_URL set -> that endpoint, as-is. For a server you already run
//                               yourself; skips the auto-start entirely.
//
// Built lazily rather than at import time: constructing eagerly turns "no key yet"
// into a crash on boot, which is the same trap the Firecrawl client used to have.

// SUPERMEMORY_API_KEY is what the SDK itself reads; SUPERMEMORY_APIKEY is accepted
// so existing local .env files keep working.
const apiKey = process.env.SUPERMEMORY_API_KEY || process.env.SUPERMEMORY_APIKEY;
const baseURL = process.env.SUPERMEMORY_BASE_URL;

let clientPromise: Promise<Supermemory> | undefined;

export function getClient(): Promise<Supermemory> {
    clientPromise ??= (async () => {
        if (baseURL) {
            console.log(`Supermemory: ${baseURL}`);
            return new Supermemory({ apiKey: apiKey ?? "local", baseURL });
        }
        if (apiKey) {
            console.log("Supermemory: cloud");
            return new Supermemory({ apiKey });
        }
        console.log("Supermemory: local (starting server if needed)");
        // installs + starts the CLI server when it isn't already reachable, then
        // waits for it to answer. Note it is spawned detached, so it outlives us.
        return Supermemory.local();
    })();
    return clientPromise;
}

/** Which backend the next call will use, without constructing a client. */
export const supermemoryMode = baseURL ? "self-hosted" : apiKey ? "cloud" : "local";

interface IngestionType{
    content:string,
    userId:string,
    convId?:string,
    metadata?: {[key: string]: string | number | boolean | string[]}
}


// can use this to add a new memory or update one
export async function ingestionMemory({content,convId,userId,metadata}:IngestionType){
    try {
        const client = await getClient();
        await client.add({
            content:content,
            containerTag:userId,
            // convId identifies a conversation, not a document — passing it as
            // customId would make every memory from one conversation overwrite the
            // last. Kept as metadata so the link survives without collapsing rows.
            metadata:{...metadata, ...(convId ? {convId} : {})}
        })
    } catch (error) {
        console.error(error);
        throw new Error("Failed to add into the memory",{ cause:error });
    }
}

interface SearchType{
    q:string,
    userId:string,
    searchMode:"memories"|"hybrid" |"documents",
    limit?:number,
    threshold?:number, // similarity search like btw 0-1,
    rerank?:boolean,
    filters?:Supermemory.Search.SearchMemoriesParams.Or | Supermemory.Search.SearchMemoriesParams.And,
    includes?:object
}

export async function searchMemory({
    q,
    searchMode="hybrid",
    userId,
    filters,
    includes,
    limit=10,
    rerank=false,
    threshold=0.5}:SearchType){
    try {
        const client = await getClient();
        const results = await client.search({
            q,
            searchMode,
            containerTag:userId,
            filters,
            include:includes,
            limit,
            rerank,
            threshold
        });

        return results;
    } catch (error) {
        console.error(error);
        throw new Error("Failed to search the knowledge Base",{ cause:error });
    }
}

// upload files
interface UploadType{
    path:fs.PathLike,
    metadata?:string,
    userId:string,
    tasktype?:"memory"|"superrag"
}
export async function uploadFile({path,userId,tasktype,metadata}
    :UploadType){
    try {
        const client = await getClient();
        await client.documents.uploadFile({
            file: fs.createReadStream(path),
            containerTag: userId,
            taskType:tasktype,
            metadata:metadata
        });
    } catch (error) {
        console.error(error);
        throw new Error("Failed to upload the docs",{ cause: error });
    }
}


// Document CRUD operations
interface ListDocs{
    userId:string[],
    limit?:number,
    page?:number,
    sort?: "createdAt" | "updatedAt",
    order?:"desc"|"asc"
}
export async function listDocs({userId,limit=10,order='desc',sort='updatedAt',page=1}:ListDocs){
    try {
        const client = await getClient();
        const documents = await client.documents.list({
            limit,
            order,
            sort,
            page,
            containerTags: [...userId]
        });

        return documents;
    } catch (error) {
        console.error(error);
        throw new Error("Failed to list the docs",{ cause: error });
    }
}
//update meta data only
interface UpdateMeta{
    content:string,
    docId:string,
    userId:string,
    metadata:{[key: string]: string | number | boolean | string[]}
}
export async function updateDocs({
    content,
    userId,
    docId,
    metadata}:UpdateMeta){
    try {
        const client = await getClient();
        await client.documents.update(docId,{
            content,
            metadata,
            containerTag:userId

        })
    } catch (error) {
        console.error(error);
        throw new Error("Failed to update the metadata of the doc",{ cause: error });
    }
}

export async function deleteDoc(docId:string){
    try{
        const client = await getClient();
        await client.documents.delete(docId);
    } catch(error){
        console.error(error);
        throw new Error("Failed to delete the doc",{ cause: error });
    }
}

export async function deleteDocBulk({ids}:{ids?:string[]}){
    try {
        const client = await getClient();
        await client.documents.deleteBulk({ids})
    } catch (error) {
        console.error(error);
        throw new Error("Failed to delete the docs",{ cause: error });
    }
}
