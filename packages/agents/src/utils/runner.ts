import {
    Runner,
    type Agent,
    type AgentOutputType,
} from "@openai/agents";


const runner = new Runner();

/**
 * Run an agent and return its final structured/text output.
 */
export async function runAgent<
    TContext,
    TOutput extends AgentOutputType<TContext>
>(
    agent: Agent<TContext, TOutput>,
    prompt: string,
) {
    const result = await runner.run(agent, prompt);

    return result.finalOutput;
}

/**
 * Run an agent in streaming mode and return a Node.js Readable stream.
 */
export async function runAgentStream<
    TContext,
    TOutput extends AgentOutputType<TContext>
>(
    agent: Agent<TContext, TOutput>,
    prompt: string,
) {
    const result = await runner.run(agent, prompt, {
        stream: true,
    });

    const stream = result.toTextStream({
        compatibleWithNodeStreams: true,
    });

    if (!stream) {
        throw new Error("Failed to create text stream.");
    }

    return stream;
}