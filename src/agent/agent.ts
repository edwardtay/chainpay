import { MultiChainWalletManager } from '../services/wallet-manager';
import { ServiceRegistry } from '../protocol/service-registry';
import { EscrowEngine, Escrow } from '../protocol/escrow';
import { SubscriptionEngine } from '../protocol/subscriptions';
import { NegotiationEngine } from '../protocol/negotiation';
import { DisputeEngine } from '../protocol/disputes';
import { AutonomousLoop } from './autonomous';
import { agentReason, parseNaturalLanguageIntent, validateServiceOutput } from '../llm/claude';
import { CHAINS, getChainConfig } from '../utils/chains';
import { v4 as uuidv4 } from 'uuid';

export interface AgentAction {
  timestamp: Date;
  type: string;
  description: string;
  data: any;
  aiReasoning?: string;
}

/**
 * ChainPayAgent — Autonomous Agent Commerce Protocol
 *
 * An AI-powered agent that participates in agent-to-agent economy:
 * 1. Publishes services with USDT pricing
 * 2. Discovers and purchases services from other agents
 * 3. Manages escrow for trustless service delivery
 * 4. Validates deliverables using AI before releasing payment
 * 5. Handles recurring subscription payments
 * 6. Optimizes idle capital via Aave yield
 * 7. Operates across 6+ chains with self-custodial WDK wallets
 */
export class ChainPayAgent {
  public readonly agentId: string;
  private walletManager: MultiChainWalletManager;
  private serviceRegistry: ServiceRegistry;
  private escrowEngine: EscrowEngine;
  private subscriptionEngine: SubscriptionEngine;
  private negotiationEngine: NegotiationEngine;
  private disputeEngine: DisputeEngine;
  private autonomous: AutonomousLoop;
  private actionLog: AgentAction[] = [];
  private initialized = false;
  private pendingPayment: { to: string; amount: string; chain: string } | null = null;

  constructor(seedPhrase: string, agentId?: string) {
    this.agentId = agentId || uuidv4();
    this.walletManager = new MultiChainWalletManager(seedPhrase);
    this.serviceRegistry = new ServiceRegistry();
    this.escrowEngine = new EscrowEngine();
    this.subscriptionEngine = new SubscriptionEngine();
    this.negotiationEngine = new NegotiationEngine();
    this.disputeEngine = new DisputeEngine();
    this.autonomous = new AutonomousLoop(this);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.walletManager.initialize();
    this.initialized = true;
    this.log('init', 'Agent initialized', {
      agentId: this.agentId,
      chains: this.walletManager.getInitializedChains(),
    });
  }

  private log(type: string, description: string, data: any, aiReasoning?: string): void {
    this.actionLog.push({
      timestamp: new Date(),
      type,
      description,
      data,
      aiReasoning,
    });
  }

  // ==================== NATURAL LANGUAGE INTERFACE ====================

  async chat(message: string): Promise<string> {
    await this.initialize();

    const intent = await parseNaturalLanguageIntent(message);
    this.log('chat_intent', `Parsed intent: ${intent.intent}`, { message, intent });

    switch (intent.intent) {
      case 'publish_service':
        return this.handlePublishService(intent.params);
      case 'buy_service':
        return this.handleBuyService(intent.params);
      case 'check_balance':
        return this.handleBalances(intent.params.chain);
      case 'send_payment':
        return this.handleSendPaymentConfirmation(intent.params);
      case 'confirm_payment':
        return this.handleConfirmPayment();
      case 'list_services':
        return this.handleListServices(intent.params);
      case 'escrow_status':
        return this.handleEscrowStatus(intent.params);
      case 'create_invoice':
        return this.handleCreateInvoice(intent.params);
      case 'start_subscription':
        return this.handleStartSubscription(intent.params);
      case 'stop_subscription':
        return this.handleStopSubscription(intent.params);
      case 'optimize':
        return this.handleOptimize();
      case 'help':
        return this.handleHelp();
      default:
        return `I understood your message but I'm not sure what action to take. Try:\n` +
          `- "Publish an image generation service for 0.10 USDT on polygon"\n` +
          `- "Find services for data analysis under 5 USDT"\n` +
          `- "Check my balances"\n` +
          `- "Show active escrows"\n` +
          `- "Optimize my idle funds"`;
    }
  }

  // ==================== SERVICE MANAGEMENT ====================

