import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { ChainPayAgent } from './agent/agent';
import { createRouter } from './routes/payments';
import { X402PaywallManager, createDemoPaywalledServices } from './protocol/x402-paywall';
import { getDashboardHTML } from './dashboard';

async function main() {
  const seedPhrase = process.env.SEED_PHRASE;
  if (!seedPhrase) {
    console.error('Error: SEED_PHRASE not set in .env file');
    process.exit(1);
  }

  const app = express();
  app.use(express.json());

  console.log('Initializing ChainPay...');
  const agent = new ChainPayAgent(seedPhrase);
  await agent.initialize();
  console.log('Agent ready.');

  // x402 paywall — HTTP-native agent payments
  const paywall = new X402PaywallManager(agent.getWalletManager());
  await paywall.initialize();
  createDemoPaywalledServices(paywall);
  app.use(paywall.middleware());

  // x402 service catalog
  app.get('/api/x402/services', (_req, res) => {
    res.json({
      protocol: 'x402',
      description: 'HTTP-native payment endpoints. Send USDT to access.',
      services: paywall.getRoutes().map((r) => ({
        endpoint: r.path,
        price: `${r.priceUsdt} USDT`,
        chain: r.chain,
        description: r.description,
      })),
      receivingAddress: paywall.getReceivingAddress(),
    });
  });

  app.use('/api', createRouter(agent));

  app.get('/', (_req, res) => {
    res.send(getDashboardHTML());
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`ChainPay running at http://localhost:${port}`);
  });
}

main().catch(console.error);

/* Old dashboard removed — now in src/dashboard.ts */
