/**
 * ChainPay Client — Import this in your agent to use ChainPay programmatically.
 *
 * Agent-first design: no dashboard, no CLI, no HTTP.
 * Just import and call methods.
 *
 * Usage:
 *   import { createAgent } from 'chainpay/client';
 *   const agent = await createAgent({ seedPhrase: '...' });
 *   await agent.publishService({ name: 'My API', priceUsdt: '0.50', chain: 'polygon' });
 *   const services = agent.findServices({ search: 'data analysis' });
 *   const escrow = await agent.buyService(services[0].id);
 */

import { ChainPayAgent } from './agent/agent';
import { GoalEngine } from './agent/goals';
import { EventBus, EventType } from './protocol/events';

export interface ChainPayConfig {
  seedPhrase: string;
  agentId?: string;
  autoStart?: boolean; // Start autonomous loop immediately (default: true)
  intervalMs?: number;  // Autonomous cycle interval (default: 30000)
}

export interface ChainPayClient {
  agentId: string;
  events: EventBus;
  goals: GoalEngine;

  // Services
  publishService(params: { name: string; description?: string; priceUsdt: string; chain?: string; category?: string }): any;
  findServices(params: { search?: string; maxPrice?: number; category?: string }): any[];
  buyService(serviceId: string): Promise<string>;

  // Escrow
  fundEscrow(escrowId: string): Promise<string>;
  submitDeliverable(escrowId: string, deliverable: string): Promise<string>;

  // Payments
  sendPayment(params: { to: string; amount: string; chain?: string }): Promise<string>;
  getBalances(): Promise<Record<string, any>>;
  getAddresses(): Promise<Record<string, string>>;

  // Goals
  setGoal(params: { id: string; type: string; description: string; priority: number; constraints?: any }): void;

  // Events
  on(event: EventType | '*', handler: (e: any) => void): void;
  onWebhook(event: EventType, url: string): void;

  // Control
  startBrain(): Promise<void>;
  stopBrain(): void;
  chat(message: string): Promise<string>;

  // Raw access
  raw: ChainPayAgent;
}

export async function createAgent(config: ChainPayConfig): Promise<ChainPayClient> {
  const agent = new ChainPayAgent(config.seedPhrase, config.agentId);
  await agent.initialize();

  const events = new EventBus();
  const goals = new GoalEngine(agent);

  // Auto-start autonomous loop unless explicitly disabled
  if (config.autoStart !== false) {
    await agent.startAutonomousLoop(config.intervalMs || 30000);
  }

  const client: ChainPayClient = {
    agentId: agent.agentId,
    events,
    goals,

    publishService(params) {
      const chain = params.chain || 'polygon';
      // Resolve address synchronously from cached accounts
      let address = '';
      try { address = agent.getWalletManager().getAccount(chain).address || ''; } catch {}
      const service = agent.getServiceRegistry().publish({
        agentId: agent.agentId,
        agentAddress: address,
        name: params.name,
        description: params.description || '',
        priceUsdt: params.priceUsdt,
        chain,
        category: params.category,
      });
      events.emit('service.published', agent.agentId, { service });
      return service;
    },

    findServices(params) {
      return agent.getServiceRegistry().find(params);
    },

    async buyService(serviceId: string) {
      const result = await agent.processCommand(`buy service ${serviceId}`);
      return result;
    },

    async fundEscrow(escrowId: string) {
      const result = await agent.fundEscrow(escrowId);
      events.emit('escrow.funded', agent.agentId, { escrowId });
      return result;
    },

    async submitDeliverable(escrowId: string, deliverable: string) {
      const result = await agent.submitDeliverable(escrowId, deliverable);
      return result;
    },

    async sendPayment(params) {
      const result = await agent.processCommand(
        `send ${params.amount} USDT to ${params.to} on ${params.chain || 'polygon'}`
      );
      return result;
    },

    async getBalances() {
      return agent.getWalletManager().getAllBalances();
    },

    async getAddresses() {
      return agent.getWalletManager().getAllAddresses();
    },

    setGoal(params) {
      goals.addGoal({
        id: params.id,
        type: params.type as any,
        description: params.description,
        priority: params.priority,
        constraints: params.constraints || {},
      });
    },

    on(event, handler) {
      events.on(event, handler);
    },

    onWebhook(event, url) {
      events.registerWebhook(event, url);
    },

    async startBrain() {
      await agent.startAutonomousLoop();
    },

    stopBrain() {
      agent.stopAutonomousLoop();
    },

    async chat(message: string) {
      return agent.processCommand(message);
    },

    raw: agent,
  };

  await events.emit('agent.started', agent.agentId, {
    chains: agent.getWalletManager().getInitializedChains(),
  });

  return client;
}
