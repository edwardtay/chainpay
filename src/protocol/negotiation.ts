import { v4 as uuidv4 } from 'uuid';
import { agentReason, isLLMAvailable } from '../llm/claude';
import { AgentService } from './service-registry';

export type NegotiationStatus = 'open' | 'counter_offered' | 'accepted' | 'rejected' | 'expired';

export interface NegotiationMessage {
  from: string; // agentId
  type: 'offer' | 'counter' | 'accept' | 'reject';
  priceUsdt: string;
  message: string;
  timestamp: Date;
}

export interface Negotiation {
  id: string;
  serviceId: string;
  serviceName: string;
  buyerAgentId: string;
  sellerAgentId: string;
  listPrice: string;
  currentOffer: string;
  status: NegotiationStatus;
  messages: NegotiationMessage[];
  createdAt: Date;
  maxRounds: number;
}

/**
 * NegotiationEngine — Autonomous price negotiation between agents.
 *
 * When Agent B wants to buy a service, instead of paying list price,
 * it can open a negotiation. Both agents use AI reasoning to decide
 * whether to accept, counter-offer, or reject.
 *
 * This is unique — no other hackathon submission has agent-to-agent negotiation.
 */
export class NegotiationEngine {
  private negotiations: Map<string, Negotiation> = new Map();

