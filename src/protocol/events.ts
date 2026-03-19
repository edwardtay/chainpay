/**
 * EventBus — Agent-first event system.
 *
 * Instead of humans polling dashboards, agents subscribe to events
 * and react programmatically. This is how agent-to-agent coordination works.
 *
 * Events are emitted when protocol state changes:
 * - escrow.funded, escrow.delivered, escrow.released, escrow.disputed
 * - service.published, service.purchased
 * - subscription.due, subscription.paid
 * - payment.received, payment.sent
 * - negotiation.offered, negotiation.accepted
 * - dispute.opened, dispute.resolved
 */

export type EventType =
  | 'escrow.created' | 'escrow.funded' | 'escrow.delivered'
  | 'escrow.validated' | 'escrow.released' | 'escrow.refunded' | 'escrow.expired'
  | 'service.published' | 'service.purchased' | 'service.rated'
  | 'subscription.created' | 'subscription.due' | 'subscription.paid' | 'subscription.cancelled'
  | 'payment.received' | 'payment.sent' | 'payment.confirmed'
  | 'negotiation.opened' | 'negotiation.countered' | 'negotiation.accepted' | 'negotiation.rejected'
  | 'dispute.opened' | 'dispute.escalated' | 'dispute.resolved'
  | 'agent.started' | 'agent.goal_progress' | 'agent.decision';

export interface AgentEvent {
  type: EventType;
  timestamp: Date;
  agentId: string;
  data: Record<string, any>;
}

type EventHandler = (event: AgentEvent) => void | Promise<void>;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private history: AgentEvent[] = [];
  private webhooks: Map<string, string> = new Map(); // eventType -> URL

  /**
   * Subscribe to an event type. Agent-first: agents register handlers programmatically.
   */
  on(type: EventType | '*', handler: EventHandler): void {
    const existing = this.handlers.get(type) || [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  /**
   * Register a webhook URL for an event type.
   * When the event fires, POST the event payload to the URL.
   */
  registerWebhook(type: EventType, url: string): void {
    this.webhooks.set(type, url);
  }

  /**
   * Emit an event. Notifies all subscribers and webhooks.
   */
  async emit(type: EventType, agentId: string, data: Record<string, any>): Promise<void> {
    const event: AgentEvent = {
      type,
      timestamp: new Date(),
      agentId,
      data,
    };

    this.history.push(event);
    if (this.history.length > 500) this.history = this.history.slice(-500);

    // Notify direct handlers
    const typeHandlers = this.handlers.get(type) || [];
    const wildcardHandlers = this.handlers.get('*') || [];
    const allHandlers = [...typeHandlers, ...wildcardHandlers];

    for (const handler of allHandlers) {
      try {
        await handler(event);
      } catch {
        // Don't let handler errors break the emitter
      }
    }

    // Fire webhook if registered
    const webhookUrl = this.webhooks.get(type);
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
      } catch {
        // Webhook delivery failed — log but don't block
      }
    }
  }

  getHistory(type?: EventType, limit: number = 50): AgentEvent[] {
    let events = this.history;
    if (type) events = events.filter(e => e.type === type);
    return events.slice(-limit);
  }

  getWebhooks(): Record<string, string> {
    return Object.fromEntries(this.webhooks);
  }
}
