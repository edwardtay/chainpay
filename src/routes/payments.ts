import { Router, Request, Response, NextFunction } from 'express';
import { ChainPayAgent } from '../agent/agent';

/**
 * Authentication middleware for wallet-moving endpoints.
 * Requires X-API-Key header matching the AGENT_API_KEY env var.
 * If no AGENT_API_KEY is set, all write endpoints are blocked in production
 * and allowed only when NETWORK_MODE=testnet.
 */
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.AGENT_API_KEY;
  const isTestnet = process.env.NETWORK_MODE === 'testnet';

  // If no API key configured: allow in testnet, block in production
  if (!apiKey) {
    if (isTestnet) { next(); return; }
    res.status(403).json({
      error: 'AGENT_API_KEY not configured. Set it in .env to enable wallet operations.',
    });
    return;
  }

  const provided = req.headers['x-api-key'] as string | undefined;
  if (provided !== apiKey) {
    res.status(401).json({ error: 'Invalid or missing X-API-Key header.' });
    return;
  }
  next();
}

export function createRouter(agent: ChainPayAgent): Router {
  const router = Router();
  const wallets = agent.getWalletManager();
  const services = agent.getServiceRegistry();
  const escrows = agent.getEscrowEngine();
  const subs = agent.getSubscriptionEngine();
  const negotiations = agent.getNegotiationEngine();
  const disputes = agent.getDisputeEngine();

  // Health
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      agent: 'ChainPay',
      version: '2.0.0',
      agentId: agent.agentId,
    });
  });

  // Wallets
  router.get('/addresses', async (_req: Request, res: Response) => {
    try {
      res.json({ addresses: await wallets.getAllAddresses() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.get('/balances', async (_req: Request, res: Response) => {
    try {
      res.json({
        balances: await wallets.getAllBalances(),
        escrowed: escrows.getTotalEscrowed(),
        monthlySubscriptions: subs.getMonthlySpend(agent.agentId).toFixed(2),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Services
  router.get('/services', (req: Request, res: Response) => {
    const query = {
      category: req.query.category as string | undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      search: req.query.search as string | undefined,
    };
    res.json({ services: services.find(query) });
  });

  router.post('/services', async (req: Request, res: Response) => {
    try {
      const { name, description, priceUsdt, chain, category, acceptanceCriteria } = req.body;
      const address = await wallets.getAddress(chain || 'polygon');
      const service = services.publish({
        agentId: agent.agentId,
        agentAddress: address,
        name, description, priceUsdt, chain: chain || 'polygon', category, acceptanceCriteria,
      });
      res.status(201).json({ service });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Escrows
  router.get('/escrows', (_req: Request, res: Response) => {
    res.json({
      escrows: escrows.getAll(),
      totalEscrowed: escrows.getTotalEscrowed(),
      active: escrows.getActive().length,
    });
  });

  router.post('/escrows', async (req: Request, res: Response) => {
    try {
      const { serviceId } = req.body;
      const service = services.get(serviceId);
      if (!service) { res.status(404).json({ error: 'Service not found' }); return; }

      const buyerAddress = await wallets.getAddress(service.chain);
      const escrow = escrows.create({
        serviceId: service.id,
        serviceName: service.name,
        buyerAgentId: agent.agentId,
        sellerAgentId: service.agentId,
        buyerAddress,
        sellerAddress: service.agentAddress,
        amountUsdt: service.priceUsdt,
        chain: service.chain,
        acceptanceCriteria: service.acceptanceCriteria,
      });
      res.status(201).json({ escrow });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.get('/escrows/:id', (req: Request, res: Response) => {
    const escrow = escrows.get(req.params.id as string);
    if (!escrow) { res.status(404).json({ error: 'Escrow not found' }); return; }
    res.json({ escrow });
  });

  router.post('/escrows/:id/fund', requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await agent.fundEscrow(req.params.id as string);
      res.json({ result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.post('/escrows/:id/deliver', requireAuth, async (req: Request, res: Response) => {
    try {
      const { deliverable } = req.body;
      const result = await agent.submitDeliverable(req.params.id as string, deliverable);
      res.json({ result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Subscriptions
  router.get('/subscriptions', (_req: Request, res: Response) => {
    res.json({ subscriptions: subs.getAll() });
  });

  router.post('/subscriptions/:id/cancel', requireAuth, (req: Request, res: Response) => {
    subs.cancel(req.params.id as string);
    res.json({ status: 'cancelled' });
  });

  // Agent chat (natural language)
  // Chat can trigger wallet operations — requires auth
  router.post('/chat', requireAuth, async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      if (!message) { res.status(400).json({ error: 'Missing message' }); return; }
      const response = await agent.processCommand(message);
      res.json({ response });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Action log
  router.get('/log', (_req: Request, res: Response) => {
    const log = agent.getActionLog().slice(-50);
    res.json({ log, count: log.length });
  });

  // Negotiations
  router.get('/negotiations', (_req: Request, res: Response) => {
    res.json({ negotiations: negotiations.getAll(), active: negotiations.getActive().length });
  });

  router.post('/negotiations', async (req: Request, res: Response) => {
    try {
      const { serviceId, offerUsdt, message } = req.body;
      const service = services.get(serviceId);
      if (!service) { res.status(404).json({ error: 'Service not found' }); return; }
      const neg = negotiations.openNegotiation({
        service,
        buyerAgentId: agent.agentId,
        offerUsdt: offerUsdt || (parseFloat(service.priceUsdt) * 0.7).toFixed(2),
        message,
      });
      res.status(201).json({ negotiation: neg });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.post('/negotiations/:id/respond', async (req: Request, res: Response) => {
    try {
      const { role } = req.body;
      const result = await negotiations.respond(
        req.params.id as string,
        role === 'seller' ? 'auto-seller' : agent.agentId,
        role || 'seller'
      );
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Autonomous agent brain
  router.get('/autonomous', (_req: Request, res: Response) => {
    const auto = agent.getAutonomous();
    res.json(auto.getStatus());
  });

  router.get('/autonomous/events', (_req: Request, res: Response) => {
    const auto = agent.getAutonomous();
    res.json({ events: auto.getEvents() });
  });

  router.post('/autonomous/start', requireAuth, async (_req: Request, res: Response) => {
    try {
      await agent.startAutonomousLoop();
      res.json({ status: 'started', ...agent.getAutonomous().getStatus() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.post('/autonomous/stop', requireAuth, (_req: Request, res: Response) => {
    agent.stopAutonomousLoop();
    res.json({ status: 'stopped' });
  });

  // Disputes
  router.get('/disputes', (_req: Request, res: Response) => {
    res.json({
      disputes: disputes.getAll(),
      active: disputes.getActive().length,
      resolved: disputes.getResolved().length,
    });
  });

  router.get('/disputes/:id', (req: Request, res: Response) => {
    const dispute = disputes.get(req.params.id as string);
    if (!dispute) { res.status(404).json({ error: 'Dispute not found' }); return; }
    res.json({ dispute });
  });

  router.post('/disputes', (req: Request, res: Response) => {
    try {
      const { escrowId } = req.body;
      const escrow = escrows.get(escrowId);
      if (!escrow) { res.status(404).json({ error: 'Escrow not found' }); return; }
      if (escrow.status !== 'disputed') {
        res.status(400).json({ error: `Escrow is not in disputed status (current: ${escrow.status})` });
        return;
      }
      const dispute = disputes.createFromEscrow({
        escrowId: escrow.id,
        serviceId: escrow.serviceId,
        serviceName: escrow.serviceName,
        buyerAgentId: escrow.buyerAgentId,
        sellerAgentId: escrow.sellerAgentId,
        amountUsdt: escrow.amountUsdt,
        acceptanceCriteria: escrow.acceptanceCriteria,
        deliverable: escrow.deliverable || '',
        validationFeedback: escrow.validationResult?.feedback || '',
      });
      res.status(201).json({ dispute });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.post('/disputes/:id/message', (req: Request, res: Response) => {
    try {
      const { role, agentId, content } = req.body;
      const message = disputes.addMessage(req.params.id as string, role, agentId, content);
      res.status(201).json({ message });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.post('/disputes/:id/resubmit', (req: Request, res: Response) => {
    try {
      const { deliverable } = req.body;
      const dispute = disputes.sellerResubmit(req.params.id as string, deliverable);
      res.json({ dispute });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.post('/disputes/:id/refund', (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      const dispute = disputes.buyerRequestRefund(req.params.id as string, reason || 'Buyer requested refund');
      res.json({ dispute });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.post('/disputes/:id/escalate', (req: Request, res: Response) => {
    try {
      const dispute = disputes.escalate(req.params.id as string);
      res.json({ dispute });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.post('/disputes/:id/arbitrate', async (req: Request, res: Response) => {
    try {
      const result = await disputes.arbitrate(req.params.id as string);
      const dispute = disputes.get(req.params.id as string);
      res.json({ dispute, arbitrationResult: result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Full audit trail export (JSON download)
  router.get('/audit', (_req: Request, res: Response) => {
    const audit = {
      exportedAt: new Date().toISOString(),
      agentId: agent.agentId,
      actionLog: agent.getActionLog(),
      services: services.getAll(),
      escrows: escrows.getAll(),
      subscriptions: subs.getAll(),
      stats: {
        totalEscrowed: escrows.getTotalEscrowed(),
        activeEscrows: escrows.getActive().length,
        activeSubscriptions: subs.getActive().length,
        monthlySpend: subs.getMonthlySpend(agent.agentId).toFixed(2),
        totalActions: agent.getActionLog().length,
      },
    };
    res.setHeader('Content-Disposition', 'attachment; filename=chainpay-audit.json');
    res.json(audit);
  });

  // Run demo scenario via API (for judges who want one-click demo)
  router.post('/demo', async (_req: Request, res: Response) => {
    try {
      const results: string[] = [];
      const walletAddr = await wallets.getAddress(
        wallets.getInitializedChains().find(c => c !== 'ton' && c !== 'tron' && c !== 'solana') || 'polygon'
      );

      // 1. Publish services
      const svc1 = services.publish({
        agentId: 'demo-seller',
        agentAddress: walletAddr,
        name: 'AI Sentiment Analysis',
        description: 'Analyze text sentiment. Returns positive/negative/neutral with confidence.',
        priceUsdt: '0.10',
        chain: 'polygon',
        category: 'ai',
        acceptanceCriteria: 'Must return JSON with sentiment and confidence > 0.5',
      });
      results.push(`Published service: ${svc1.name} (${svc1.priceUsdt} USDT)`);

      const svc2 = services.publish({
        agentId: 'demo-seller',
        agentAddress: walletAddr,
        name: 'Smart Contract Audit',
        description: 'Automated Solidity security audit.',
        priceUsdt: '5.00',
        chain: 'polygon',
        category: 'security',
      });
      results.push(`Published service: ${svc2.name} (${svc2.priceUsdt} USDT)`);

      // 2. Create escrow
      const escrow = escrows.create({
        serviceId: svc1.id,
        serviceName: svc1.name,
        buyerAgentId: agent.agentId,
        sellerAgentId: 'demo-seller',
        buyerAddress: walletAddr,
        sellerAddress: walletAddr,
        amountUsdt: svc1.priceUsdt,
        chain: 'polygon',
        acceptanceCriteria: svc1.acceptanceCriteria,
      });
      results.push(`Created escrow: ${escrow.id} (${escrow.amountUsdt} USDT)`);

      // 3. Fund escrow
      escrows.fund(escrow.id, '0xdemo_fund_tx');
      results.push(`Funded escrow (TX: 0xdemo_fund_tx)`);

      // 4. Deliver & validate
      escrows.markInProgress(escrow.id);
      escrows.submitDeliverable(escrow.id, JSON.stringify({
        sentiment: 'positive',
        confidence: 0.91,
        analysis: 'Strong positive indicators found.',
      }));
      const { approved } = await escrows.validateAndRelease(escrow.id);
      results.push(`Deliverable validated: ${approved ? 'APPROVED' : 'REJECTED'}`);

      if (approved) {
        escrows.markReleased(escrow.id, '0xdemo_release_tx');
        results.push(`Escrow released (TX: 0xdemo_release_tx)`);
        services.recordCompletion(svc1.id, 4.0);
      }

      // 5. Create subscription
      const sub = subs.create({
        serviceId: svc2.id,
        serviceName: svc2.name,
        buyerAgentId: agent.agentId,
        sellerAgentId: 'demo-seller',
        buyerAddress: walletAddr,
        sellerAddress: walletAddr,
        amountUsdt: '0.50',
        chain: 'polygon',
        intervalMs: 86400000,
      });
      results.push(`Subscription created: ${sub.serviceName} (0.50 USDT/day)`);

      res.json({
        status: 'Demo scenario complete',
        steps: results,
        summary: {
          services: services.getAll().length,
          escrowsCompleted: 1,
          subscriptionsActive: subs.getActive().length,
          totalEscrowed: escrows.getTotalEscrowed(),
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
