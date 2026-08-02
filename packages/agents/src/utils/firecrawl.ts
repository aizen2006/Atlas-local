import { Firecrawl } from 'firecrawl';

// env comes from the host process — the server entry point owns .env loading,
// so this package never reaches for a config module of its own.

// Firecrawl is optional: Atlas's core loop runs without web research. Building
// the client eagerly turned a missing optional key into a hard boot failure, so
// it is constructed on first use instead and the web tools are simply left out
// of the agent when the key is absent (see main.agent.ts).
export const hasFirecrawl = Boolean(process.env.FIRECRAWL_API_KEY);

let client: Firecrawl | undefined;

export function getFirecrawl(): Firecrawl {
    if (!process.env.FIRECRAWL_API_KEY) {
        throw new Error(
            "Web research is unavailable: FIRECRAWL_API_KEY is not set. Add it to .env at the repo root to enable webSearch, webScrape and agenticSearch.",
        );
    }
    client ??= new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
    return client;
}
