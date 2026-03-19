import express from 'express';
import { getDashboardHTML } from '../src/dashboard';

const app = express();
app.use(express.json());

// Static demo data — WDK wallet modules require native deps not available in serverless
const DEMO_ADDRESSES = {
  sepolia: '0xDc38C6e9EF80B710cEEe51060C90962cB4a80d76',
  ethereum: '0xDc38C6e9EF80B710cEEe51060C90962cB4a80d76',
  polygon: '0xDc38C6e9EF80B710cEEe51060C90962cB4a80d76',
  arbitrum: '0xDc38C6e9EF80B710cEEe51060C90962cB4a80d76',
  ton: 'UQB2CVP3o3ylaVGCNuGWEBVux2vzdvpwpzObvHZnQ4OdKXN3',
  tron: 'TKUaesiC9Z1fTQ1oHEuJYBKaNB8cytTfm7',
  solana: '12P5cLXT8VMMPceKzZBkCQCPezG1mtsPwUa5WSHVKfJj',
};

const demoServices = [
  { id: 'svc-1', name: 'AI Sentiment Analysis', priceUsdt: '0.10', chain: 'polygon', category: 'ai', completedJobs: 12, rating: 4.2 },
  { id: 'svc-2', name: 'Smart Contract Audit', priceUsdt: '5.00', chain: 'polygon', category: 'security', completedJobs: 3, rating: 4.8 },
  { id: 'svc-3', name: 'Price Feed Oracle', priceUsdt: '0.001', chain: 'polygon', category: 'data', completedJobs: 847, rating: 4.9 },
];

const x402Services = [
  { endpoint: '/services/sentiment', price: '0.01 USDT', chain: 'polygon', description: 'AI Sentiment Analysis' },
  { endpoint: '/services/summarize', price: '0.05 USDT', chain: 'polygon', description: 'AI Text Summarization' },
  { endpoint: '/services/price-feed', price: '0.001 USDT', chain: 'polygon', description: 'Crypto Price Feed' },
];

app.get('/', (_req, res) => res.send(getDashboardHTML()));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agent: 'ChainPay', version: '2.0.0', mode: 'serverless-preview', note: 'Full agent requires local deployment: npm run dev' });
});

app.get('/api/addresses', (_req, res) => res.json({ addresses: DEMO_ADDRESSES }));

app.get('/api/balances', (_req, res) => res.json({
  balances: Object.fromEntries(Object.keys(DEMO_ADDRESSES).map(c => [c, { native: '0', usdt: '0' }])),
  escrowed: '0.00',
  monthlySubscriptions: '0.00',
}));

app.get('/api/services', (_req, res) => res.json({ services: demoServices }));
app.get('/api/escrows', (_req, res) => res.json({ escrows: [], totalEscrowed: '0.00', active: 0 }));
app.get('/api/subscriptions', (_req, res) => res.json({ subscriptions: [] }));
app.get('/api/negotiations', (_req, res) => res.json({ negotiations: [], active: 0 }));
app.get('/api/disputes', (_req, res) => res.json({ disputes: [], active: 0, resolved: 0 }));
app.get('/api/autonomous', (_req, res) => res.json({ running: false, cycleCount: 0, intervalMs: 30000, eventCount: 0, lastEvents: [] }));
app.get('/api/log', (_req, res) => res.json({ log: [{ timestamp: new Date(), type: 'init', description: 'Serverless preview mode — run locally for full agent' }], count: 1 }));
app.get('/api/x402/services', (_req, res) => res.json({ protocol: 'x402', services: x402Services, receivingAddress: DEMO_ADDRESSES.polygon }));

app.get('/api/audit', (_req, res) => res.json({
  exportedAt: new Date().toISOString(),
  mode: 'serverless-preview',
  note: 'Full audit trail available when running locally with npm run dev',
}));

app.post('/api/chat', (_req, res) => res.json({
  response: 'Serverless preview mode. For full AI agent interaction, run locally:\n  git clone https://github.com/edwardtay/chainpay\n  npm install && npm run dev',
}));

app.post('/api/demo', (_req, res) => res.json({
  status: 'Demo available locally',
  steps: ['Run: npm run demo (scripted 11-step agent commerce demo)', 'Or: npm run dev → click "Run Demo" in dashboard'],
}));

// x402 demo
app.get('/services/sentiment', (_req, res) => res.status(402).json({
  type: 'x402-payment-required',
  paymentRequirements: { scheme: 'exact', network: 'eip155:137', maxAmountRequired: '0.01', asset: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', payTo: DEMO_ADDRESSES.polygon },
}));

export default app;
