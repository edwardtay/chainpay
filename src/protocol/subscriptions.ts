import { v4 as uuidv4 } from 'uuid';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';

export interface Subscription {
  id: string;
  serviceId: string;
  serviceName: string;
  buyerAgentId: string;
  sellerAgentId: string;
  buyerAddress: string;
  sellerAddress: string;
  amountUsdt: string;
  chain: string;
  intervalMs: number; // Payment interval in ms
  status: SubscriptionStatus;
  nextPaymentAt: Date;
  paymentHistory: SubscriptionPayment[];
  createdAt: Date;
  maxPayments?: number; // Optional limit
}

export interface SubscriptionPayment {
  timestamp: Date;
  txHash?: string;
  amount: string;
  success: boolean;
  error?: string;
}

export class SubscriptionEngine {
  private subscriptions: Map<string, Subscription> = new Map();

  create(params: {
    serviceId: string;
    serviceName: string;
    buyerAgentId: string;
    sellerAgentId: string;
    buyerAddress: string;
    sellerAddress: string;
    amountUsdt: string;
    chain: string;
    intervalMs: number;
    maxPayments?: number;
  }): Subscription {
    const sub: Subscription = {
      id: uuidv4(),
      serviceId: params.serviceId,
      serviceName: params.serviceName,
      buyerAgentId: params.buyerAgentId,
      sellerAgentId: params.sellerAgentId,
      buyerAddress: params.buyerAddress,
      sellerAddress: params.sellerAddress,
      amountUsdt: params.amountUsdt,
      chain: params.chain,
      intervalMs: params.intervalMs,
      status: 'active',
      nextPaymentAt: new Date(Date.now() + params.intervalMs),
      paymentHistory: [],
      createdAt: new Date(),
      maxPayments: params.maxPayments,
    };

    this.subscriptions.set(sub.id, sub);
    return sub;
  }

  getDue(): Subscription[] {
    const now = new Date();
    return Array.from(this.subscriptions.values()).filter(
      (s) => s.status === 'active' && s.nextPaymentAt <= now
    );
  }

  recordPayment(id: string, txHash: string | undefined, success: boolean, error?: string): void {
    const sub = this.subscriptions.get(id);
    if (!sub) return;

    sub.paymentHistory.push({
      timestamp: new Date(),
      txHash,
      amount: sub.amountUsdt,
      success,
      error,
    });

    if (success) {
      sub.nextPaymentAt = new Date(Date.now() + sub.intervalMs);

      // Check max payments
      if (sub.maxPayments && sub.paymentHistory.filter((p) => p.success).length >= sub.maxPayments) {
        sub.status = 'expired';
      }
    }
  }

  pause(id: string): void {
    const sub = this.subscriptions.get(id);
    if (sub && sub.status === 'active') sub.status = 'paused';
  }

  resume(id: string): void {
    const sub = this.subscriptions.get(id);
    if (sub && sub.status === 'paused') {
      sub.status = 'active';
      sub.nextPaymentAt = new Date(Date.now() + sub.intervalMs);
    }
  }

  cancel(id: string): void {
    const sub = this.subscriptions.get(id);
    if (sub) sub.status = 'cancelled';
  }

  get(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  getByBuyer(agentId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((s) => s.buyerAgentId === agentId);
  }

  getActive(): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((s) => s.status === 'active');
  }

  getAll(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  getMonthlySpend(agentId: string): number {
    const msPerMonth = 30 * 24 * 60 * 60 * 1000;
    return Array.from(this.subscriptions.values())
      .filter((s) => s.buyerAgentId === agentId && s.status === 'active')
      .reduce((sum, s) => sum + (parseFloat(s.amountUsdt) * msPerMonth) / s.intervalMs, 0);
  }
}