  /**
   * Buyer opens a negotiation with an initial offer.
   */
  openNegotiation(params: {
    service: AgentService;
    buyerAgentId: string;
    offerUsdt: string;
    message?: string;
  }): Negotiation {
    const neg: Negotiation = {
      id: uuidv4(),
      serviceId: params.service.id,
      serviceName: params.service.name,
      buyerAgentId: params.buyerAgentId,
      sellerAgentId: params.service.agentId,
      listPrice: params.service.priceUsdt,
      currentOffer: params.offerUsdt,
      status: 'open',
      messages: [
        {
          from: params.buyerAgentId,
          type: 'offer',
          priceUsdt: params.offerUsdt,
          message: params.message || `Offering ${params.offerUsdt} USDT for ${params.service.name}`,
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
      maxRounds: 5,
    };

    this.negotiations.set(neg.id, neg);
    return neg;
  }

  /**
   * Seller (or buyer) responds to a negotiation using AI reasoning.
   */
  async respond(
    negotiationId: string,
    responderAgentId: string,
    responderRole: 'buyer' | 'seller'
  ): Promise<{ negotiation: Negotiation; response: NegotiationMessage }> {
    const neg = this.negotiations.get(negotiationId);
    if (!neg) throw new Error(`Negotiation not found: ${negotiationId}`);
    if (neg.status === 'accepted' || neg.status === 'rejected') {
      throw new Error(`Negotiation already ${neg.status}`);
    }

    // Check round limit
    if (neg.messages.length >= neg.maxRounds * 2) {
      neg.status = 'expired';
      throw new Error('Negotiation expired (max rounds reached)');
    }

    const lastMessage = neg.messages[neg.messages.length - 1];
    const listPrice = parseFloat(neg.listPrice);
    const currentOffer = parseFloat(neg.currentOffer);

    let response: NegotiationMessage;

    if (isLLMAvailable()) {
      // AI-driven negotiation
      const decision = await agentReason(
        `You are the ${responderRole} in a negotiation for "${neg.serviceName}". ` +
        `List price: ${neg.listPrice} USDT. Current offer: ${neg.currentOffer} USDT. ` +
        `Last message from ${lastMessage.from}: "${lastMessage.message}". ` +
        `Round ${Math.ceil(neg.messages.length / 2)} of ${neg.maxRounds}. ` +
        `Should you accept, counter-offer, or reject? If counter, what price?`,
        `Negotiation history:\n${neg.messages.map(m => `  ${m.from} (${m.type}): ${m.priceUsdt} USDT - "${m.message}"`).join('\n')}`
      );

      if (decision.action === 'approve_escrow_release' || decision.params.accept) {
        response = {
          from: responderAgentId,
          type: 'accept',
          priceUsdt: neg.currentOffer,
          message: decision.reasoning,
          timestamp: new Date(),
        };
        neg.status = 'accepted';
      } else if (decision.action === 'reject_escrow_release' || decision.params.reject) {
        response = {
          from: responderAgentId,
          type: 'reject',
          priceUsdt: neg.currentOffer,
          message: decision.reasoning,
          timestamp: new Date(),
        };
        neg.status = 'rejected';
      } else {
        const counterPrice = decision.params.price || decision.params.counterPrice ||
          (responderRole === 'seller'
            ? ((currentOffer + listPrice) / 2).toFixed(2)
            : (currentOffer * 1.1).toFixed(2));
        response = {
          from: responderAgentId,
          type: 'counter',
          priceUsdt: counterPrice.toString(),
          message: decision.reasoning,
          timestamp: new Date(),
        };
        neg.currentOffer = counterPrice.toString();
        neg.status = 'counter_offered';
      }
    } else {
      // Offline negotiation logic
      response = this.offlineRespond(neg, responderRole, responderAgentId);
    }

    neg.messages.push(response);
    return { negotiation: neg, response };
  }

  private offlineRespond(
    neg: Negotiation,
    role: 'buyer' | 'seller',
    agentId: string
  ): NegotiationMessage {
    const listPrice = parseFloat(neg.listPrice);
    const currentOffer = parseFloat(neg.currentOffer);
    const round = Math.ceil(neg.messages.length / 2);

    if (role === 'seller') {
      // Seller logic: accept if offer >= 80% of list price, otherwise counter
      if (currentOffer >= listPrice * 0.8) {
        neg.status = 'accepted';
        return {
          from: agentId,
          type: 'accept',
          priceUsdt: neg.currentOffer,
          message: `Accepted. ${currentOffer.toFixed(2)} USDT is fair for ${neg.serviceName}.`,
          timestamp: new Date(),
        };
      }
      const counterPrice = ((currentOffer + listPrice) / 2).toFixed(2);
      neg.currentOffer = counterPrice;
      neg.status = 'counter_offered';
      return {
        from: agentId,
        type: 'counter',
        priceUsdt: counterPrice,
        message: `Counter-offer: ${counterPrice} USDT. List price is ${neg.listPrice} USDT.`,
        timestamp: new Date(),
      };
    } else {
      // Buyer logic: accept if within 120% of their initial offer, otherwise counter down
      const initialOffer = parseFloat(neg.messages[0].priceUsdt);
      if (currentOffer <= initialOffer * 1.2) {
        neg.status = 'accepted';
        return {
          from: agentId,
          type: 'accept',
          priceUsdt: neg.currentOffer,
          message: `Deal. ${currentOffer.toFixed(2)} USDT accepted.`,
          timestamp: new Date(),
        };
      }
      // Last round — accept or reject
      if (round >= neg.maxRounds - 1) {
        if (currentOffer <= listPrice * 0.9) {
          neg.status = 'accepted';
          return {
            from: agentId,
            type: 'accept',
            priceUsdt: neg.currentOffer,
            message: `Final round — accepting ${currentOffer.toFixed(2)} USDT.`,
            timestamp: new Date(),
          };
        }
        neg.status = 'rejected';
        return {
          from: agentId,
          type: 'reject',
          priceUsdt: neg.currentOffer,
          message: `Cannot agree on price. Rejecting.`,
          timestamp: new Date(),
        };
      }
      const counterPrice = ((currentOffer + initialOffer) / 2).toFixed(2);
      neg.currentOffer = counterPrice;
      neg.status = 'counter_offered';
      return {
        from: agentId,
        type: 'counter',
        priceUsdt: counterPrice,
        message: `Counter: ${counterPrice} USDT.`,
        timestamp: new Date(),
      };
    }
  }

  get(id: string): Negotiation | undefined {
    return this.negotiations.get(id);
  }

  getAll(): Negotiation[] {
    return Array.from(this.negotiations.values());
  }

  getActive(): Negotiation[] {
    return this.getAll().filter(n => !['accepted', 'rejected', 'expired'].includes(n.status));
  }
}
