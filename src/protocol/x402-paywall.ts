import { Router, Request, Response, NextFunction } from 'express';
import { MultiChainWalletManager } from '../services/wallet-manager';
import { getChainConfig } from '../utils/chains';

/**
 * x402 Paywall — HTTP-native payments for agent-to-agent commerce.
 *
 * When an agent calls a service endpoint, it receives HTTP 402 Payment Required
 * with payment details. The agent auto-pays via WDK and gets the service response.
 *
 * This implements the x402 protocol pattern:
 * 1. Client requests protected resource
 * 2. Server responds with 402 + payment requirements
 * 3. Client pays (USDT via WDK)
 * 4. Client re-requests with payment proof
 * 5. Server verifies and serves the resource
 *
 * Compatible with Coinbase's x402 standard (https://x402.org)
 */

export interface PaywallRoute {
  path: string;
  priceUsdt: string;
  chain: string;
  description: string;
  handler: (req: Request, res: Response) => void | Promise<void>;
}

interface PaymentRecord {
  txHash: string;
  amount: string;
  chain: string;
  payer: string;
  timestamp: Date;
  used: boolean;
}

export class X402PaywallManager {
  private routes: Map<string, PaywallRoute> = new Map();
  private paymentRecords: Map<string, PaymentRecord> = new Map();
  private receivingAddress: string = '';

  constructor(
    private walletManager: MultiChainWalletManager,
    private defaultChain: string = 'polygon'
  ) {}

  async initialize(): Promise<void> {
    this.receivingAddress = await this.walletManager.getAddress(this.defaultChain);
  }

  /**
   * Register a paywalled service endpoint.
   */
  addRoute(route: PaywallRoute): void {
    this.routes.set(route.path, route);
  }

  /**
   * Create Express middleware that enforces x402 payment on registered routes.
   */
  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      const route = this.routes.get(req.path);
      if (!route) {
        next();
        return;
      }

      // Check for payment proof header
      const paymentProof = req.headers['x-payment-proof'] as string | undefined;
      const paymentTxHash = req.headers['x-payment-txhash'] as string | undefined;

      if (paymentProof && paymentTxHash) {
        // Verify payment
        const record = this.paymentRecords.get(paymentTxHash);
        if (record && !record.used) {
          record.used = true;
          // Payment verified — serve the resource
          route.handler(req, res);
          return;
        }
      }

      // No valid payment — respond with 402 Payment Required
      const config = getChainConfig(route.chain);
      res.status(402).json({
        type: 'x402-payment-required',
        version: '1.0',
        description: route.description,
        paymentRequirements: {
          scheme: 'exact',
          network: `eip155:${config.chainId}`,
          maxAmountRequired: route.priceUsdt,
          asset: config.usdtAddress,
          assetDecimals: config.usdtDecimals,
          payTo: this.receivingAddress,
          extra: {
            name: route.description,
            chain: route.chain,
            chainName: config.name,
          },
        },
        instructions: {
          send: `Send ${route.priceUsdt} USDT to ${this.receivingAddress} on ${config.name}`,
          then: 'Re-request with headers: X-Payment-TxHash: <tx_hash>, X-Payment-Proof: <proof>',
        },
      });
    };
  }

  /**
   * Record a payment (called when agent detects incoming USDT).
   */
  recordPayment(txHash: string, amount: string, chain: string, payer: string): void {
    this.paymentRecords.set(txHash, {
      txHash,
      amount,
      chain,
      payer,
      timestamp: new Date(),
      used: false,
    });
  }

  getRoutes(): PaywallRoute[] {
    return Array.from(this.routes.values());
  }

  getPaymentRecords(): PaymentRecord[] {
    return Array.from(this.paymentRecords.values());
  }

  getReceivingAddress(): string {
    return this.receivingAddress;
  }
}

/**
 * Create demo service routes behind x402 paywall.
 * These simulate real agent services that require payment.
 */
export function createDemoPaywalledServices(paywall: X402PaywallManager): void {
  paywall.addRoute({
    path: '/services/sentiment',
    priceUsdt: '0.01',
    chain: 'polygon',
    description: 'AI Sentiment Analysis — analyze text sentiment',
    handler: (req, res) => {
      const text = req.body?.text || 'No text provided';
      const sentiment = text.toLowerCase().includes('good') || text.toLowerCase().includes('great')
        ? 'positive' : text.toLowerCase().includes('bad') || text.toLowerCase().includes('terrible')
        ? 'negative' : 'neutral';
      res.json({
        service: 'sentiment-analysis',
        input: text,
        result: { sentiment, confidence: 0.87 },
        payment: 'verified',
      });
    },
  });

  paywall.addRoute({
    path: '/services/summarize',
    priceUsdt: '0.05',
    chain: 'polygon',
    description: 'AI Text Summarization — summarize long text',
    handler: (req, res) => {
      const text = req.body?.text || '';
      const words = text.split(' ');
      const summary = words.slice(0, Math.min(20, words.length)).join(' ') + '...';
      res.json({
        service: 'text-summarization',
        inputLength: words.length,
        result: { summary, compressionRatio: 0.2 },
        payment: 'verified',
      });
    },
  });

  paywall.addRoute({
    path: '/services/price-feed',
    priceUsdt: '0.001',
    chain: 'polygon',
    description: 'Crypto Price Feed — get real-time token prices',
    handler: (_req, res) => {
      res.json({
        service: 'price-feed',
        result: {
          'ETH/USDT': (2500 + Math.random() * 100).toFixed(2),
          'BTC/USDT': (65000 + Math.random() * 1000).toFixed(2),
          'SOL/USDT': (150 + Math.random() * 10).toFixed(2),
          'TON/USDT': (5 + Math.random()).toFixed(2),
        },
        timestamp: new Date().toISOString(),
        payment: 'verified',
      });
    },
  });
}