  private async handlePublishService(params: Record<string, any>): Promise<string> {
    const chain = params.chain || 'polygon';
    const address = await this.walletManager.getAddress(chain);

    const service = this.serviceRegistry.publish({
      agentId: this.agentId,
      agentAddress: address,
      name: params.name || 'Unnamed Service',
      description: params.description || '',
      priceUsdt: params.priceUsdt?.toString() || '1.00',
      chain,
      category: params.category,
      acceptanceCriteria: params.acceptanceCriteria,
    });

    this.log('publish_service', `Published: ${service.name}`, service);

    return `Service published!\n` +
      `  ID: ${service.id}\n` +
      `  Name: ${service.name}\n` +
      `  Price: ${service.priceUsdt} USDT\n` +
      `  Chain: ${getChainConfig(chain).name}\n` +
      `  Payment address: ${address}`;
  }

  private async handleListServices(params: Record<string, any>): Promise<string> {
    const services = this.serviceRegistry.find({
      category: params.category,
      maxPrice: params.maxPrice,
      search: params.query,
    });

    if (services.length === 0) return 'No services found matching your criteria.';

    const lines = ['Available Services:'];
    for (const s of services) {
      lines.push(`  [${s.id.slice(0, 8)}] ${s.name} — ${s.priceUsdt} USDT (${getChainConfig(s.chain).name}) | ${s.completedJobs} jobs, rating: ${s.rating.toFixed(1)}/5`);
    }
    return lines.join('\n');
  }

  // ==================== PURCHASE & ESCROW ====================

  private async handleBuyService(params: Record<string, any>): Promise<string> {
    // Find matching services
    const services = this.serviceRegistry.find({
      search: params.query,
      maxPrice: params.maxPrice,
    });

    if (services.length === 0) return 'No matching services found.';

    // AI decides which service to buy
    const context = `Available services:\n${services.map((s) =>
      `- ${s.id}: ${s.name} (${s.priceUsdt} USDT, ${s.completedJobs} completed, rating ${s.rating.toFixed(1)})`
    ).join('\n')}\n\nBudget: ${params.maxPrice || 'no limit'} USDT`;

    const decision = await agentReason(
      `Select the best service to purchase for: "${params.query}"`,
      context
    );

    // Use AI-selected service if it returned a valid serviceId, otherwise best-rated
    let selectedService = services[0];
    if (decision.params.serviceId) {
      const aiPick = services.find(s => s.id === decision.params.serviceId || s.id.startsWith(decision.params.serviceId));
      if (aiPick) selectedService = aiPick;
    }
    if (!selectedService) return 'No suitable service found.';

    // Create escrow
    const buyerAddress = await this.walletManager.getAddress(selectedService.chain);
    const escrow = this.escrowEngine.create({
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      buyerAgentId: this.agentId,
      sellerAgentId: selectedService.agentId,
      buyerAddress,
      sellerAddress: selectedService.agentAddress,
      amountUsdt: selectedService.priceUsdt,
      chain: selectedService.chain,
      acceptanceCriteria: selectedService.acceptanceCriteria,
    });

    this.log('create_escrow', `Created escrow for ${selectedService.name}`, escrow, decision.reasoning);

    return `Purchasing: ${selectedService.name}\n` +
      `  Escrow ID: ${escrow.id}\n` +
      `  Amount: ${selectedService.priceUsdt} USDT\n` +
      `  Chain: ${getChainConfig(selectedService.chain).name}\n` +
      `  Status: ${escrow.status}\n` +
      `  AI reasoning: ${decision.reasoning}\n\n` +
      `Escrow created. Funds will be held until delivery is validated.`;
  }

