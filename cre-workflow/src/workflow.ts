import { cre, EVMClient, EVMLog } from "@chainlink/cre-sdk";
import {
  parseAbi,
  encodeAbiParameters,
  decodeFunctionResult,
  encodeFunctionData,
  Address,
  hexToBigInt,
  toHex,
} from "viem";
import { SettlementResult } from "./types";
import { verifyOutcomeConsensus } from "./settlement";

// ─── Constants & ABIs ────────────────────────────────────────────────────────

const SHADOWMARKET_ABI = parseAbi([
  "function getMarket(uint256 marketId) external view returns (tuple(uint256 id, string question, uint256 expiryTimestamp, uint8 status, bool outcome, uint256 totalYesPool, uint256 totalNoPool, uint256 totalBids, string settlementRationale))",
  "function onReport(bytes calldata report, bytes calldata signature) external",
]);

const SEPOLIA_CHAIN_SELECTOR = 16015286601757825753n;
const evm = new EVMClient(SEPOLIA_CHAIN_SELECTOR);

// ─── Trigger Configuration ───────────────────────────────────────────────────

const trigger = evm.logTrigger({
  addresses: [], // populated via trigger registry or env
  topics: [
    { values: [toHex(parseAbi(["event MarketExpired(uint256 indexed marketId, string question, uint256 expiry)"])[0].name)] }
  ],
});

// ─── Workflow Logic ──────────────────────────────────────────────────────────

const workflowFn = async (runtime: any, log: EVMLog) => {
  const contractAddress = toHex(log.address) as Address;

  // 1. Decode trigger log manually (SDK gives raw Log)
  const marketId = hexToBigInt(toHex(log.topics[1]));

  console.log(`Processing resolution for Market #${marketId}`);

  // 2. Fetch market details via evm_read
  const readData = encodeFunctionData({
    abi: SHADOWMARKET_ABI,
    functionName: "getMarket",
    args: [marketId],
  });

  const readResultMsg = evm.callContract(runtime, {
    call: {
      to: contractAddress,
      data: readData,
    }
  }).result();

  const marketDataHex = toHex(readResultMsg.data);
  const market = decodeFunctionResult({
    abi: SHADOWMARKET_ABI,
    functionName: "getMarket",
    data: marketDataHex,
  }) as any;

  // status 1 = RESOLVING, status 2 = SETTLED
  if (market.status === 2) {
    console.log(`Market ${marketId} already settled. Skipping.`);
    return { status: "skipped" };
  }

  // 3. Determine outcome via AI consensus
  const settlement: SettlementResult = await verifyOutcomeConsensus(
    runtime,
    market.question,
    Number(market.expiryTimestamp),
    3
  );

  console.log(`Consensus: Outcome=${settlement.outcome}, Confidence=${settlement.confidence}%`);

  // 4. Generate signed report
  const reportPayload = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "bool" },
      { type: "string" }
    ],
    [marketId, settlement.outcome, settlement.rationale]
  );

  const { result: report } = runtime.report({
    encodedPayload: Buffer.from(reportPayload.slice(2), "hex").toString("base64"),
  }).result();

  // 5. Submit report back on-chain
  console.log(`Submitting on-chain settlement for Market ${marketId}...`);

  await evm.writeReport(runtime, {
    receiver: Buffer.from(contractAddress.slice(2), "hex").toString("base64"),
    report: report,
    $report: true,
  } as any).result();

  console.log(`Market ${marketId} successfully settled.`);
  return { status: "settled", marketId: marketId.toString() };
};

// ─── Export Workflow ─────────────────────────────────────────────────────────

export default cre.handler(trigger, workflowFn);
