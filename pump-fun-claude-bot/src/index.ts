#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { config, validateConfig, validateTradingConfig } from "./config.js";
import { PumpFunAPI } from "./pumpfun-api.js";
import { PumpFunWebSocket } from "./websocket-monitor.js";
import { ClaudeAnalyzer } from "./claude-analyzer.js";
import { SolanaTrader } from "./solana-trader.js";
import type { NewTokenEvent, PumpFunToken } from "./types.js";
import * as readline from "readline";

const program = new Command();

program
  .name("pump-fun-claude-bot")
  .description("Claude AI-powered pump.fun token analyzer and trader")
  .version("1.0.0");

// Monitor command - watch for new tokens
program
  .command("monitor")
  .description("Monitor new token launches on pump.fun")
  .option("-a, --analyze", "Auto-analyze new tokens with Claude")
  .option("-f, --filter <minMcap>", "Minimum market cap in SOL", "0")
  .action(async (options) => {
    console.log(chalk.cyan("\n🔍 Starting pump.fun token monitor...\n"));

    if (options.analyze) {
      validateConfig();
    }

    const ws = new PumpFunWebSocket();
    const api = new PumpFunAPI();
    const analyzer = options.analyze ? new ClaudeAnalyzer() : null;

    await ws.connect();

    ws.subscribeToNewTokens(async (event: NewTokenEvent) => {
      console.log(chalk.green("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
      console.log(chalk.yellow.bold(`🆕 New Token Detected!`));
      console.log(chalk.white(`   Name: ${event.name}`));
      console.log(chalk.white(`   Symbol: ${event.symbol}`));
      console.log(chalk.white(`   Mint: ${event.mint}`));
      console.log(
        chalk.white(`   Market Cap: ${event.marketCapSol.toFixed(4)} SOL`)
      );
      console.log(
        chalk.white(`   Initial Buy: ${event.initialBuy.toFixed(4)} SOL`)
      );

      if (
        options.filter &&
        event.marketCapSol < parseFloat(options.filter)
      ) {
        console.log(chalk.gray(`   [Skipped - below market cap filter]`));
        return;
      }

      if (analyzer) {
        const spinner = ora("Analyzing with Claude...").start();
        try {
          const token = await api.getToken(event.mint);
          if (token) {
            const analysis = await analyzer.analyzeToken(token);
            spinner.stop();
            console.log(chalk.cyan("\n📊 Claude Analysis:"));
            console.log(
              chalk.white(`   Risk Score: ${getRiskColor(analysis.riskScore)}`)
            );
            console.log(chalk.white(`   Sentiment: ${analysis.sentiment}`));
            console.log(chalk.white(`   Summary: ${analysis.summary}`));
            if (analysis.redFlags.length > 0) {
              console.log(chalk.red(`   Red Flags: ${analysis.redFlags.join(", ")}`));
            }
            if (analysis.greenFlags.length > 0) {
              console.log(
                chalk.green(`   Green Flags: ${analysis.greenFlags.join(", ")}`)
              );
            }
          }
        } catch (error) {
          spinner.fail("Analysis failed");
          console.error(error);
        }
      }
    });

    console.log(chalk.gray("Press Ctrl+C to stop monitoring\n"));

    process.on("SIGINT", () => {
      console.log(chalk.yellow("\nStopping monitor..."));
      ws.disconnect();
      process.exit(0);
    });
  });

// Analyze command - analyze a specific token
program
  .command("analyze <mintAddress>")
  .description("Analyze a specific token with Claude AI")
  .option("-q, --question <question>", "Ask a specific question about the token")
  .action(async (mintAddress: string, options) => {
    validateConfig();

    const spinner = ora("Fetching token data...").start();
    const api = new PumpFunAPI();
    const analyzer = new ClaudeAnalyzer();

    const token = await api.getToken(mintAddress);

    if (!token) {
      spinner.fail("Token not found");
      return;
    }

    spinner.text = "Analyzing with Claude...";

    try {
      if (options.question) {
        const answer = await analyzer.askAboutToken(token, options.question);
        spinner.stop();
        console.log(chalk.cyan("\n📊 Token Info:"));
        printTokenInfo(token);
        console.log(chalk.cyan("\n💬 Claude's Answer:"));
        console.log(chalk.white(answer));
      } else {
        const analysis = await analyzer.analyzeToken(token);
        spinner.stop();
        console.log(chalk.cyan("\n📊 Token Analysis:"));
        printTokenInfo(token);
        console.log(chalk.cyan("\n🤖 Claude's Analysis:"));
        console.log(
          chalk.white(`   Risk Score: ${getRiskColor(analysis.riskScore)}`)
        );
        console.log(chalk.white(`   Sentiment: ${analysis.sentiment}`));
        console.log(chalk.white(`   Summary: ${analysis.summary}`));
        if (analysis.redFlags.length > 0) {
          console.log(chalk.red("\n   ⚠️ Red Flags:"));
          analysis.redFlags.forEach((flag) =>
            console.log(chalk.red(`      - ${flag}`))
          );
        }
        if (analysis.greenFlags.length > 0) {
          console.log(chalk.green("\n   ✅ Green Flags:"));
          analysis.greenFlags.forEach((flag) =>
            console.log(chalk.green(`      - ${flag}`))
          );
        }
        console.log(
          chalk.yellow(`\n   📝 Recommendation: ${analysis.recommendation}`)
        );
      }
    } catch (error) {
      spinner.fail("Analysis failed");
      console.error(error);
    }
  });

// Latest command - show latest tokens
program
  .command("latest")
  .description("Show latest tokens on pump.fun")
  .option("-l, --limit <number>", "Number of tokens to show", "10")
  .option("-a, --analyze", "Analyze top tokens with Claude")
  .action(async (options) => {
    const spinner = ora("Fetching latest tokens...").start();
    const api = new PumpFunAPI();
    const tokens = await api.getLatestTokens(parseInt(options.limit, 10));

    spinner.stop();

    if (tokens.length === 0) {
      console.log(chalk.yellow("No tokens found"));
      return;
    }

    console.log(chalk.cyan(`\n📋 Latest ${tokens.length} Tokens:\n`));

    tokens.forEach((token, index) => {
      const age = Math.floor((Date.now() - token.created_timestamp) / 60000);
      console.log(
        chalk.white(
          `${index + 1}. ${token.name} (${token.symbol}) - ${age}m ago`
        )
      );
      console.log(chalk.gray(`   Mint: ${token.mint}`));
      console.log(
        chalk.gray(`   Market Cap: $${(token.usd_market_cap || 0).toFixed(2)}`)
      );
      console.log("");
    });

    if (options.analyze && tokens.length > 0) {
      validateConfig();
      const analyzer = new ClaudeAnalyzer();
      const analyzeSpinner = ora("Comparing tokens with Claude...").start();
      try {
        const comparison = await analyzer.compareTokens(tokens.slice(0, 5));
        analyzeSpinner.stop();
        console.log(chalk.cyan("\n🤖 Claude's Comparison:\n"));
        console.log(chalk.white(comparison));
      } catch (error) {
        analyzeSpinner.fail("Comparison failed");
      }
    }
  });

// Search command
program
  .command("search <query>")
  .description("Search for tokens by name or symbol")
  .action(async (query: string) => {
    const spinner = ora(`Searching for "${query}"...`).start();
    const api = new PumpFunAPI();
    const tokens = await api.searchTokens(query);

    spinner.stop();

    if (tokens.length === 0) {
      console.log(chalk.yellow("No tokens found"));
      return;
    }

    console.log(chalk.cyan(`\n🔎 Found ${tokens.length} tokens:\n`));

    tokens.forEach((token, index) => {
      console.log(chalk.white(`${index + 1}. ${token.name} (${token.symbol})`));
      console.log(chalk.gray(`   Mint: ${token.mint}`));
      console.log(
        chalk.gray(`   Market Cap: $${(token.usd_market_cap || 0).toFixed(2)}`)
      );
      console.log(chalk.gray(`   Graduated: ${token.complete ? "Yes" : "No"}`));
      console.log("");
    });
  });

// Trade command
program
  .command("trade")
  .description("Interactive trading mode")
  .action(async () => {
    validateTradingConfig();

    const trader = new SolanaTrader();
    const api = new PumpFunAPI();
    const analyzer = new ClaudeAnalyzer();

    trader.initializeWallet();

    const balance = await trader.getBalance();
    console.log(chalk.cyan(`\n💰 Wallet Balance: ${balance.toFixed(4)} SOL\n`));
    console.log(chalk.yellow(`⚠️  Max buy amount: ${config.maxBuyAmount} SOL`));
    console.log(chalk.yellow(`⚠️  Slippage: ${config.slippageBps / 100}%\n`));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = () => {
      rl.question(chalk.cyan("Enter command (buy/sell/analyze/balance/quit): "), async (answer) => {
        const [cmd, ...args] = answer.trim().split(" ");

        switch (cmd.toLowerCase()) {
          case "buy": {
            if (args.length < 2) {
              console.log(chalk.red("Usage: buy <mintAddress> <solAmount>"));
              break;
            }
            const [mint, amount] = args;
            const token = await api.getToken(mint);
            if (!token) {
              console.log(chalk.red("Token not found"));
              break;
            }
            console.log(chalk.yellow(`\nBuying ${token.name} for ${amount} SOL...`));
            const result = await trader.buyToken(token, parseFloat(amount));
            if (result.success) {
              console.log(chalk.green(`✅ Buy successful!`));
              console.log(chalk.gray(`   Signature: ${result.signature}`));
              console.log(chalk.gray(`   Tokens received: ~${result.amountOut?.toFixed(2)}M`));
            } else {
              console.log(chalk.red(`❌ Buy failed: ${result.error}`));
            }
            break;
          }

          case "sell": {
            if (args.length < 2) {
              console.log(chalk.red("Usage: sell <mintAddress> <tokenAmount>"));
              break;
            }
            const [mintAddr, tokenAmt] = args;
            const tokenData = await api.getToken(mintAddr);
            if (!tokenData) {
              console.log(chalk.red("Token not found"));
              break;
            }
            console.log(chalk.yellow(`\nSelling ${tokenAmt} ${tokenData.symbol}...`));
            const sellResult = await trader.sellToken(tokenData, parseFloat(tokenAmt));
            if (sellResult.success) {
              console.log(chalk.green(`✅ Sell successful!`));
              console.log(chalk.gray(`   Signature: ${sellResult.signature}`));
              console.log(chalk.gray(`   SOL received: ~${sellResult.amountOut?.toFixed(4)}`));
            } else {
              console.log(chalk.red(`❌ Sell failed: ${sellResult.error}`));
            }
            break;
          }

          case "analyze": {
            if (args.length < 1) {
              console.log(chalk.red("Usage: analyze <mintAddress>"));
              break;
            }
            const tokenInfo = await api.getToken(args[0]);
            if (!tokenInfo) {
              console.log(chalk.red("Token not found"));
              break;
            }
            const spinner = ora("Analyzing...").start();
            const analysis = await analyzer.analyzeToken(tokenInfo);
            spinner.stop();
            console.log(chalk.cyan(`\nAnalysis for ${tokenInfo.name}:`));
            console.log(chalk.white(`Risk Score: ${getRiskColor(analysis.riskScore)}`));
            console.log(chalk.white(`Summary: ${analysis.summary}`));
            console.log(chalk.white(`Recommendation: ${analysis.recommendation}`));
            break;
          }

          case "balance": {
            const currentBalance = await trader.getBalance();
            console.log(chalk.cyan(`\n💰 Balance: ${currentBalance.toFixed(4)} SOL\n`));
            break;
          }

          case "quit":
          case "exit":
            console.log(chalk.yellow("Goodbye!"));
            rl.close();
            process.exit(0);

          default:
            console.log(chalk.gray("Commands: buy, sell, analyze, balance, quit"));
        }

        prompt();
      });
    };

    prompt();
  });

// King command - show king of the hill
program
  .command("king")
  .description("Show the current King of the Hill token")
  .option("-a, --analyze", "Analyze with Claude")
  .action(async (options) => {
    const spinner = ora("Fetching King of the Hill...").start();
    const api = new PumpFunAPI();
    const token = await api.getKingOfTheHill();

    if (!token) {
      spinner.fail("Could not fetch King of the Hill");
      return;
    }

    spinner.stop();
    console.log(chalk.yellow.bold("\n👑 King of the Hill:\n"));
    printTokenInfo(token);

    if (options.analyze) {
      validateConfig();
      const analyzer = new ClaudeAnalyzer();
      const analyzeSpinner = ora("Analyzing with Claude...").start();
      const analysis = await analyzer.analyzeToken(token);
      analyzeSpinner.stop();
      console.log(chalk.cyan("\n🤖 Claude's Analysis:"));
      console.log(chalk.white(`   Risk Score: ${getRiskColor(analysis.riskScore)}`));
      console.log(chalk.white(`   Summary: ${analysis.summary}`));
      console.log(chalk.white(`   Recommendation: ${analysis.recommendation}`));
    }
  });

// Helper functions
function printTokenInfo(token: PumpFunToken): void {
  const age = Math.floor((Date.now() - token.created_timestamp) / 60000);
  console.log(chalk.white(`   Name: ${token.name}`));
  console.log(chalk.white(`   Symbol: ${token.symbol}`));
  console.log(chalk.gray(`   Mint: ${token.mint}`));
  console.log(chalk.white(`   Market Cap: $${(token.usd_market_cap || 0).toFixed(2)}`));
  console.log(chalk.white(`   Age: ${age} minutes`));
  console.log(chalk.white(`   Graduated: ${token.complete ? "Yes ✅" : "No"}`));
  console.log(chalk.white(`   Replies: ${token.reply_count || 0}`));
  console.log(chalk.gray(`   Twitter: ${token.twitter || "None"}`));
  console.log(chalk.gray(`   Telegram: ${token.telegram || "None"}`));
  console.log(chalk.gray(`   Website: ${token.website || "None"}`));
}

function getRiskColor(score: number): string {
  if (score <= 3) return chalk.green(`${score}/10 (Low Risk)`);
  if (score <= 6) return chalk.yellow(`${score}/10 (Medium Risk)`);
  return chalk.red(`${score}/10 (High Risk)`);
}

program.parse();
