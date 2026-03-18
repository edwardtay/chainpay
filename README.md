# ChainPay

**The Self-Custodial Agent Commerce Protocol** — powered by [Tether WDK](https://wdk.tether.io/) and Claude AI

ChainPay enables AI agents to autonomously publish services, discover each other, negotiate prices, lock USDT in escrow, validate deliverables with AI, resolve disputes, and settle payments across 7 chains — all with self-custodial wallets.

> *"Like [ACP](https://github.com/anthropics/acp) (Agentic Commerce Protocol) and [x402](https://x402.org) — but self-custodial, multi-chain, and with AI-validated escrow."*

## The Problem

AI agents can reason but can't transact. Emerging protocols like OpenAI/Stripe's ACP, Coinbase's x402, and Mastercard's Agent Pay rely on custodial rails — agents don't control their own wallets. There's no **self-custodial, on-chain** protocol for agents to trustlessly trade services.

## The Solution

ChainPay provides the full economic stack for agent-to-agent commerce:

1. **Agent publishes a service** with USDT pricing on any chain
2. **Another agent discovers it** via the service registry
3. **Agents negotiate price** using AI-powered bargaining
4. **USDT is locked in escrow** via self-custodial WDK wallets
5. **Service is delivered** and deliverable submitted
6. **AI validates the output** against acceptance criteria
7. **Escrow released** (or disputed → AI arbitration → resolution)
8. **Idle funds earn yield** via Aave V3
9. **Recurring subscriptions** auto-pay on schedule
10. **x402 endpoints** enable HTTP-native pay-per-API-call

All wallets are **self-custodial** via Tether WDK. Keys never leave the agent's environment.

## Architecture

```
Agent A                              Agent B
(Service Buyer)                      (Service Seller)
    |                                    |
    |  1. Discover service               |
    |<-----------------------------------|  (Service Registry)
    |                                    |
    |  2. AI decides to purchase         |
    |  (Claude reasons about value)      |
    |                                    |
    |  3. Create escrow                  |
    |----------------------------------->|
    |  4. Fund escrow (USDT via WDK)     |
    |====================================|  (Funds locked)
    |                                    |
    |  5. Deliver service                |
    |<-----------------------------------|
    |                                    |
    |  6. AI validates deliverable       |
    |  (Claude checks quality)           |
    |                                    |
    |  7. Release USDT to seller         |
    |====================================|  (Settlement)
    |                                    |
    |  Idle funds -> Aave V3 yield       |
    |  Subscriptions auto-pay            |
```

## Key Features

### Agent Intelligence (Claude AI)
- **Natural language interface** — talk to the agent in plain English
- **Intent parsing** — AI understands "pay John 50 USDT on polygon"
- **Service selection** — AI reasons about which service to buy and why
- **Deliverable validation** — AI checks output quality before releasing escrow
- **Yield optimization** — AI decides when to supply idle funds to Aave
- All decisions logged with AI reasoning for audit trail

### WDK by Tether Integration
- **Self-custodial** BIP-39/BIP-44 HD wallets across 6 chains
- **Multi-chain**: Ethereum, Polygon, Arbitrum, TON, Tron, Solana
- **USDT transfers**: ERC-20, Jetton, TRC-20, SPL token support
- **Cross-chain bridging** via USDT0/LayerZero
- **DEX swaps** via Velora (EVM) and StonFi (TON)
- **Aave V3 lending** for yield on idle escrow funds
- Proper fee estimation and transaction handling

### Agentic Payment Design
- **Escrow system** — USDT locked until AI validates delivery
- **Subscription payments** — recurring agent-to-agent billing with auto-pay
- **Conditional release** — funds only move when acceptance criteria met
- **Service marketplace** — agents publish/discover/rate services
- **Autonomous loop** — processes subscriptions, monitors escrows, optimizes yield

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Reasoning | Anthropic Claude (claude-sonnet-4-20250514) |
| Wallets | Tether WDK — `@tetherto/wdk`, `wdk-wallet-evm`, `wdk-wallet-ton`, `wdk-wallet-tron`, `wdk-wallet-solana` |
| DeFi | `wdk-protocol-swap-velora-evm`, `wdk-protocol-bridge-usdt0-evm`, Aave V3 |
| Server | Express.js + TypeScript |
| Runtime | Node.js 20+ |

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Set SEED_PHRASE and ANTHROPIC_API_KEY in .env

# Run web dashboard
npm run dev

# Or use CLI agent
npm run agent
```

## Usage

### Natural Language (AI-Powered)

```
chainpay> Publish a data analysis service for 2 USDT on polygon
Service published!
  ID: 3f8a...
  Name: Data Analysis
  Price: 2.00 USDT
  Chain: Polygon

chainpay> Find services for image generation under 5 USDT
Available Services:
  [a1b2c3d4] Image Gen API — 0.50 USDT (Polygon) | 12 jobs, rating: 4.2/5

chainpay> Buy image generation service
Purchasing: Image Gen API
  Escrow ID: 7e9f...
  Amount: 0.50 USDT
  AI reasoning: Best price-to-rating ratio. 12 completed jobs indicates reliability.
  Escrow created. Funds held until delivery validated.

chainpay> Check my balances
Wallet Balances:
  Ethereum: 0.05 ETH | 100.00 USDT
  Polygon: 0.1 MATIC | 250.00 USDT
  Escrowed: 0.50 USDT
  Monthly subscriptions: 15.00 USDT/month
```

### REST API

```bash
# AI chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find services for data analysis"}'

# Publish service
curl -X POST http://localhost:3000/api/services \
  -d '{"name":"API Service","description":"...","priceUsdt":"1.00","chain":"polygon"}'

# Create escrow
curl -X POST http://localhost:3000/api/escrows \
  -d '{"serviceId":"<service-id>"}'

# Submit deliverable (triggers AI validation)
curl -X POST http://localhost:3000/api/escrows/<id>/deliver \
  -d '{"deliverable":"Here is the analysis report..."}'

# View action log (with AI reasoning)
curl http://localhost:3000/api/log

# Run full demo scenario (one-click)
curl -X POST http://localhost:3000/api/demo

# Download audit trail
curl http://localhost:3000/api/audit > audit.json
```

## Running

```bash
npm install           # Install dependencies
npm test              # Run 156 E2E tests
npm run demo          # Run full agent commerce demo
npm run dev           # Start web server + dashboard
npm run agent         # Interactive CLI
npm run check-balance # View all wallet balances
npm run wallet        # Generate new wallet
```

## Project Structure

```
src/
├── agent/
│   ├── agent.ts              # Core agent — orchestrates all operations
│   └── cli.ts                # Interactive CLI
├── llm/
│   └── claude.ts             # Claude AI — reasoning, validation, NLP (+ offline fallback)
├── protocol/
│   ├── service-registry.ts   # Service marketplace — publish, discover, rate
│   ├── escrow.ts             # Trustless escrow — fund, deliver, validate, release
│   ├── subscriptions.ts      # Recurring payments — auto-billing
│   └── x402-paywall.ts       # HTTP-native pay-per-use endpoints (x402 protocol)
├── services/
│   ├── wallet-manager.ts     # Multi-chain WDK wallets + ERC-4337 gasless
│   └── yield-manager.ts      # Aave V3 yield optimization
├── routes/
│   └── payments.ts           # REST API + audit trail + demo endpoint
├── utils/
│   └── chains.ts             # Chain configs (7 chains incl. Sepolia testnet)
├── types.d.ts                # WDK type declarations
├── test-e2e.ts               # 156 E2E tests
├── demo.ts                   # Scripted agent commerce demo
├── check-balance.ts          # Multi-chain balance checker
├── generate-wallet.ts        # Wallet generation tool
└── index.ts                  # Express server + dashboard
```

## Third-Party Services

- **Anthropic Claude API** — AI reasoning and validation
- **Tether WDK** — Self-custodial wallet infrastructure
- **Aave V3** — DeFi lending for yield optimization
- **Velora** — DEX aggregation for token swaps
- **LayerZero** — Cross-chain bridging via USDT0

## License

Apache-2.0
