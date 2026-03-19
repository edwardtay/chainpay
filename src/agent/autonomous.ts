import { ChainPayAgent } from './agent';
import { agentReason, isLLMAvailable } from '../llm/claude';
import { CHAINS } from '../utils/chains';

/**
 * AutonomousLoop — The agent's brain. Runs continuously and makes decisions.
 *
 * Every cycle, the agent:
 * 1. Checks wallet balances across all chains
 * 2. Processes due subscription payments
 * 3. Monitors expired escrows and handles them
 * 4. Evaluates yield opportunities on idle funds
 * 5. Looks for arbitrage in service pricing
 * 6. Logs all decisions with AI reasoning
 *
 * This is what makes ChainPay a true autonomous agent — not a chatbot.
 */
export interface AutonomousEvent {
  timestamp: Date;
  type: 'subscription_paid' | 'escrow_expired' | 'yield_action' | 'balance_alert' | 'service_purchased' | 'decision';
  description: string;
  data: any;
  aiReasoning?: string;
}

export class AutonomousLoop {
  private running = false;
  private interval: NodeJS.Timeout | null = null;
  private events: AutonomousEvent[] = [];
  private cycleCount = 0;
  private lastBalances: Record<string, { native: string; usdt: string }> = {};

  constructor(
    private agent: ChainPayAgent,
    private intervalMs: number = 30000
  ) {}

