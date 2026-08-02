import { tool ,type Tool} from "@openai/agents"
import { z } from "zod"
import { getFirecrawl } from "../utils/firecrawl"

export const webSearch:Tool = tool({
    name:"WebSearch tool",
    description:`Search the web for current information and return structured results.
    Prefer this tool when answering questions that require recent events,
    external knowledge, news, or information not available in the model's context.
    `,
    parameters:z.object({
        query:z.string(),
        depth:z.enum(['normal','fast','advanced']).default("normal").optional().describe("The Web Search depth"),
        sources:z.enum(["web","news","images"]).default("web").optional()
    }),
    async execute({query,depth,sources}){
        let limit;
        depth == "advanced"?limit=10:depth == 'normal'?limit=5:limit=3 ;
        if(!sources) return Error("Please enter Source")
        try {
            const response = await getFirecrawl().search(query,{
                limit:limit,
                sources:[sources]
            })
            return response.web
        } catch (error) {
            return error
        }
    }
});

export const webScrape :Tool = tool({
    name:'webscraping tool',
    description: `
        Retrieve and extract content from a known webpage URL.
        Use this tool after obtaining a URL from search results when deeper context or full page contents are needed.
        `,
    parameters:z.object({
        url:z.string()
    }),
    async execute({url}){
        try {
            const res = await getFirecrawl().scrape(url);
            return res
        } catch (error) {
            return error
        }
    }
});

export const agenticSearch :Tool = tool({
    name:"agenticSearch tool",
    description: `
        Conduct deep, multi-step web research and synthesize findings.
        Use this tool for complex questions, comparisons, and analysis that cannot be answered with a simple search.
        Optionally focus research on provided URLs.
        `,
    parameters:z.object({
        prompt:z.string(),
        url:z.string().array().optional(),
        model:z.enum(["spark-1-mini","spark-1-pro",]).default('spark-1-mini')
    }),
    async execute({prompt,url,model}){
        if(!url){
            try {
                const res = await getFirecrawl().agent({
                    prompt:prompt,
                    model
                });
                return res.data
            } catch (error) {
                return error
            }
        }else{
            try {
                const res = await getFirecrawl().agent({
                    prompt:prompt,
                    model,
                    urls:url
                });
                return res.data
            } catch (error) {
                return error
            }
        }
        
    }
})