import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

// ==================== TYPES ====================

export type DisputeStatus =
  | 'open'
  | 'seller_resubmitted'
  | 'refund_requested'
  | 'escalated'
  | 'resolved_release'
  | 'resolved_partial_refund'
  | 'resolved_full_refund';

export type DisputeResolution = 'release' | 'partial_refund' | 'full_refund';

export interface DisputeMessage {
  id: string;
  from: 'buyer' | 'seller';
  agentId: string;
  content: string;
  timestamp: Date;
}

export interface ArbitrationResult {
  decision: DisputeResolution;
  reasoning: string;
  refundPercentage: number; // 0 = full release to seller, 100 = full refund to buyer
  confidence: number;
}

export interface Dispute {
  id: string;
  escrowId: string;
  serviceId: string;
  serviceName: string;
  buyerAgentId: string;
  sellerAgentId: string;
  amountUsdt: string;
  acceptanceCriteria: string;
  deliverable: string;
  validationFeedback: string;
  status: DisputeStatus;
  messages: DisputeMessage[];
  arbitrationResult?: ArbitrationResult;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== DISPUTE ENGINE ====================

export class DisputeEngine {
  private disputes: Map<string, Dispute> = new Map();

  /**
   * Create a dispute from a disputed escrow.
   */
  createFromEscrow(params: {
    escrowId: string;
    serviceId: string;
    serviceName: string;
    buyerAgentId: string;
    sellerAgentId: string;
    amountUsdt: string;
    acceptanceCriteria: string;
    deliverable: string;
    validationFeedback: string;
  }): Dispute {
    // Prevent duplicate disputes for the same escrow
    const existing = this.getByEscrowId(params.escrowId);
    if (existing) {
      throw new Error(`Dispute already exists for escrow ${params.escrowId}: ${existing.id}`);
    }

    const dispute: Dispute = {
      id: uuidv4(),
      escrowId: params.escrowId,
      serviceId: params.serviceId,
      serviceName: params.serviceName,
      buyerAgentId: params.buyerAgentId,
      sellerAgentId: params.sellerAgentId,
      amountUsdt: params.amountUsdt,
      acceptanceCriteria: params.acceptanceCriteria,
      deliverable: params.deliverable,
      validationFeedback: params.validationFeedback,
      status: 'open',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.disputes.set(dispute.id, dispute);
    return dispute;
  }

  /**
   * Either party submits an argument to the dispute.
   */
  addMessage(
    disputeId: string,
    role: 'buyer' | 'seller',
    agentId: string,
    content: string
  ): DisputeMessage {
    const dispute = this.getOrThrow(disputeId);
    if (this.isResolved(dispute)) {
      throw new Error(`Dispute ${disputeId} is already resolved (${dispute.status})`);
    }

    // Verify the agent is actually a party to this dispute
    if (role === 'buyer' && agentId !== dispute.buyerAgentId) {
      throw new Error('Agent is not the buyer in this dispute');
    }
    if (role === 'seller' && agentId !== dispute.sellerAgentId) {
      throw new Error('Agent is not the seller in this dispute');
    }

    const message: DisputeMessage = {
      id: uuidv4(),
      from: role,
      agentId,
      content,
      timestamp: new Date(),
    };

    dispute.messages.push(message);
    dispute.updatedAt = new Date();
    return message;
  }

  /**
   * Seller resubmits a new deliverable, moving the dispute back toward validation.
   */
  sellerResubmit(disputeId: string, newDeliverable: string): Dispute {
    const dispute = this.getOrThrow(disputeId);
    if (this.isResolved(dispute)) {
      throw new Error(`Dispute ${disputeId} is already resolved`);
    }

    dispute.deliverable = newDeliverable;
    dispute.status = 'seller_resubmitted';
    dispute.updatedAt = new Date();

    dispute.messages.push({
      id: uuidv4(),
      from: 'seller',
      agentId: dispute.sellerAgentId,
      content: `[RESUBMITTED DELIVERABLE] ${newDeliverable.slice(0, 200)}...`,
      timestamp: new Date(),
    });

    return dispute;
  }

  /**
   * Buyer requests a full refund.
   */
  buyerRequestRefund(disputeId: string, reason: string): Dispute {
    const dispute = this.getOrThrow(disputeId);
    if (this.isResolved(dispute)) {
      throw new Error(`Dispute ${disputeId} is already resolved`);
    }

    dispute.status = 'refund_requested';
    dispute.updatedAt = new Date();

    dispute.messages.push({
      id: uuidv4(),
      from: 'buyer',
      agentId: dispute.buyerAgentId,
      content: `[REFUND REQUESTED] ${reason}`,
      timestamp: new Date(),
    });

    return dispute;
  }

  /**
   * Either party escalates to AI arbitration.
   */
  escalate(disputeId: string): Dispute {
    const dispute = this.getOrThrow(disputeId);
    if (this.isResolved(dispute)) {
      throw new Error(`Dispute ${disputeId} is already resolved`);
    }

    dispute.status = 'escalated';
    dispute.updatedAt = new Date();
    return dispute;
  }

  /**
   * AI-powered arbitration. Reviews all evidence and makes a binding decision.
   */
  async arbitrate(disputeId: string): Promise<ArbitrationResult> {
    const dispute = this.getOrThrow(disputeId);
    if (this.isResolved(dispute)) {
      throw new Error(`Dispute ${disputeId} is already resolved`);
    }

    // Escalate if not already
    if (dispute.status !== 'escalated') {
      dispute.status = 'escalated';
    }

    const result = await this.runArbitration(dispute);

    dispute.arbitrationResult = result;
    dispute.updatedAt = new Date();

    // Apply the decision
    switch (result.decision) {
      case 'release':
        dispute.status = 'resolved_release';
        break;
      case 'partial_refund':
        dispute.status = 'resolved_partial_refund';
        break;
      case 'full_refund':
        dispute.status = 'resolved_full_refund';
        break;
    }

    return result;
  }

  // ==================== QUERIES ====================

  get(id: string): Dispute | undefined {
    return this.disputes.get(id);
  }

  getByEscrowId(escrowId: string): Dispute | undefined {
    return Array.from(this.disputes.values()).find((d) => d.escrowId === escrowId);
  }

  getAll(): Dispute[] {
    return Array.from(this.disputes.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  getActive(): Dispute[] {
    return Array.from(this.disputes.values()).filter((d) => !this.isResolved(d));
  }

  getResolved(): Dispute[] {
    return Array.from(this.disputes.values()).filter((d) => this.isResolved(d));
  }

  // ==================== INTERNALS ====================

  private getOrThrow(id: string): Dispute {
    const dispute = this.disputes.get(id);
    if (!dispute) throw new Error(`Dispute not found: ${id}`);
    return dispute;
  }

  private isResolved(dispute: Dispute): boolean {
    return dispute.status.startsWith('resolved_');
  }

  private async runArbitration(dispute: Dispute): Promise<ArbitrationResult> {
    let client: Anthropic | null = null;
    if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('test-')) {
      client = new Anthropic();
    }

    if (!client) {
      return this.offlineArbitration(dispute);
    }

    try {
      const messagesText = dispute.messages
        .map((m) => `[${m.from.toUpperCase()}] ${m.content}`)
        .join('\n');

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You are an impartial arbitrator for a service marketplace dispute.
Review all evidence and make a binding decision.
Respond with JSON: {"decision": "release" | "partial_refund" | "full_refund", "reasoning": "<explanation>", "refundPercentage": <0-100>, "confidence": <0-1>}

Guidelines:
- "release": Seller delivered adequately. refundPercentage = 0.
- "partial_refund": Partial delivery. refundPercentage = 10-90.
- "full_refund": Seller failed entirely. refundPercentage = 100.
- Consider the acceptance criteria carefully.
- Weigh arguments from both parties fairly.`,
        messages: [
          {
            role: 'user',
            content: `DISPUTE ARBITRATION

Service: ${dispute.serviceName}
Amount: ${dispute.amountUsdt} USDT

Acceptance Criteria:
${dispute.acceptanceCriteria}

Deliverable Submitted:
${dispute.deliverable}

AI Validation Feedback:
${dispute.validationFeedback}

Party Arguments:
${messagesText || '(No arguments submitted)'}

Please review all evidence and render your decision.`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in arbitration response');
      return JSON.parse(jsonMatch[0]) as ArbitrationResult;
    } catch {
      return this.offlineArbitration(dispute);
    }
  }

  /**
   * Offline heuristic arbitration when AI is unavailable.
   */
  private offlineArbitration(dispute: Dispute): ArbitrationResult {
    const deliverableLength = dispute.deliverable.length;
    const hasBuyerRefundRequest = dispute.status === 'refund_requested';
    const hasSellerResubmission = dispute.status === 'seller_resubmitted';
    const criteriaWords = dispute.acceptanceCriteria.toLowerCase().split(/\s+/);
    const deliverableLower = dispute.deliverable.toLowerCase();

    // Count how many criteria words appear in the deliverable
    const matchCount = criteriaWords.filter((w) => w.length > 3 && deliverableLower.includes(w)).length;
    const matchRatio = criteriaWords.length > 0 ? matchCount / criteriaWords.length : 0;

    // Heuristic decision
    if (deliverableLength < 20) {
      return {
        decision: 'full_refund',
        reasoning: 'Offline arbitration: Deliverable is too short to constitute meaningful work.',
        refundPercentage: 100,
        confidence: 0.6,
      };
    }

    if (hasSellerResubmission && matchRatio > 0.3) {
      return {
        decision: 'release',
        reasoning: 'Offline arbitration: Seller resubmitted and deliverable shows reasonable criteria match.',
        refundPercentage: 0,
        confidence: 0.4,
      };
    }

    if (hasBuyerRefundRequest && matchRatio < 0.2) {
      return {
        decision: 'full_refund',
        reasoning: 'Offline arbitration: Buyer requested refund and deliverable poorly matches criteria.',
        refundPercentage: 100,
        confidence: 0.5,
      };
    }

    if (matchRatio >= 0.4) {
      return {
        decision: 'release',
        reasoning: `Offline arbitration: Deliverable matches ${(matchRatio * 100).toFixed(0)}% of criteria keywords.`,
        refundPercentage: 0,
        confidence: 0.4,
      };
    }

    // Default: partial refund
    const refundPct = Math.round((1 - matchRatio) * 70);
    return {
      decision: 'partial_refund',
      reasoning: `Offline arbitration: Partial criteria match (${(matchRatio * 100).toFixed(0)}%). Suggesting ${refundPct}% refund.`,
      refundPercentage: refundPct,
      confidence: 0.3,
    };
  }
}
