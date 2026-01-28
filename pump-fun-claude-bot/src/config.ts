import dotenv from "dotenv";

dotenv.config();

export const config = {
  // Anthropic
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",

  // Solana
  solanaRpcUrl:
    process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY || "",

  // Pump.fun
  pumpfunApiUrl: process.env.PUMPFUN_API_URL || "https://frontend-api.pump.fun",
  pumpfunWsUrl: "wss://pumpportal.fun/api/data",

  // Trading
  maxBuyAmount: parseFloat(process.env.MAX_BUY_AMOUNT || "0.1"),
  slippageBps: parseInt(process.env.SLIPPAGE_BPS || "500", 10),

  // Monitoring
  monitorIntervalMs: parseInt(process.env.MONITOR_INTERVAL_MS || "5000", 10),
};

export function validateConfig(): void {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }
}

export function validateTradingConfig(): void {
  validateConfig();
  if (!config.solanaPrivateKey) {
    throw new Error("SOLANA_PRIVATE_KEY is required for trading");
  }
}
