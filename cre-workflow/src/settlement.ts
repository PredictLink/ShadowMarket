import { cre, Runtime, ConfidentialHTTPClient } from "@chainlink/cre-sdk";
import { SettlementResult } from "./types.js";

const confidentialHttp = new ConfidentialHTTPClient();

export class ConsensusFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsensusFailureError";
  }
}

/**
 * Searches for real-world information using Serper.dev.
 * This is a core part of the "full" prediction market demo.
 */
async function searchWeb(runtime: Runtime<unknown>, query: string): Promise<string> {
  let secret;
  try {
    secret = runtime.getSecret({ id: "SERPER_API_KEY" }).result();
  } catch (e) {
    console.warn("SERPER_API_KEY not found in secrets. Falling back to AI internal knowledge.");
    return "";
  }

  if (!secret || !secret.value) {
    console.warn("SERPER_API_KEY is empty. Falling back to AI internal knowledge.");
    return "";
  }

  try {
    const response = await confidentialHttp.sendRequest(runtime, {
      request: {
        url: "https://google.serper.dev/search",
        method: "POST",
        bodyString: JSON.stringify({ q: query, gl: "us", hl: "en" }),
        multiHeaders: {
          "X-API-KEY": { values: [secret.value] },
          "Content-Type": { values: ["application/json"] },
        },
      },
    }).result();

    if (response.statusCode !== 200) {
      console.warn(`Search API failed (${response.statusCode}). Falling back.`);
      return "";
    }

    const raw = Buffer.from(response.body).toString();
    const data = JSON.parse(raw);

    // Extract snippets for the AI to process
    return data.organic?.map((res: any) => `- ${res.title}: ${res.snippet}`).join("\n") ?? "";
  } catch (e) {
    console.warn("Search request failed. Falling back.");
    return "";
  }
}

/**
 * Use Gemini 2.5 Flash Lite (via OpenRouter) to determine market outcome.
 * Implements the "Full Demo" grounding pattern for ShadowMarket (Private).
 */
export async function determineMarketOutcome(
  runtime: Runtime<unknown>,
  question: string,
  expiryTimestamp: number
): Promise<SettlementResult> {
  const secret = runtime.getSecret({ id: "OPENROUTER_API_KEY" }).result();
  const apiKey = secret.value;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY secret is not set");

  // 1. Gather Grounding Information (Search)
  // This step fetches decentralized evidence while keeping the query confidential within the DON.
  console.log(`Searching for info on: "${question}"`);
  const searchResults = await searchWeb(runtime, question);

  const expiryDate = new Date(expiryTimestamp * 1000).toISOString();
  const now = new Date().toISOString();

  // 2. AI Reasoning over search results
  // We use the specified Gemini 2.5 Flash Lite model via OpenRouter.
  const systemInstruction = `You are the primary settlement engine for ShadowMarket, a private prediction market.
Your role is to act as an impartial, high-fidelity oracle. 

Private Context:
ShadowMarket participants submit bids privately via commitments. Your resolution logic must be based strictly on publicly verifiable facts, ensuring that the private bidding process remains fair and unmanipulated.

Guidelines:
- Analyze the Search Evidence provided.
- Determine if the specified outcome happened by the Expiry Date.
- Provide a clear, detailed rationale.
- Report confidence as a percentage (0-100).

Output JSON only:
{ 
  "outcome": boolean, 
  "rationale": string, 
  "confidence": number, 
  "sources": string[] 
}`;

  const userPrompt = `Market Question: ${question}
Expiry Date: ${expiryDate}
Current Time: ${now}

Search Evidence:
${searchResults}

Based on the evidence, did the YES outcome occur by the expiry date?`;

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ]
  };

  const response = await confidentialHttp.sendRequest(runtime, {
    request: {
      url: "https://openrouter.ai/api/v1/chat/completions",
      method: "POST",
      bodyString: JSON.stringify(body),
      multiHeaders: {
        "Content-Type": { values: ["application/json"] },
        "Authorization": { values: [`Bearer ${apiKey}`] },
        "X-Title": { values: ["ShadowMarket CRE Settlement"] }
      },
    },
  }).result();

  const responseBody = (response as any).body || (response as any).body_bytes;
  if (response.statusCode !== 200 || !responseBody) {
    const errorMsg = responseBody ? Buffer.from(responseBody).toString() : "No response body";
    throw new Error(`AI Request failed with status ${response.statusCode}: ${errorMsg}`);
  }

  const raw = Buffer.from(responseBody).toString();
  const resJson = JSON.parse(raw);
  let content = resJson.choices?.[0]?.message?.content;

  if (!content) throw new Error(`Empty response from AI engine for question: ${question}`);

  // Strip markdown formatting if present
  content = content.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(content);

  // Demo standard: reject low-confidence settlements
  if (parsed.confidence < 75) {
    throw new Error(`Insufficient confidence for deterministic settlement: ${parsed.confidence}%`);
  }

  return {
    marketId: 0,
    outcome: parsed.outcome,
    rationale: parsed.rationale,
    confidence: parsed.confidence,
    sources: parsed.sources ?? [],
  };
}

/**
 * Robust consensus mechanism for decentralized settlement across multiple simulated AI nodes.
 */
export async function verifyOutcomeConsensus(
  runtime: Runtime<unknown>,
  question: string,
  expiryTimestamp: number,
  attempts: number = 3
): Promise<SettlementResult> {
  const results: SettlementResult[] = [];

  for (let i = 0; i < attempts; i++) {
    try {
      const result = await determineMarketOutcome(runtime, question, expiryTimestamp);
      results.push(result);
    } catch (err) {
      console.warn(`Consensus failure on node index ${i}: ${err}`);
      if (i === attempts - 1 && results.length === 0) throw err;
    }
  }

  if (results.length === 0) throw new Error("Zero valid results retrieved from AI settlement engine.");

  const yesResults = results.filter(r => r.outcome === true);
  const noResults = results.filter(r => r.outcome === false);

  if (yesResults.length === noResults.length) {
    throw new ConsensusFailureError(`Consensus split on Market: ${question}. Manual intervention or re-execution required.`);
  }

  // Pick the consensus majority
  const majority = yesResults.length > noResults.length ? yesResults : noResults;

  // Return the result with the highest confidence from the majority
  return majority.reduce((p, c) => (c.confidence > p.confidence ? c : p));
}
