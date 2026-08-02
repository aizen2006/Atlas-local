import Supermemory  from "supermemory";
import fs from "fs";


export const client = new Supermemory({
    apiKey:process.env.SUPERMEMORY,
    baseURL:process.env.SUPERMEMORY_BASE_URL
});

interface IngestionType{
    content:string,
    userId:string,
    convId?:string,
    metadata?: {[key: string]: string | number | boolean | string[]}
}


// can use this to add a new memory or update one
export async function ingestionMemory({content,convId,userId,metadata}:IngestionType){
    try {
        await client.add({
            content:content,
            containerTag:userId,
            customId:convId,
            metadata:metadata
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
        await client.documents.delete(docId);
    } catch(error){
        console.error(error);
        throw new Error("Failed to delete the doc",{ cause: error });
    }
}

export async function deleteDocBulk({ids}:{ids?:string[]}){
    try {
        await client.documents.deleteBulk({ids})   
    } catch (error) {
        console.error(error);
        throw new Error("Failed to delete the docs",{ cause: error });
    }
}