  async start(intervalMs?: number): Promise<void> {
    if (this.running) return;
    if (intervalMs !== undefined) {
      this.intervalMs = intervalMs;
    }
    this.running = true;

    this.emit('decision', 'Autonomous loop started', { intervalMs: this.intervalMs });

    // Initial snapshot
    await this.snapshotBalances();

    this.interval = setInterval(async () => {
      if (!this.running) return;
      try {
        await this.cycle();
      } catch (err: any) {
        this.emit('decision', `Cycle error: ${err.message}`, { error: err.message });
      }
    }, this.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.emit('decision', 'Autonomous loop stopped', {});
  }

  private async cycle(): Promise<void> {
    this.cycleCount++;
    const actions: string[] = [];

    // 1. Process due subscriptions
    const subActions = await this.processDueSubscriptions();
    actions.push(...subActions);

    // 2. Handle expired escrows
    const escrowActions = await this.handleExpiredEscrows();
    actions.push(...escrowActions);

    // 3. Detect balance changes (incoming payments)
    const balanceActions = await this.detectBalanceChanges();
    actions.push(...balanceActions);

    // 4. Yield optimization (every 10th cycle to avoid spam)
    if (this.cycleCount % 10 === 0) {
      const yieldActions = await this.evaluateYieldOpportunities();
      actions.push(...yieldActions);
    }

    // 5. Auto-resolve expired escrows (refund buyer)
    if (this.cycleCount % 3 === 0) {
      const refundActions = await this.autoResolveExpiredEscrows();
      actions.push(...refundActions);
    }

    // 6. AI strategic decision (every 5th cycle if LLM available)
    if (this.cycleCount % 5 === 0 && isLLMAvailable()) {
      const strategy = await this.makeStrategicDecision();
      if (strategy) actions.push(strategy);
    }

    if (actions.length > 0) {
      this.emit('decision', `Cycle ${this.cycleCount}: ${actions.length} actions taken`, {
        cycle: this.cycleCount,
        actions,
      });
    }
  }

  private async processDueSubscriptions(): Promise<string[]> {
    const actions: string[] = [];
    const subs = this.agent.getSubscriptionEngine();
    const wallets = this.agent.getWalletManager();
    const dueSubs = subs.getDue();

    for (const sub of dueSubs) {
      try {
        const config = CHAINS[sub.chain];
        if (!config) continue;

        const amount = BigInt(Math.floor(parseFloat(sub.amountUsdt) * 10 ** config.usdtDecimals));

        const result = await wallets.sendGaslessOrStandard(sub.chain, {
          to: sub.sellerAddress,
          amount,
          token: config.usdtAddress,
        });

        subs.recordPayment(sub.id, result.hash, true);
        const msg = `Paid subscription: ${sub.serviceName} — ${sub.amountUsdt} USDT (${result.gasless ? 'gasless' : 'standard'})`;
        actions.push(msg);
        this.emit('subscription_paid', msg, {
          subscriptionId: sub.id,
          txHash: result.hash,
          gasless: result.gasless,
        });
      } catch (err: any) {
        subs.recordPayment(sub.id, undefined, false, err.message);
        actions.push(`Subscription payment failed: ${sub.serviceName} — ${err.message}`);
      }
    }

    return actions;
  }

  private async handleExpiredEscrows(): Promise<string[]> {
    const actions: string[] = [];
    const escrows = this.agent.getEscrowEngine();
    const expired = escrows.getExpired();

    for (const escrow of expired) {
      const msg = `Escrow expired: ${escrow.serviceName} (${escrow.amountUsdt} USDT) — status: ${escrow.status}`;
      actions.push(msg);
      this.emit('escrow_expired', msg, {
        escrowId: escrow.id,
        amount: escrow.amountUsdt,
        status: escrow.status,
      });

      // If funded but not delivered, recommend refund
      if (['funded', 'service_in_progress'].includes(escrow.status)) {
        if (isLLMAvailable()) {
          const decision = await agentReason(
            `Escrow ${escrow.id} for "${escrow.serviceName}" has expired with status "${escrow.status}". Should I refund the buyer?`,
            `Amount: ${escrow.amountUsdt} USDT, Created: ${escrow.createdAt.toISOString()}, Expired: ${escrow.expiresAt.toISOString()}`
          );
          this.emit('decision', `AI decision on expired escrow: ${decision.action}`, decision, decision.reasoning);
        }
      }
    }

    return actions;
  }

  private async detectBalanceChanges(): Promise<string[]> {
    const actions: string[] = [];
    const wallets = this.agent.getWalletManager();

    try {
      const currentBalances = await wallets.getAllBalances();

      for (const [chain, bal] of Object.entries(currentBalances)) {
        const prev = this.lastBalances[chain];
        if (!prev) continue;

        const currentUsdt = BigInt(bal.usdt || '0');
        const prevUsdt = BigInt(prev.usdt || '0');

        if (currentUsdt > prevUsdt) {
          const diff = currentUsdt - prevUsdt;
          const config = CHAINS[chain];
          const diffFormatted = config
            ? (Number(diff) / 10 ** config.usdtDecimals).toFixed(2)
            : diff.toString();

          const msg = `Incoming USDT detected on ${chain}: +${diffFormatted} USDT`;
          actions.push(msg);
          this.emit('balance_alert', msg, {
            chain,
            amount: diffFormatted,
            previousBalance: prev.usdt,
            currentBalance: bal.usdt,
          });

          // Auto-match to pending escrows and fund them.
          // Match by both chain AND amount (within 10% tolerance) to avoid
          // funding the wrong escrow when multiple are pending on the same chain.
          const pendingEscrows = this.agent.getEscrowEngine()
            .getAll()
            .filter(e => e.status === 'created' && e.chain === chain);

          for (const pending of pendingEscrows) {
            const pendingAmount = parseFloat(pending.amountUsdt);
            const incomingAmount = parseFloat(diffFormatted);
            // Require the incoming amount to be within 10% tolerance of the escrow amount
            const lowerBound = pendingAmount * 0.9;
            const upperBound = pendingAmount * 1.1;
            if (incomingAmount >= lowerBound && incomingAmount <= upperBound) {
              try {
                this.agent.getEscrowEngine().fund(pending.id, `auto-funded-${Date.now()}`);
                const fundMsg = `Auto-funded escrow ${pending.id} (${pending.amountUsdt} USDT) from incoming payment`;
                actions.push(fundMsg);
                this.emit('decision', fundMsg, {
                  escrowId: pending.id,
                  amount: pending.amountUsdt,
                  trigger: 'incoming_payment_detected',
                });
              } catch {
                // Already funded or invalid state
              }
              break; // Only fund one escrow per incoming payment
            }
          }
        }
      }

      this.lastBalances = currentBalances;
    } catch {
      // Balance check failed — RPC issue, skip this cycle
    }

    return actions;
  }

  private async evaluateYieldOpportunities(): Promise<string[]> {
    const actions: string[] = [];

    try {
      const balances = await this.agent.getWalletManager().getAllBalances();
      const escrows = this.agent.getEscrowEngine();
      const subs = this.agent.getSubscriptionEngine();

      const usdtBalances: Record<string, string> = {};
      for (const [chain, bal] of Object.entries(balances)) {
        usdtBalances[chain] = bal.usdt;
      }

      const escrowedAmount = parseFloat(escrows.getTotalEscrowed());
      const monthlySpend = subs.getMonthlySpend(this.agent.agentId);

      // Find the chain with most idle USDT
      let bestChain = '';
      let bestAmount = 0;
      for (const [chain, bal] of Object.entries(balances)) {
        const config = CHAINS[chain];
        if (!config || config.type !== 'evm') continue;
        const usdtAmount = parseInt(bal.usdt) / 10 ** config.usdtDecimals;
        if (usdtAmount > bestAmount) {
          bestAmount = usdtAmount;
          bestChain = chain;
        }
      }

      const requiredBuffer = escrowedAmount + monthlySpend * 2;
      const idleAmount = bestAmount - requiredBuffer;

      if (idleAmount > 10 && bestChain) {
        const msg = `Yield opportunity: ${idleAmount.toFixed(2)} USDT idle on ${bestChain} (buffer: ${requiredBuffer.toFixed(2)}). Could supply to Aave V3.`;
        actions.push(msg);
        this.emit('yield_action', msg, {
          chain: bestChain,
          idleAmount: idleAmount.toFixed(2),
          requiredBuffer: requiredBuffer.toFixed(2),
          recommendation: 'supply_to_aave',
        });
      }
    } catch {
      // Skip yield check on error
    }

    return actions;
  }

  private async autoResolveExpiredEscrows(): Promise<string[]> {
    const actions: string[] = [];
    const escrows = this.agent.getEscrowEngine();
    const expired = escrows.getExpired();

    for (const escrow of expired) {
      // Auto-refund expired funded escrows (seller never delivered)
      if (['funded', 'service_in_progress'].includes(escrow.status)) {
        try {
          escrows.markRefunded(escrow.id, `auto-refund-expired-${Date.now()}`);
          const msg = `Auto-refunded expired escrow ${escrow.id.slice(0, 8)}... (${escrow.amountUsdt} USDT) — seller didn't deliver in time`;
          actions.push(msg);
          this.emit('decision', msg, {
            escrowId: escrow.id,
            action: 'auto_refund',
            reason: 'expired_without_delivery',
          });
        } catch {
          // Already resolved
        }
      }
    }
    return actions;
  }

  private async makeStrategicDecision(): Promise<string | null> {
    const escrows = this.agent.getEscrowEngine();
    const services = this.agent.getServiceRegistry();
    const subs = this.agent.getSubscriptionEngine();

    const context = `
Agent state:
- Active escrows: ${escrows.getActive().length} (${escrows.getTotalEscrowed()} USDT locked)
- Published services: ${services.getAll().filter(s => s.active).length}
- Active subscriptions: ${subs.getActive().length}
- Monthly subscription spend: ${subs.getMonthlySpend(this.agent.agentId).toFixed(2)} USDT
- Cycle: ${this.cycleCount}
    `.trim();

    const decision = await agentReason(
      'Review the agent state. Are there any actions I should take to optimize operations, reduce risk, or improve service availability?',
      context
    );

    if (decision.action !== 'no_action') {
      const msg = `Strategic decision: ${decision.action} — ${decision.reasoning}`;
      this.emit('decision', msg, decision, decision.reasoning);
      return msg;
    }

    return null;
  }

  private async snapshotBalances(): Promise<void> {
    try {
      this.lastBalances = await this.agent.getWalletManager().getAllBalances();
    } catch {
      this.lastBalances = {};
    }
  }

  private emit(type: AutonomousEvent['type'], description: string, data: any, aiReasoning?: string): void {
    this.events.push({
      timestamp: new Date(),
      type,
      description,
      data,
      aiReasoning,
    });

    // Keep last 200 events
    if (this.events.length > 200) {
      this.events = this.events.slice(-200);
    }

    console.log(`[Agent] ${description}`);
  }

  getEvents(): AutonomousEvent[] {
    return this.events;
  }

  getStatus(): {
    running: boolean;
    cycleCount: number;
    intervalMs: number;
    eventCount: number;
    lastEvents: AutonomousEvent[];
  } {
    return {
      running: this.running,
      cycleCount: this.cycleCount,
      intervalMs: this.intervalMs,
      eventCount: this.events.length,
      lastEvents: this.events.slice(-5),
    };
  }

  isRunning(): boolean {
    return this.running;
  }
}
