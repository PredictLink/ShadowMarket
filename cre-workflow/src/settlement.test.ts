import {
  determineMarketOutcome,
  verifyOutcomeConsensus,
  ConsensusFailureError,
} from "./settlement";

const sendRequestMock = jest.fn();

jest.mock("@chainlink/cre-sdk", () => {
  return {
    ConfidentialHTTPClient: jest.fn().mockImplementation(() => ({
      sendRequest: sendRequestMock,
    })),
  };
});

type RuntimeLike = {
  getSecret: ({ id }: { id: string }) => { result: () => { value: string } };
};

function createRuntime(secrets: Record<string, string>): RuntimeLike {
  return {
    getSecret: ({ id }: { id: string }) => ({
      result: () => ({ value: secrets[id] ?? "" }),
    }),
  };
}

function makeResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    body: Buffer.from(JSON.stringify(body)),
  };
}

const QUESTION = "Will ETH exceed $3,000 by March 2026?";
const EXPIRY = Math.floor(Date.now() / 1000) + 86400;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("determineMarketOutcome", () => {
  beforeEach(() => {
    sendRequestMock.mockReset();
  });

  it("returns a successful determination for YES outcome", async () => {
    const runtime = createRuntime({ OPENROUTER_API_KEY: "or-test-key", SERPER_API_KEY: "serper-key" });
    sendRequestMock
      .mockReturnValueOnce({
        result: async () =>
          makeResponse(200, {
            organic: [{ title: "Source", snippet: "ETH moved above threshold." }],
          }),
      })
      .mockReturnValueOnce({
        result: async () =>
          makeResponse(200, {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    outcome: true,
                    confidence: 85,
                    rationale: "ETH exceeded $3,000.",
                    sources: ["https://coinmarketcap.com"],
                  }),
                },
              },
            ],
          }),
      });

    const result = await determineMarketOutcome(runtime as any, QUESTION, EXPIRY);

    expect(result.outcome).toBe(true);
    expect(result.confidence).toBe(85);
    expect(result.rationale).toBe("ETH exceeded $3,000.");
    expect(result.sources).toEqual(["https://coinmarketcap.com"]);
  });

  it("returns a successful determination for NO outcome", async () => {
    const runtime = createRuntime({ OPENROUTER_API_KEY: "or-test-key" });
    sendRequestMock.mockReturnValueOnce({
      result: async () =>
        makeResponse(200, {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  outcome: false,
                  confidence: 90,
                  rationale: "ETH did not exceed $3,000.",
                  sources: [],
                }),
              },
            },
          ],
        }),
    });

    const result = await determineMarketOutcome(runtime as any, QUESTION, EXPIRY);
    expect(result.outcome).toBe(false);
    expect(result.confidence).toBe(90);
  });

  it("throws LOW_CONFIDENCE when confidence < 70", async () => {
    const runtime = createRuntime({ OPENROUTER_API_KEY: "or-test-key" });
    sendRequestMock.mockReturnValueOnce({
      result: async () =>
        makeResponse(200, {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  outcome: true,
                  confidence: 55,
                  rationale: "Insufficient data to confirm.",
                  sources: [],
                }),
              },
            },
          ],
        }),
    });

    await expect(determineMarketOutcome(runtime as any, QUESTION, EXPIRY)).rejects.toThrow(
      /Insufficient confidence/
    );
  });

  it("throws when AI returns non-JSON content", async () => {
    const runtime = createRuntime({ OPENROUTER_API_KEY: "or-test-key" });
    sendRequestMock.mockReturnValueOnce({
      result: async () =>
        makeResponse(200, {
          choices: [{ message: { content: "not-json" } }],
        }),
    });

    await expect(determineMarketOutcome(runtime as any, QUESTION, EXPIRY)).rejects.toThrow();
  });

  it("strips markdown fences from response", async () => {
    const runtime = createRuntime({ OPENROUTER_API_KEY: "or-test-key" });
    sendRequestMock.mockReturnValueOnce({
      result: async () =>
        makeResponse(200, {
          choices: [
            {
              message: {
                content:
                  "```json\n" +
                  JSON.stringify({ outcome: true, rationale: "OK", confidence: 80, sources: [] }) +
                  "\n```",
              },
            },
          ],
        }),
    });

    const result = await determineMarketOutcome(runtime as any, QUESTION, EXPIRY);
    expect(result.outcome).toBe(true);
  });
});

describe("verifyOutcomeConsensus", () => {
  beforeEach(() => {
    sendRequestMock.mockReset();
  });

  it("returns majority YES when 2 of 3 calls return YES", async () => {
    const runtime = createRuntime({ OPENROUTER_API_KEY: "or-test-key" });
    sendRequestMock
      .mockReturnValueOnce({
        result: async () =>
          makeResponse(200, {
            choices: [{ message: { content: JSON.stringify({ outcome: true, confidence: 85, rationale: "r1", sources: [] }) } }],
          }),
      })
      .mockReturnValueOnce({
        result: async () =>
          makeResponse(200, {
            choices: [{ message: { content: JSON.stringify({ outcome: false, confidence: 90, rationale: "r2", sources: [] }) } }],
          }),
      })
      .mockReturnValueOnce({
        result: async () =>
          makeResponse(200, {
            choices: [{ message: { content: JSON.stringify({ outcome: true, confidence: 75, rationale: "r3", sources: [] }) } }],
          }),
      });

    const result = await verifyOutcomeConsensus(runtime as any, QUESTION, EXPIRY, 3);
    expect(result.outcome).toBe(true);
  });

  it("returns majority NO when 2 of 3 calls return NO", async () => {
    const runtime = createRuntime({ OPENROUTER_API_KEY: "or-test-key" });
    sendRequestMock
      .mockReturnValueOnce({
        result: async () =>
          makeResponse(200, {
            choices: [{ message: { content: JSON.stringify({ outcome: false, confidence: 85, rationale: "r1", sources: [] }) } }],
          }),
      })
      .mockReturnValueOnce({
        result: async () =>
          makeResponse(200, {
            choices: [{ message: { content: JSON.stringify({ outcome: false, confidence: 90, rationale: "r2", sources: [] }) } }],
          }),
      })
      .mockReturnValueOnce({
        result: async () =>
          makeResponse(200, {
            choices: [{ message: { content: JSON.stringify({ outcome: true, confidence: 75, rationale: "r3", sources: [] }) } }],
          }),
      });

    const result = await verifyOutcomeConsensus(runtime as any, QUESTION, EXPIRY, 3);
    expect(result.outcome).toBe(false);
    expect(result.confidence).toBe(90);
  });

  it("throws ConsensusFailureError on tie", async () => {
    const runtime = createRuntime({ OPENROUTER_API_KEY: "or-test-key" });
    sendRequestMock
      .mockReturnValueOnce({
        result: async () =>
          makeResponse(200, {
            choices: [{ message: { content: JSON.stringify({ outcome: true, confidence: 85, rationale: "r1", sources: [] }) } }],
          }),
      })
      .mockReturnValueOnce({
        result: async () =>
          makeResponse(200, {
            choices: [{ message: { content: JSON.stringify({ outcome: false, confidence: 90, rationale: "r2", sources: [] }) } }],
          }),
      });

    await expect(verifyOutcomeConsensus(runtime as any, QUESTION, EXPIRY, 2)).rejects.toThrow(
      ConsensusFailureError
    );
  });
});