  /**
   * Fund an escrow by verifying the buyer has sufficient USDT balance.
   *
   * Escrow model: Self-custodial hold. Funds remain in the buyer's WDK wallet
   * but are tracked as "locked" by the escrow engine. The agent will not spend
   * locked funds on other operations (subscriptions, yield, etc.) because
   * getTotalEscrowed() is subtracted from available balance in all decisions.
   *
   * On release, the agent sends USDT directly to the seller.
   * On refund, the lock is simply removed (funds were never moved).
   *
   * This avoids the gas cost and smart contract complexity of on-chain escrow
   * while maintaining correctness through the agent's internal accounting.
   */
  async fundEscrow(escrowId: string): Promise<string> {
    const escrow = this.escrowEngine.get(escrowId);
    if (!escrow) return `Escrow not found: ${escrowId}`;

    try {
      const account = this.walletManager.getAccount(escrow.chain);
      const config = getChainConfig(escrow.chain);
      const requiredAmount = BigInt(Math.floor(parseFloat(escrow.amountUsdt) * 10 ** config.usdtDecimals));

      // Verify buyer has sufficient balance to cover the escrow
      let balance = BigInt(0);
      if (config.usdtAddress) {
        const bal = await account.getTokenBalance(config.usdtAddress);
        balance = BigInt(bal?.toString() || '0');
      }

      const alreadyEscrowed = BigInt(
        Math.floor(parseFloat(this.escrowEngine.getTotalEscrowed()) * 10 ** config.usdtDecimals)
      );
      const available = balance - alreadyEscrowed;

      if (available < requiredAmount) {
        return `Insufficient balance to fund escrow. Need ${escrow.amountUsdt} USDT, available: ${(Number(available) / 10 ** config.usdtDecimals).toFixed(2)} USDT (${(Number(balance) / 10 ** config.usdtDecimals).toFixed(2)} total - ${this.escrowEngine.getTotalEscrowed()} escrowed)`;
      }

      // Mark as funded — funds are held in buyer's wallet, tracked by escrow engine
      this.escrowEngine.fund(escrowId, `hold-verified-${Date.now()}`);
      this.log('fund_escrow', `Escrow ${escrowId} funded (balance hold verified)`, {
        escrowId,
        amount: escrow.amountUsdt,
        balanceVerified: true,
      });

      return `Escrow funded!\n  Amount: ${escrow.amountUsdt} USDT (held in wallet)\n  Status: funded\n  Note: Funds held in self-custodial wallet. Released to seller on delivery validation.`;
    } catch (error: any) {
      return `Failed to fund escrow: ${error.message}`;
    }
  }

  async submitDeliverable(escrowId: string, deliverable: string): Promise<string> {
    try {
      this.escrowEngine.markInProgress(escrowId);
      this.escrowEngine.submitDeliverable(escrowId, deliverable);

      // AI validates the deliverable
      const { escrow, approved } = await this.escrowEngine.validateAndRelease(escrowId);

      this.log('validate_deliverable', `Validated escrow ${escrowId}: ${approved ? 'APPROVED' : 'REJECTED'}`, {
        escrowId,
        approved,
        validation: escrow.validationResult,
      });

      if (approved) {
        // Release funds to seller
        try {
          const account = this.walletManager.getAccount(escrow.chain);
          const config = getChainConfig(escrow.chain);
          const amount = BigInt(Math.floor(parseFloat(escrow.amountUsdt) * 10 ** config.usdtDecimals));

          const result = await account.sendTransaction({
            to: escrow.sellerAddress,
            amount,
            token: config.usdtAddress,
          });

          this.escrowEngine.markReleased(escrowId, result.hash);
          this.serviceRegistry.recordCompletion(escrow.serviceId, escrow.validationResult!.score / 20);

          return `Deliverable APPROVED (score: ${escrow.validationResult!.score}/100)\n` +
            `  Funds released to seller\n` +
            `  TX: ${result.hash}\n` +
            `  Feedback: ${escrow.validationResult!.feedback}`;
        } catch (error: any) {
          return `Deliverable approved but fund release failed: ${error.message}`;
        }
      } else {
        return `Deliverable REJECTED (score: ${escrow.validationResult!.score}/100)\n` +
          `  Funds held in escrow\n` +
          `  Feedback: ${escrow.validationResult!.feedback}\n` +
          `  Status: disputed — seller can resubmit or buyer can request refund`;
      }
    } catch (error: any) {
      return `Validation failed: ${error.message}`;
    }
  }

  // ==================== SUBSCRIPTIONS ====================

  private async handleStartSubscription(params: Record<string, any>): Promise<string> {
    const service = this.serviceRegistry.get(params.serviceId);
    if (!service) return `Service not found: ${params.serviceId}`;

    const buyerAddress = await this.walletManager.getAddress(service.chain);
    const intervalMs = this.parseInterval(params.interval || '1d');

    const sub = this.subscriptionEngine.create({
      serviceId: service.id,
      serviceName: service.name,
      buyerAgentId: this.agentId,
      sellerAgentId: service.agentId,
      buyerAddress,
      sellerAddress: service.agentAddress,
      amountUsdt: service.priceUsdt,
      chain: service.chain,
      intervalMs,
      maxPayments: params.maxPayments,
    });

    this.log('create_subscription', `Subscribed to ${service.name}`, sub);

    return `Subscription created!\n` +
      `  ID: ${sub.id}\n` +
      `  Service: ${service.name}\n` +
      `  Amount: ${service.priceUsdt} USDT / ${this.formatInterval(intervalMs)}\n` +
      `  Next payment: ${sub.nextPaymentAt.toISOString()}`;
  }

