#!/usr/bin/env ts-node
/**
 * Local simulation script for the ShadowMarket CRE workflow.
 * Runs verifyOutcomeConsensus for a sample question and prints the result.
 * No transactions are sent (dry run).
 */
import "dotenv/config";

async function main() {
  console.log("ShadowMarket CRE Workflow — Local Simulation\n");
  console.log("=".repeat(60));

  const question = "Will Bitcoin exceed $100,000 by February 28, 2026?";
  const expiryTimestamp = Math.floor(new Date("2026-02-28T00:00:00Z").getTime() / 1000);
  const contractAddress = process.env.SHADOWMARKET_CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000";

  console.log(`\nQuestion: ${question}`);
  console.log(`Expiry:   ${new Date(expiryTimestamp * 1000).toISOString()}`);
  console.log(`Contract: ${contractAddress}\n`);

  try {
    if (process.env.CRE_SIMULATION_MODE === "mock") {
      const mocked = {
        marketId: 1,
        outcome: true,
        rationale: "Mocked simulation result for deterministic CI verification.",
        confidence: 99,
        sources: ["mock://ci-simulation"],
      };

      console.log("Running deterministic mock simulation mode...");
      console.log("\n✅ Consensus Result:");
      console.log(JSON.stringify(mocked, null, 2));
      process.exit(0);
    }

    console.log("Running consensus verification (3 Gemini calls)...");
    const { verifyOutcomeConsensus } = await import("./settlement.js");
    const runtime = {
      getSecret: ({ id }: { id: string }) => ({
        result: () => ({ value: process.env[id] ?? "" }),
      }),
    };

    const result = await verifyOutcomeConsensus(runtime as any, question, expiryTimestamp, 3);

    console.log("\n✅ Consensus Result:");
    console.log(JSON.stringify({ ...result, marketId: 1 }, null, 2));

    console.log("\n📋 Dry Run — EVM write call would contain:");
    console.log(
      JSON.stringify(
        {
          function: "settleMarket(uint256,bool,string)",
          args: {
            marketId: 1,
            outcome: result.outcome,
            rationale: result.rationale,
          },
          to: contractAddress,
          note: "DRY RUN — no transaction sent",
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error("\n❌ Simulation failed:", (err as Error).message);
    process.exit(1);
  }
}

main();
