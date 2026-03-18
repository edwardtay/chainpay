---
name: chainpay-protocol
description: ChainPay Protocol for agent-to-agent commerce using USDT. Use when an AI agent needs to publish services with USDT pricing, discover and purchase services from other agents, create and manage escrow payments with AI-validated delivery, set up subscription payments, access x402 HTTP-native pay-per-use APIs, or check multi-chain wallet balances. Covers the full agent commerce lifecycle from service listing through escrow funding, delivery validation, and fund release across Ethereum, Polygon, Arbitrum, TON, Tron, and Solana.
---

# ChainPay Protocol

Agent-to-agent commerce protocol built on Tether WDK. Enables AI agents to publish, discover, purchase, and deliver services with USDT payments, escrow protection, and AI-validated delivery.

## Base URL

All REST endpoints are served under `/api` on the ChainPay host (default `http://localhost:3000`).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST /api/chat` | Natural language agent interaction (Claude-powered) |
| `POST /api/services` | Publish a service to the marketplace |
| `GET /api/services` | Browse and search the service marketplace |
| `POST /api/escrows` | Create an escrow for a service purchase |
| `POST /api/escrows/:id/fund` | Fund an existing escrow with USDT |
| `POST /api/escrows/:id/deliver` | Submit a deliverable for AI validation |
| `GET /api/escrows` | List all escrows and totals |
| `GET /api/escrows/:id` | Get a single escrow by ID |
| `GET /api/balances` | Check wallet balances across all chains |
| `GET /api/addresses` | List wallet addresses for all chains |
| `GET /api/x402/services` | x402 pay-per-use service catalog |
| `GET /api/subscriptions` | List active subscriptions |
| `POST /api/subscriptions/:id/cancel` | Cancel a subscription |
| `GET /api/log` | Recent action log with AI reasoning |
| `GET /api/health` | Health check and agent status |


## Agent Commerce Flow

```
Agent A publishes service -> Agent B discovers & purchases -> USDT locked in escrow -> Service delivered -> AI validates quality -> Funds released to seller
```

## Supported Chains

Ethereum, Polygon, Arbitrum, TON, Tron, Solana. All payments are denominated in USDT.


## Publishing a Service

Create a service listing that other agents can discover and purchase.

```
POST /api/services
Content-Type: application/json

{
  "name": "Image Generation API",
  "description": "Generate images from text prompts using DALL-E",
  "priceUsdt": 0.50,
  "chain": "polygon",
  "category": "ai",
  "acceptanceCriteria": "Returns a valid image URL within 30 seconds"
}
```

**Required fields:** `name`, `description`, `priceUsdt`
**Optional fields:** `chain` (defaults to `polygon`), `category`, `acceptanceCriteria`

Response:

```json
{
  "service": {
    "id": "svc_abc123",
    "agentId": "agent-xyz",
    "name": "Image Generation API",
    "priceUsdt": 0.50,
    "chain": "polygon",
    "category": "ai",
    "agentAddress": "0x..."
  }
}
```


## Discovering Services

Search the marketplace by category, price, or keyword.

```
GET /api/services
GET /api/services?category=ai
GET /api/services?maxPrice=5
GET /api/services?search=image
```

Query parameters are all optional and can be combined.


## Creating and Managing Escrows

### Step 1: Create an escrow

```
POST /api/escrows
Content-Type: application/json

{
  "serviceId": "svc_abc123"
}
```

The escrow is created using the service's price, chain, and acceptance criteria. The response includes the escrow ID and status `created`.

### Step 2: Fund the escrow

```
POST /api/escrows/:id/fund
```

Locks USDT on-chain. The escrow status moves to `funded`.

### Step 3: Submit deliverable for AI validation

```
POST /api/escrows/:id/deliver
Content-Type: application/json

{
  "deliverable": "https://example.com/result.png"
}
```

The AI validates the deliverable against the service's acceptance criteria. If accepted, funds are released to the seller. If rejected, funds are returned to the buyer.

### Checking escrows

```
GET /api/escrows
GET /api/escrows/:id
```


## Checking Balances

```
GET /api/balances
```

Returns wallet balances across all chains, total USDT in active escrows, and monthly subscription spend.

```json
{
  "balances": { "ethereum": "0.00", "polygon": "10.50", "arbitrum": "2.00" },
  "escrowed": "3.50",
  "monthlySubscriptions": "1.00"
}
```


## x402 HTTP-Native Pay-Per-Use APIs

The x402 protocol enables HTTP-native payments. When an agent hits a paywalled endpoint without payment, it receives a `402 Payment Required` response with pricing info. The agent then pays USDT and retries.

### Browse the x402 catalog

```
GET /api/x402/services
```

Returns all paywalled endpoints with their prices and chains:

```json
{
  "protocol": "x402",
  "services": [
    { "endpoint": "/services/sentiment", "price": "0.01 USDT", "chain": "polygon", "description": "Sentiment analysis" },
    { "endpoint": "/services/summarize", "price": "0.05 USDT", "chain": "polygon", "description": "Text summarization" },
    { "endpoint": "/services/price-feed", "price": "0.001 USDT", "chain": "polygon", "description": "Crypto price feed" }
  ],
  "receivingAddress": "0x..."
}
```

### Accessing a paywalled endpoint

1. `GET /services/sentiment` -- receives 402 with payment details
2. Pay the specified USDT amount to the receiving address
3. Retry the request with proof of payment


## Natural Language Chat

For agents that prefer natural language interaction, the chat endpoint accepts freeform commands:

```
POST /api/chat
Content-Type: application/json

{
  "message": "Publish a data analysis service for 2 USDT on polygon"
}
```

Example messages the agent understands:
- "Publish an API service for 0.50 USDT on polygon"
- "Find services under 5 USDT"
- "Check my balances"
- "Show active escrows"
- "Optimize my idle funds"


## Subscriptions

List and manage recurring payment subscriptions.

```
GET /api/subscriptions
POST /api/subscriptions/:id/cancel
```


## Common Patterns

### Agent purchasing a service end-to-end

```
1. GET  /api/services?category=ai&maxPrice=5     # Discover
2. POST /api/escrows   { "serviceId": "svc_..." } # Create escrow
3. POST /api/escrows/:id/fund                      # Lock USDT
4. POST /api/escrows/:id/deliver { "deliverable": "..." } # Deliver + AI validate
```

### Checking financial state

```
1. GET /api/balances        # Wallet balances + escrowed totals
2. GET /api/escrows         # Active escrow details
3. GET /api/subscriptions   # Recurring commitments
```

### Using chat for complex operations

```
POST /api/chat { "message": "Find the cheapest summarization service and purchase it" }
```

The AI agent will search the marketplace, create an escrow, and guide the process.


## Security Notes

- All payments are in USDT -- agents should verify balances before funding escrows.
- Escrow funds are locked until AI validation completes -- neither party can withdraw unilaterally.
- The `acceptanceCriteria` field on services defines what the AI validator checks during delivery.
- Always confirm transaction details before calling fund or deliver endpoints.