  private async handleStopSubscription(params: Record<string, any>): Promise<string> {
    const sub = this.subscriptionEngine.get(params.subscriptionId);
    if (!sub) return `Subscription not found: ${params.subscriptionId}`;

    this.subscriptionEngine.cancel(params.subscriptionId);
    this.log('cancel_subscription', `Cancelled subscription ${params.subscriptionId}`, sub);

    return `Subscription cancelled: ${sub.serviceName}`;
  }

  // ==================== PAYMENTS & WALLETS ====================

  private formatNativeBalance(rawNative: string, config: { type: string; nativeSymbol: string }): string {
    // EVM chains return native balance in wei (1e18), others return raw units
    if (config.type === 'evm') {
      const val = Number(BigInt(rawNative || '0')) / 1e18;
      return val.toFixed(6);
    }
    return rawNative;
  }

  private formatUsdtBalance(rawUsdt: string, config: { usdtDecimals: number }): string {
    const val = Number(BigInt(rawUsdt || '0')) / 10 ** config.usdtDecimals;
    return val.toFixed(2);
  }

  private async handleBalances(chain?: string): Promise<string> {
    if (chain) {
      const bal = await this.walletManager.getBalance(chain);
      const config = CHAINS[chain.toLowerCase()];
      if (!config) return `${chain}: ${bal.native} native | ${bal.usdt} USDT`;
      const nativeFormatted = this.formatNativeBalance(bal.native, config);
      const usdtFormatted = this.formatUsdtBalance(bal.usdt, config);
      return `${config.name}: ${nativeFormatted} ${config.nativeSymbol} | ${usdtFormatted} USDT`;
    }

    const balances = await this.walletManager.getAllBalances();
    const lines = ['Wallet Balances:'];
    for (const [ch, bal] of Object.entries(balances)) {
      const config = CHAINS[ch];
      if (config) {
        const nativeFormatted = this.formatNativeBalance(bal.native, config);
        const usdtFormatted = this.formatUsdtBalance(bal.usdt, config);
        lines.push(`  ${config.name}: ${nativeFormatted} ${config.nativeSymbol} | ${usdtFormatted} USDT`);
      }
    }

    const escrowed = this.escrowEngine.getTotalEscrowed();
    const monthlySpend = this.subscriptionEngine.getMonthlySpend(this.agentId);
    lines.push(`\n  Escrowed: ${escrowed} USDT`);
    lines.push(`  Monthly subscriptions: ${monthlySpend.toFixed(2)} USDT/month`);

    return lines.join('\n');
  }

  private async handleSendPaymentConfirmation(params: Record<string, any>): Promise<string> {
    const chain = params.chain || 'polygon';
    const config = getChainConfig(chain);
    const amount = params.amount || '0';

    // Store the pending payment for confirmation
    this.pendingPayment = { to: params.to, amount, chain };

    this.log('payment_quote', `Payment quote generated`, { to: params.to, amount, chain });

    return `Payment Quote:\n` +
      `  Recipient: ${params.to}\n` +
      `  Amount: ${amount} USDT\n` +
      `  Chain: ${config.name}\n` +
      `  Estimated fee: ~0.01 ${config.nativeSymbol}\n\n` +
      `Type "confirm" to execute this payment, or anything else to cancel.`;
  }

  private async handleConfirmPayment(): Promise<string> {
    if (!this.pendingPayment) {
      return 'No pending payment to confirm. Use "send" to initiate a payment first.';
    }

    const { to, amount, chain } = this.pendingPayment;
    this.pendingPayment = null;
    return this.handleSendPayment({ to, amount, chain });
  }

