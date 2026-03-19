# ChainPay

Self-custodial agent commerce protocol on Tether WDK.

## Commands

```
npm install          # Install
npm run dev          # Start server (localhost:3000)
npm run agent        # Interactive CLI
npm run demo         # Run 11-step commerce demo
npm test             # Run 200 E2E tests
npm run check-balance # View wallet balances
```

## Architecture

```
src/agent/agent.ts          — Core agent (chat, escrow, negotiate, dispute)
src/agent/autonomous.ts     — Autonomous brain loop
src/llm/claude.ts           — Claude AI integration (NLP, reasoning, validation)
src/protocol/escrow.ts      — Escrow lifecycle
src/protocol/negotiation.ts — Price negotiation
src/protocol/disputes.ts    — AI dispute arbitration
src/protocol/subscriptions.ts — Recurring payments
src/protocol/x402-paywall.ts — HTTP 402 pay-per-use
src/services/wallet-manager.ts — WDK multi-chain wallets (9 packages)
src/services/yield-manager.ts — Aave V3 yield
```

## Key APIs

All write endpoints require `X-API-Key` header (set `AGENT_API_KEY` in .env).

```
POST /api/chat              — Natural language (AI-powered)
POST /api/services          — Publish service
GET  /api/services          — Browse marketplace
POST /api/escrows           — Create escrow
POST /api/escrows/:id/fund  — Fund (verify balance)
POST /api/escrows/:id/deliver — Submit + AI validate
POST /api/negotiations      — Open price negotiation
POST /api/disputes/:id/arbitrate — AI arbitration
POST /api/autonomous/start  — Start brain loop
GET  /api/x402/services     — x402 pay-per-use catalog
GET  /api/audit             — Full audit trail
```

## Environment

```
SEED_PHRASE=         # BIP-39 seed (required)
ANTHROPIC_API_KEY=   # For AI reasoning (optional — works offline)
AGENT_API_KEY=       # Auth for write endpoints
NETWORK_MODE=        # "testnet" enables Sepolia
```

## Testing

Tests run without API keys or funded wallets. Offline LLM fallback handles all AI operations in test mode.
