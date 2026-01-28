import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import type { PumpFunToken, TokenAnalysis } from "./types.js";

export class ClaudeAnalyzer {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  async analyzeToken(token: PumpFunToken): Promise<TokenAnalysis> {
    const tokenData = this.formatTokenData(token);

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a crypto token analyst specializing in pump.fun meme coins on Solana. Analyze this token and provide a risk assessment.

TOKEN DATA:
${tokenData}

Provide your analysis in the following JSON format:
{
  "riskScore": <number 1-10, where 10 is highest risk>,
  "sentiment": "<bullish|bearish|neutral>",
  "summary": "<2-3 sentence summary>",
  "redFlags": ["<list of concerns>"],
  "greenFlags": ["<list of positive indicators>"],
  "recommendation": "<brief recommendation>"
}

Consider these factors:
- Token name/symbol (scammy names, impersonation attempts)
- Social links present (twitter, telegram, website)
- Market cap and liquidity
- Creator history
- Whether it has graduated to Raydium
- Reply/engagement count
- Time since creation
- Any signs of rug pull potential

Respond ONLY with the JSON object, no other text.`,
        },
      ],
    });

    try {
      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      const analysis = JSON.parse(content.text);
      return {
        token,
        ...analysis,
      };
    } catch {
      return {
        token,
        riskScore: 5,
        sentiment: "neutral",
        summary: "Unable to parse analysis. Manual review recommended.",
        redFlags: ["Analysis parsing failed"],
        greenFlags: [],
        recommendation: "Proceed with extreme caution",
      };
    }
  }

  async askAboutToken(token: PumpFunToken, question: string): Promise<string> {
    const tokenData = this.formatTokenData(token);

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are a crypto analyst. Here is data about a pump.fun token:

${tokenData}

User question: ${question}

Provide a helpful, concise answer based on the token data. Be honest about risks and avoid giving financial advice.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return "Unable to generate response";
    }
    return content.text;
  }

  async compareTokens(tokens: PumpFunToken[]): Promise<string> {
    const tokenDataList = tokens
      .map((t, i) => `Token ${i + 1}:\n${this.formatTokenData(t)}`)
      .join("\n\n---\n\n");

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Compare these pump.fun tokens and rank them by potential (lower risk, better indicators):

${tokenDataList}

Provide a comparison table and ranking with brief justifications. Focus on key differentiators and risk factors.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return "Unable to generate comparison";
    }
    return content.text;
  }

  private formatTokenData(token: PumpFunToken): string {
    const ageMinutes = Math.floor(
      (Date.now() - token.created_timestamp) / 60000
    );
    const ageFormatted =
      ageMinutes < 60
        ? `${ageMinutes} minutes`
        : `${Math.floor(ageMinutes / 60)} hours ${ageMinutes % 60} minutes`;

    return `
Name: ${token.name}
Symbol: ${token.symbol}
Mint Address: ${token.mint}
Description: ${token.description || "None provided"}

Market Data:
- Market Cap (SOL): ${(token.market_cap || 0).toFixed(4)}
- Market Cap (USD): $${(token.usd_market_cap || 0).toFixed(2)}
- Virtual SOL Reserves: ${(token.virtual_sol_reserves / 1e9).toFixed(4)} SOL
- Virtual Token Reserves: ${(token.virtual_token_reserves / 1e6).toFixed(2)}M
- Total Supply: ${(token.total_supply / 1e6).toFixed(2)}M

Social Links:
- Twitter: ${token.twitter || "None"}
- Telegram: ${token.telegram || "None"}
- Website: ${token.website || "None"}

Status:
- Age: ${ageFormatted}
- Graduated to Raydium: ${token.complete ? "Yes" : "No"}
- Raydium Pool: ${token.raydium_pool || "None"}
- Reply Count: ${token.reply_count || 0}
- Currently Live: ${token.is_currently_live ? "Yes" : "No"}
- King of the Hill: ${token.king_of_the_hill_timestamp ? "Yes" : "No"}

Creator: ${token.creator}
Bonding Curve: ${token.bonding_curve}
    `.trim();
  }
}
