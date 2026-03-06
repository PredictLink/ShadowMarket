import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const SHADOWMARKET_ABI = [
  "function createMarket(string calldata question, uint256 expiryTimestamp) external returns (uint256)",
  "function submitSealedBid(uint256 marketId, bytes32 commitmentHash) external",
  "function revealBid(uint256 marketId, uint256 amount, bool side, bytes32 salt) external",
  "function settleMarket(uint256 marketId, bool outcome, string calldata rationale) external",
  "function claimWinnings(uint256 marketId) external",
  "function getMarket(uint256 marketId) external view returns (tuple(uint256 id, string question, uint256 expiryTimestamp, uint8 status, bool outcome, uint256 totalYesPool, uint256 totalNoPool, uint256 totalBids, string settlementRationale))",
  "function marketIdCounter() external view returns (uint256)",
];

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1] ?? "true";
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const command = args.command ?? args._?.[0];

  if (!command) {
    console.log(`
Usage: npx ts-node scripts/interact.ts --command <cmd> [options]

Commands:
  create-market   --question "..." --expiry <unix-ts>
  submit-bid      --market-id <n> --commitment <0x...>
  reveal-bid      --market-id <n> --amount <n> --side yes|no --salt <hex>
  settle-market   --market-id <n> --outcome yes|no --rationale "..."
  claim           --market-id <n>
`);
    return;
  }

  const rpc = process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set");

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const contractAddress = process.env.SHADOWMARKET_CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error("SHADOWMARKET_CONTRACT_ADDRESS not set");

  const contract = new ethers.Contract(contractAddress, SHADOWMARKET_ABI, wallet);

  switch (command) {
    case "create-market": {
      const question = args.question;
      const expiry = parseInt(args.expiry);
      if (!question || !expiry) throw new Error("--question and --expiry required");
      const tx = await contract.createMarket(question, expiry);
      const receipt = await tx.wait();
      console.log(`Market created! Tx: ${receipt.hash}`);
      break;
    }
    case "submit-bid": {
      const marketId = parseInt(args["market-id"]);
      const commitment = args.commitment;
      if (!marketId || !commitment) throw new Error("--market-id and --commitment required");
      const tx = await contract.submitSealedBid(marketId, commitment);
      const receipt = await tx.wait();
      console.log(`Sealed bid submitted! Tx: ${receipt.hash}`);
      break;
    }
    case "reveal-bid": {
      const marketId = parseInt(args["market-id"]);
      const amount = ethers.parseUnits(args.amount, 6);
      const side = args.side?.toLowerCase() === "yes";
      const salt = args.salt;
      if (!marketId || !args.amount || !args.side || !salt)
        throw new Error("--market-id, --amount, --side, --salt required");
      const tx = await contract.revealBid(marketId, amount, side, salt);
      const receipt = await tx.wait();
      console.log(`Bid revealed! Tx: ${receipt.hash}`);
      break;
    }
    case "settle-market": {
      const marketId = parseInt(args["market-id"]);
      const outcome = args.outcome?.toLowerCase() === "yes";
      const rationale = args.rationale;
      if (!marketId || !args.outcome || !rationale)
        throw new Error("--market-id, --outcome, --rationale required");
      const tx = await contract.settleMarket(marketId, outcome, rationale);
      const receipt = await tx.wait();
      console.log(`Market settled! Tx: ${receipt.hash}`);
      break;
    }
    case "claim": {
      const marketId = parseInt(args["market-id"]);
      if (!marketId) throw new Error("--market-id required");
      const tx = await contract.claimWinnings(marketId);
      const receipt = await tx.wait();
      console.log(`Winnings claimed! Tx: ${receipt.hash}`);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
