import { Firecrawl } from 'firecrawl';

// env comes from the host process — the server entry point owns .env loading,
// so this package never reaches for a config module of its own.
if(!process.env.FIRECRAWL_API_KEY) {
    throw Error("The Firecrawl api key is empty");
}

export const firecrawl = new Firecrawl({apiKey:process.env.FIRECRAWL_API_KEY!})