  private async handleSendPayment(params: Record<string, any>): Promise<string> {
    const chain = params.chain || 'polygon';
    const config = getChainConfig(chain);
    const account = this.walletManager.getAccount(chain);
    const amount = BigInt(Math.floor(parseFloat(params.amount) * 10 ** config.usdtDecimals));

    try {
      const result = await account.sendTransaction({
        to: params.to,
        amount,
        token: config.usdtAddress,
      });

      this.log('send_payment', `Sent ${params.amount} USDT to ${params.to}`, {
        chain,
        amount: params.amount,
        to: params.to,
        txHash: result.hash,
      });

      return `Payment sent!\n  Amount: ${params.amount} USDT\n  To: ${params.to}\n  Chain: ${config.name}\n  TX: ${result.hash}`;
    } catch (error: any) {
      return `Payment failed: ${error.message}`;
    }
  }

  private async handleCreateInvoice(params: Record<string, any>): Promise<string> {
    const chain = params.chain || 'polygon';
    const address = await this.walletManager.getAddress(chain);
    const config = getChainConfig(chain);

    return `Payment Invoice\n` +
      `  Amount: ${params.amount} USDT\n` +
      `  Chain: ${config.name}\n` +
      `  Send to: ${address}\n` +
      `  USDT contract: ${config.usdtAddress}\n` +
      `  Memo: ${params.memo || 'N/A'}`;
  }

  private async handleEscrowStatus(params: Record<string, any>): Promise<string> {
    if (params.escrowId) {
      const escrow = this.escrowEngine.get(params.escrowId);
      if (!escrow) return `Escrow not found: ${params.escrowId}`;
      return this.formatEscrow(escrow);
    }

    const escrows = this.escrowEngine.getActive();
    if (escrows.length === 0) return 'No active escrows.';

    const lines = ['Active Escrows:'];
    for (const e of escrows) {
      lines.push(`  [${e.status.toUpperCase()}] ${e.id.slice(0, 8)}... | ${e.serviceName} | ${e.amountUsdt} USDT`);
    }
    lines.push(`\nTotal escrowed: ${this.escrowEngine.getTotalEscrowed()} USDT`);
    return lines.join('\n');
  }

  // ==================== AUTONOMOUS OPERATIONS ====================

  private async handleOptimize(): Promise<string> {
    const balances = await this.walletManager.getAllBalances();
    const context = `Current balances:\n${Object.entries(balances)
      .map(([ch, b]) => `${ch}: ${b.usdt} USDT`)
      .join('\n')}\n\nActive escrows: ${this.escrowEngine.getActive().length}\nTotal escrowed: ${this.escrowEngine.getTotalEscrowed()} USDT\nMonthly subscription spend: ${this.subscriptionEngine.getMonthlySpend(this.agentId).toFixed(2)} USDT`;

    const decision = await agentReason(
      'Should I optimize yield on idle funds? Consider Aave supply, fund consolidation, or position changes.',
      context
    );

    this.log('optimize', 'AI optimization decision', decision);

    return `AI Analysis:\n` +
      `  Action: ${decision.action}\n` +
      `  Reasoning: ${decision.reasoning}\n` +
      `  Confidence: ${(decision.confidence * 100).toFixed(0)}%\n` +
      `  Params: ${JSON.stringify(decision.params)}`;
  }

  async startAutonomousLoop(intervalMs: number = 30000): Promise<void> {
    await this.autonomous.start(intervalMs);
    this.log('autonomous_start', 'Autonomous agent brain started', { intervalMs });
  }

  stopAutonomousLoop(): void {
    this.autonomous.stop();
    this.log('autonomous_stop', 'Autonomous agent brain stopped', {});
  }

  getAutonomous(): AutonomousLoop {
    return this.autonomous;
  }

  // ==================== DIRECT COMMANDS (for API/CLI) ====================

