# Pump.fun Claude Bot

A CLI bot that connects to [pump.fun](https://pump.fun) and uses Claude AI to analyze meme coins on Solana.

## Features

- **Real-time Monitoring**: Watch new token launches via WebSocket
- **AI Analysis**: Analyze tokens with Claude for risk assessment
- **Trading**: Buy and sell tokens directly from the CLI
- **Search**: Find tokens by name or symbol
- **Comparison**: Compare multiple tokens with AI insights

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/pump-fun-claude-bot.git
cd pump-fun-claude-bot

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
```

## Configuration

Edit `.env` with your credentials:

```env
# Required: Anthropic API Key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Required for trading: Your Solana wallet private key (base58)
SOLANA_PRIVATE_KEY=your_private_key

# Optional: Custom RPC (recommended for better performance)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Trading limits
MAX_BUY_AMOUNT=0.1
SLIPPAGE_BPS=500
```

## Usage

### Monitor New Tokens

Watch for new token launches in real-time:

```bash
# Basic monitoring
npm run dev monitor

# Monitor with auto-analysis
npm run dev monitor -- --analyze

# Filter by minimum market cap
npm run dev monitor -- --analyze --filter 1
```

### Analyze a Token

Get Claude's risk assessment for any token:

```bash
# Full analysis
npm run dev analyze <mint_address>

# Ask a specific question
npm run dev analyze <mint_address> -- -q "Is this a potential rug pull?"
```

### View Latest Tokens

```bash
# Show 10 latest tokens
npm run dev latest

# Show more tokens
npm run dev latest -- --limit 25

# With AI comparison
npm run dev latest -- --analyze
```

### Search Tokens

```bash
npm run dev search "pepe"
```

### View King of the Hill

```bash
npm run dev king

# With analysis
npm run dev king -- --analyze
```

### Interactive Trading

```bash
npm run dev trade
```

Commands in trading mode:
- `buy <mint> <sol_amount>` - Buy tokens
- `sell <mint> <token_amount>` - Sell tokens
- `analyze <mint>` - Quick analysis
- `balance` - Check wallet balance
- `quit` - Exit trading mode

## Risk Disclaimer

**This software is for educational purposes only.**

- Meme coins are extremely risky and volatile
- Most pump.fun tokens go to zero
- Never invest more than you can afford to lose
- The AI analysis is not financial advice
- Always do your own research (DYOR)

## Commands Reference

| Command | Description |
|---------|-------------|
| `monitor` | Real-time new token monitoring |
| `analyze <mint>` | Analyze a specific token |
| `latest` | Show latest tokens |
| `search <query>` | Search for tokens |
| `king` | Show King of the Hill |
| `trade` | Interactive trading mode |

## Building for Production

```bash
npm run build
npm start <command>
```

## License

MIT
