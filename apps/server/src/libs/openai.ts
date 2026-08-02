import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) throw new Error("Failed to Load OpenAi Key");

export const openai: OpenAI = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
