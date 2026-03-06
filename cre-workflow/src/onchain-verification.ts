import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { verifyOutcomeConsensus } from "./settlement.js";

dotenv.config({ path: "../.env" });
dotenv.config();

async function main() {
    console.log("ShadowMarket — On-Chain CRE Workflow Verification\n");

    const rpc = process.env.SEPOLIA_RPC_URL;
    const pk = process.env.PRIVATE_KEY;
    const contractAddress = "0x3881DFC77ABFc85b4aDe32D998FA2fd2229F7290";

    if (!rpc || !pk) throw new Error("RPC or PRIVATE_KEY missing");

    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(pk, provider);

    const shadowMarket = new ethers.Contract(contractAddress, [
        "function getMarket(uint256) external view returns (tuple(uint256 id, string question, uint256 expiryTimestamp, uint8 status, bool outcome, uint256 totalYesPool, uint256 totalNoPool, uint256 totalBids, string settlementRationale))",
        "function onReport(bytes calldata report, bytes calldata signature) external",
        "event MarketExpired(uint256 indexed marketId, string question, uint256 expiry)"
    ], wallet);

    // Use Market from argument or #1
    const argMarketId = process.argv[2];
    const marketId = argMarketId ? BigInt(argMarketId) : 1n;
    console.log(`Verifying Market #${marketId}...`);

    const market = await shadowMarket.getMarket(marketId);
    console.log(`Question: ${market.question}`);
    console.log(`Status: ${market.status} (1 = RESOLVING)`);

    // 1. Run AI Consensus logic
    console.log("\n[CRE Node Simulation] Running AI Consensus...");

    const mockRuntime = {
        getSecret: (req: { id: string }) => ({
            result: () => ({ value: process.env[req.id] })
        }),
        callCapability: (call: any) => {
            const { capabilityId, method, payload } = call;
            return {
                result: () => {
                    return (async () => {
                        if (capabilityId.includes("confidential-http") && (method === "sendRequest" || method === "SendRequest")) {
                            const request = payload;
                            const url = request.url || (request.request && request.request.url);
                            const httpMethod = request.method || (request.request && request.request.method) || "POST";
                            let body = "";
                            const rBody = request.body || (request.request && request.request.body);
                            if (rBody && rBody.case) {
                                if (rBody.case === 'bodyString') body = rBody.value;
                                else if (rBody.case === 'bodyBytes') body = Buffer.from(rBody.value).toString('utf-8');
                            } else {
                                body = request.bodyString || (request.request && request.request.bodyString);
                                if (!body) {
                                    const bytes = request.bodyBytes || (request.request && request.request.bodyBytes);
                                    if (bytes) body = Buffer.from(bytes).toString('utf-8');
                                }
                            }


                            const multiHeaders = request.multiHeaders || (request.request && request.request.multiHeaders);

                            if (!url) throw new Error("URL missing in mock payload");

                            const headers: Record<string, string> = {};
                            if (multiHeaders) {
                                for (const [k, v] of Object.entries(multiHeaders)) {
                                    const val = (v as any).values ? (v as any).values[0] : (Array.isArray(v) ? v[0] : (v as any));
                                    if (val) headers[k] = val;
                                }
                            }

                            const res = await fetch(url, {
                                method: httpMethod,
                                headers: headers,
                                body: body,
                            });

                            const bodyText = await res.text();
                            return {
                                statusCode: res.status,
                                body: Buffer.from(bodyText),
                            };
                        }
                        throw new Error(`Unmocked capability: ${capabilityId}.${method}`);
                    })();
                }
            };
        }
    } as any;

    try {
        const result = await verifyOutcomeConsensus(mockRuntime, market.question, Number(market.expiryTimestamp), 1);
        console.log(`Result: ${result.outcome ? "YES" : "NO"}`);
        console.log(`Rationale: ${result.rationale}`);

        // 2. Encode the Report
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const reportPayload = abiCoder.encode(
            ["uint256", "bool", "string"],
            [marketId, result.outcome, result.rationale]
        );

        // 3. Submit On-Chain
        console.log("\n[On-Chain] Submitting settlement report to ShadowMarket.onReport...");
        const dummySignature = "0x";

        const tx = await shadowMarket.onReport(reportPayload, dummySignature);
        console.log(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Settlement confirmed in block ${receipt.blockNumber}!`);

        // Verify final state
        const marketFinal = await shadowMarket.getMarket(marketId);
        console.log(`\nFinal Market Status: ${marketFinal.status} (2 = SETTLED)`);
        console.log(`Final Outcome: ${marketFinal.outcome ? "YES" : "NO"}`);

    } catch (err: any) {
        console.error(`\n❌ AI/Consensus Error: ${err.message}`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("\n❌ Setup Error:", err.message);
    process.exit(1);
});
