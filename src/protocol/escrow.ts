import { v4 as uuidv4 } from 'uuid';
import { validateServiceOutput } from '../llm/claude';

export type EscrowStatus =
  | 'created'
  | 'funded'
  | 'service_in_progress'
  | 'delivered'
  | 'validating'
  | 'released'
  | 'refunded'
  | 'disputed';

export interface Escrow {
  id: string;
  serviceId: string;
  serviceName: string;
  buyerAgentId: string;
  sellerAgentId: string;
  buyerAddress: string;
  sellerAddress: string;
  amountUsdt: string;
  chain: string;
  status: EscrowStatus;
  acceptanceCriteria: string;
  deliverable?: string;
  validationResult?: {
    approved: boolean;
    score: number;
    feedback: string;
  };
  fundTxHash?: string;
  releaseTxHash?: string;
  refundTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export class EscrowEngine {
  private escrows: Map<string, Escrow> = new Map();

  create(params: {
    serviceId: string;
    serviceName: string;
    buyerAgentId: string;
    sellerAgentId: string;
    buyerAddress: string;
    sellerAddress: string;
    amountUsdt: string;
    chain: string;
    acceptanceCriteria: string;
    ttlHours?: number;
  }): Escrow {
    const escrow: Escrow = {
      id: uuidv4(),
      serviceId: params.serviceId,
      serviceName: params.serviceName,
      buyerAgentId: params.buyerAgentId,
      sellerAgentId: params.sellerAgentId,
      buyerAddress: params.buyerAddress,
      sellerAddress: params.sellerAddress,
      amountUsdt: params.amountUsdt,
      chain: params.chain,
      status: 'created',
      acceptanceCriteria: params.acceptanceCriteria,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + (params.ttlHours || 24) * 60 * 60 * 1000),
    };

    this.escrows.set(escrow.id, escrow);
    return escrow;
  }

  fund(id: string, txHash: string): Escrow {
    const escrow = this.getOrThrow(id);
    if (escrow.status !== 'created') throw new Error(`Cannot fund escrow in status: ${escrow.status}`);
    escrow.status = 'funded';
    escrow.fundTxHash = txHash;
    escrow.updatedAt = new Date();
    return escrow;
  }

  markInProgress(id: string): Escrow {
    const escrow = this.getOrThrow(id);
    if (escrow.status !== 'funded') throw new Error(`Cannot start work on escrow in status: ${escrow.status}`);
    escrow.status = 'service_in_progress';
    escrow.updatedAt = new Date();
    return escrow;
  }

  submitDeliverable(id: string, deliverable: string): Escrow {
    const escrow = this.getOrThrow(id);
    if (escrow.status !== 'service_in_progress')
      throw new Error(`Cannot submit deliverable for escrow in status: ${escrow.status}`);
    escrow.status = 'delivered';
    escrow.deliverable = deliverable;
    escrow.updatedAt = new Date();
    return escrow;
  }

  async validateAndRelease(id: string): Promise<{
    escrow: Escrow;
    approved: boolean;
  }> {
    const escrow = this.getOrThrow(id);
    if (escrow.status !== 'delivered')
      throw new Error(`Cannot validate escrow in status: ${escrow.status}`);

    escrow.status = 'validating';
    escrow.updatedAt = new Date();

    // AI validates the deliverable against acceptance criteria
    const result = await validateServiceOutput(
      escrow.serviceName,
      escrow.deliverable || '',
      escrow.acceptanceCriteria
    );

    escrow.validationResult = result;
    escrow.updatedAt = new Date();

    if (result.approved && result.score >= 60) {
      escrow.status = 'released';
      return { escrow, approved: true };
    } else {
      escrow.status = 'disputed';
      return { escrow, approved: false };
    }
  }

  markReleased(id: string, txHash: string): Escrow {
    const escrow = this.getOrThrow(id);
    escrow.status = 'released';
    escrow.releaseTxHash = txHash;
    escrow.updatedAt = new Date();
    return escrow;
  }

  markRefunded(id: string, txHash: string): Escrow {
    const escrow = this.getOrThrow(id);
    escrow.status = 'refunded';
    escrow.refundTxHash = txHash;
    escrow.updatedAt = new Date();
    return escrow;
  }

  get(id: string): Escrow | undefined {
    return this.escrows.get(id);
  }

  private getOrThrow(id: string): Escrow {
    const escrow = this.escrows.get(id);
    if (!escrow) throw new Error(`Escrow not found: ${id}`);
    return escrow;
  }

  getByBuyer(agentId: string): Escrow[] {
    return Array.from(this.escrows.values()).filter((e) => e.buyerAgentId === agentId);
  }

  getBySeller(agentId: string): Escrow[] {
    return Array.from(this.escrows.values()).filter((e) => e.sellerAgentId === agentId);
  }

  getActive(): Escrow[] {
    return Array.from(this.escrows.values()).filter(
      (e) => !['released', 'refunded'].includes(e.status)
    );
  }

  getAll(): Escrow[] {
    return Array.from(this.escrows.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  getExpired(): Escrow[] {
    const now = new Date();
    return Array.from(this.escrows.values()).filter(
      (e) =>
        e.expiresAt < now &&
        !['released', 'refunded'].includes(e.status)
    );
  }

  getTotalEscrowed(): string {
    const total = Array.from(this.escrows.values())
      .filter((e) => ['funded', 'service_in_progress', 'delivered', 'validating'].includes(e.status))
      .reduce((sum, e) => sum + parseFloat(e.amountUsdt), 0);
    return total.toFixed(2);
  }
}
