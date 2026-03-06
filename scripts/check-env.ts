import * as https from "https";
import * as dotenv from "dotenv";

dotenv.config();

interface CheckResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: CheckResult[] = [];

function pass(name: string, message?: string) {
  results.push({ name, passed: true, message });
  console.log(`  ✓ ${name}${message ? " — " + message : ""}`);
}

function fail(name: string, message: string) {
  results.push({ name, passed: false, message });
  console.error(`  ✗ ${name} — ${message}`);
}

async function checkEnvVars() {
  const required = [
    "PRIVATE_KEY",
    "SEPOLIA_RPC_URL",
    "ETHERSCAN_API_KEY",
    "GEMINI_API_KEY",
    "CHAINLINK_CRE_DON_ID",
    "CRE_DON_ADDRESS",
  ];
  for (const key of required) {
    if (process.env[key]) {
      pass(`${key} is set`);
    } else {
      fail(`${key}`, "Not set in environment");
    }
  }
}

async function checkRpcUrl() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) {
    fail("SEPOLIA_RPC_URL validation", "Not set");
    return;
  }

  return new Promise<void>((resolve) => {
    const url = new URL(rpcUrl);
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1,
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.result) {
            pass("SEPOLIA_RPC_URL", `Block: ${parseInt(parsed.result, 16)}`);
          } else {
            fail("SEPOLIA_RPC_URL", "Invalid response");
          }
        } catch {
          fail("SEPOLIA_RPC_URL", "Failed to parse response");
        }
        resolve();
      });
    });

    req.on("error", (e) => {
      fail("SEPOLIA_RPC_URL", e.message);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

async function checkPrivateKey() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    fail("PRIVATE_KEY format", "Not set");
    return;
  }
  const cleanPk = pk.startsWith("0x") ? pk.slice(2) : pk;
  if (/^[0-9a-fA-F]{64}$/.test(cleanPk)) {
    pass("PRIVATE_KEY format", "Valid 64-char hex");
  } else {
    fail("PRIVATE_KEY format", "Must be 64 hex characters");
  }
}

async function checkGeminiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    fail("GEMINI_API_KEY validation", "Not set");
    return;
  }

  return new Promise<void>((resolve) => {
    const path = `/v1beta/models?key=${apiKey}`;
    const options = {
      hostname: "generativelanguage.googleapis.com",
      port: 443,
      path,
      method: "GET",
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        pass("GEMINI_API_KEY", "Valid (models endpoint reachable)");
      } else {
        fail("GEMINI_API_KEY", `HTTP ${res.statusCode}`);
      }
      resolve();
    });

    req.on("error", (e) => {
      fail("GEMINI_API_KEY", e.message);
      resolve();
    });

    req.end();
  });
}

async function main() {
  console.log("\nShadowMarket Environment Validation\n" + "=".repeat(40));

  console.log("\nRequired environment variables:");
  await checkEnvVars();

  console.log("\nRPC URL connectivity:");
  await checkRpcUrl();

  console.log("\nPrivate key format:");
  await checkPrivateKey();

  console.log("\nGemini API key:");
  await checkGeminiKey();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(40) + "\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