  async processCommand(input: string): Promise<string> {
    await this.initialize();
    const cmd = input.trim().toLowerCase();

    // Direct commands (no LLM needed)
    if (cmd === 'addresses') {
      const addrs = await this.walletManager.getAllAddresses();
      const lines = ['Receiving Addresses:'];
      for (const [ch, addr] of Object.entries(addrs)) {
        const config = CHAINS[ch];
        if (config) lines.push(`  ${config.name}: ${addr}`);
      }
      return lines.join('\n');
    }

    if (cmd === 'escrows') return this.handleEscrowStatus({});
    if (cmd === 'services') return this.handleListServices({});
    if (cmd === 'subscriptions') {
      const subs = this.subscriptionEngine.getAll();
      if (subs.length === 0) return 'No subscriptions.';
      return subs.map((s) =>
        `[${s.status.toUpperCase()}] ${s.id.slice(0, 8)}... | ${s.serviceName} | ${s.amountUsdt} USDT / ${this.formatInterval(s.intervalMs)}`
      ).join('\n');
    }
    if (cmd === 'log') {
      return this.actionLog.slice(-10).map((a) =>
        `[${a.timestamp.toISOString()}] ${a.type}: ${a.description}${a.aiReasoning ? ` (AI: ${a.aiReasoning})` : ''}`
      ).join('\n');
    }
    if (cmd.startsWith('fund ')) return this.fundEscrow(cmd.slice(5).trim());
    if (cmd.startsWith('deliver ')) {
      const parts = cmd.slice(8).trim().split(' ', 1);
      const rest = cmd.slice(8 + (parts[0]?.length || 0)).trim();
      return this.submitDeliverable(parts[0] || '', rest || 'Deliverable submitted');
    }
    if (cmd === 'start loop') {
      await this.startAutonomousLoop();
      return 'Autonomous loop started (30s interval). Processing subscriptions and monitoring escrows.';
    }
    if (cmd === 'stop loop') {
      this.stopAutonomousLoop();
      return 'Autonomous loop stopped.';
    }

    // Everything else goes through LLM
    return this.chat(input);
  }

  // ==================== HELPERS ====================

  private formatEscrow(e: Escrow): string {
    return `Escrow: ${e.id}\n` +
      `  Service: ${e.serviceName}\n` +
      `  Amount: ${e.amountUsdt} USDT\n` +
      `  Chain: ${getChainConfig(e.chain).name}\n` +
      `  Status: ${e.status}\n` +
      `  Buyer: ${e.buyerAddress}\n` +
      `  Seller: ${e.sellerAddress}\n` +
      (e.fundTxHash ? `  Fund TX: ${e.fundTxHash}\n` : '') +
      (e.releaseTxHash ? `  Release TX: ${e.releaseTxHash}\n` : '') +
      (e.validationResult ? `  Validation: ${e.validationResult.approved ? 'APPROVED' : 'REJECTED'} (${e.validationResult.score}/100)\n    ${e.validationResult.feedback}\n` : '') +
      `  Created: ${e.createdAt.toISOString()}\n` +
      `  Expires: ${e.expiresAt.toISOString()}`;
  }

  private parseInterval(str: string): number {
    const match = str.match(/(\d+)\s*(s|m|h|d|w)/i);
    if (!match) return 24 * 60 * 60 * 1000; // Default 1 day
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
    return val * (multipliers[unit] || 86400000);
  }

  private formatInterval(ms: number): string {
    if (ms < 60000) return `${ms / 1000}s`;
    if (ms < 3600000) return `${ms / 60000}m`;
    if (ms < 86400000) return `${ms / 3600000}h`;
    return `${ms / 86400000}d`;
  }

  private handleHelp(): string {
    return `ChainPay — Self-Custodial Agent Commerce Protocol
Powered by Tether WDK | Supports USD₮ and XAU₮

Natural language commands (AI-powered):
  "Publish a data analysis service for 2 USDT on polygon"
  "Find services for image generation under 1 USDT"
  "Buy image generation service"
  "Check my balances"
  "Send 10 USDT to 0x... on arbitrum"
  "Create invoice for 50 USDT on ethereum"
  "Subscribe to service <id> every 1d"
  "Cancel subscription <id>"
  "Optimize my idle funds"
  "Show active escrows"

Direct commands:
  addresses     — Show all wallet addresses
  balances      — Show all balances
  services      — List published services
  escrows       — Show active escrows
  subscriptions — Show subscriptions
  fund <id>     — Fund an escrow
  deliver <id>  — Submit deliverable for validation
  start loop    — Start autonomous operations
  stop loop     — Stop autonomous operations
  log           — Show recent action log
  help          — This message

Supported chains: ethereum, polygon, arbitrum, ton, tron, solana`;
  }

  // ==================== GETTERS ====================

  getActionLog(): AgentAction[] { return this.actionLog; }
  getServiceRegistry(): ServiceRegistry { return this.serviceRegistry; }
  getEscrowEngine(): EscrowEngine { return this.escrowEngine; }
  getSubscriptionEngine(): SubscriptionEngine { return this.subscriptionEngine; }
  getNegotiationEngine(): NegotiationEngine { return this.negotiationEngine; }
  getDisputeEngine(): DisputeEngine { return this.disputeEngine; }
  getWalletManager(): MultiChainWalletManager { return this.walletManager; }
}
