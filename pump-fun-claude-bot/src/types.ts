export interface PumpFunToken {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  metadata_uri: string;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  bonding_curve: string;
  associated_bonding_curve: string;
  creator: string;
  created_timestamp: number;
  raydium_pool: string | null;
  complete: boolean;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  total_supply: number;
  market_cap: number;
  usd_market_cap: number;
  reply_count: number;
  last_reply: number | null;
  king_of_the_hill_timestamp: number | null;
  is_currently_live: boolean;
}

export interface TokenAnalysis {
  token: PumpFunToken;
  riskScore: number;
  sentiment: "bullish" | "bearish" | "neutral";
  summary: string;
  redFlags: string[];
  greenFlags: string[];
  recommendation: string;
}

export interface TradeResult {
  success: boolean;
  signature?: string;
  error?: string;
  amountIn: number;
  amountOut?: number;
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
}

export interface NewTokenEvent {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: "create";
  initialBuy: number;
  bondingCurveKey: string;
  vTokensInBondingCurve: number;
  vSolInBondingCurve: number;
  marketCapSol: number;
  name: string;
  symbol: string;
  uri: string;
}

export interface TradeEvent {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: "buy" | "sell";
  tokenAmount: number;
  solAmount: number;
  bondingCurveKey: string;
  vTokensInBondingCurve: number;
  vSolInBondingCurve: number;
  marketCapSol: number;
}
