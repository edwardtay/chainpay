#!/usr/bin/env node
/**
 * ChainPay MCP Server — Expose ChainPay as Model Context Protocol tools.
 *
 * Any MCP-compatible agent (Claude, Cursor, OpenAI Agents SDK) can use
 * ChainPay's commerce protocol natively via tool calls.
 *
 * Usage:
 *   npx ts-node src/mcp-server.ts
 *
 * Then add to your MCP client config:
 *   { "command": "npx", "args": ["ts-node", "src/mcp-server.ts"] }
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ChainPayAgent } from './agent/agent';

async function main() {
  const seedPhrase = process.env.SEED_PHRASE;
  if (!seedPhrase) {
    console.error('SEED_PHRASE not set');
    process.exit(1);
  }

  const agent = new ChainPayAgent(seedPhrase, 'mcp-agent');
  await agent.initialize();

  const server = new McpServer({
    name: 'chainpay',
    version: '2.0.0',
  });

  // ==================== WALLET TOOLS ====================

  server.tool(
    'get_balances',
    'Get wallet balances across all chains (USDT, native tokens, XAU₮)',
    {},
    async () => {
      const balances = await agent.getWalletManager().getAllBalances();
      return { content: [{ type: 'text', text: JSON.stringify(balances, null, 2) }] };
    }
  );

  server.tool(
    'get_addresses',
    'Get wallet addresses on all supported chains',
    {},
    async () => {
      const addresses = await agent.getWalletManager().getAllAddresses();
      return { content: [{ type: 'text', text: JSON.stringify(addresses, null, 2) }] };
    }
  );

  // ==================== SERVICE MARKETPLACE ====================

  server.tool(
    'publish_service',
    'Publish a service on the ChainPay marketplace with USDT pricing',
    {
      name: z.string().describe('Service name'),
      description: z.string().describe('What the service does'),
      priceUsdt: z.string().describe('Price in USDT (e.g. "0.50")'),
      chain: z.string().optional().describe('Chain to receive payment on (default: polygon)'),
    },
    async ({ name, description, priceUsdt, chain }) => {
      const c = chain || 'polygon';
      const addr = await agent.getWalletManager().getAddress(c);
      const svc = agent.getServiceRegistry().publish({
        agentId: agent.agentId, agentAddress: addr,
        name, description, priceUsdt, chain: c,
      });
      return { content: [{ type: 'text', text: JSON.stringify(svc, null, 2) }] };
    }
  );

  server.tool(
    'find_services',
    'Search the service marketplace',
    {
      search: z.string().optional().describe('Keyword search'),
      maxPrice: z.number().optional().describe('Maximum price in USDT'),
      category: z.string().optional().describe('Filter by category'),
    },
    async ({ search, maxPrice, category }) => {
      const services = agent.getServiceRegistry().find({ search, maxPrice, category });
      return { content: [{ type: 'text', text: JSON.stringify(services, null, 2) }] };
    }
  );

  // ==================== ESCROW ====================

  server.tool(
    'create_escrow',
    'Create an escrow to purchase a service. Locks USDT until delivery is validated by AI.',
    { serviceId: z.string().describe('ID of the service to purchase') },
    async ({ serviceId }) => {
      const svc = agent.getServiceRegistry().get(serviceId);
      if (!svc) return { content: [{ type: 'text', text: 'Service not found' }] };
      const addr = await agent.getWalletManager().getAddress(svc.chain);
      const escrow = agent.getEscrowEngine().create({
        serviceId: svc.id, serviceName: svc.name,
        buyerAgentId: agent.agentId, sellerAgentId: svc.agentId,
        buyerAddress: addr, sellerAddress: svc.agentAddress,
        amountUsdt: svc.priceUsdt, chain: svc.chain,
        acceptanceCriteria: svc.acceptanceCriteria,
      });
      return { content: [{ type: 'text', text: JSON.stringify(escrow, null, 2) }] };
    }
  );

  server.tool(
    'fund_escrow',
    'Fund an escrow (verifies wallet balance, holds funds)',
    { escrowId: z.string().describe('Escrow ID to fund') },
    async ({ escrowId }) => {
      const result = await agent.fundEscrow(escrowId);
      return { content: [{ type: 'text', text: result }] };
    }
  );

  server.tool(
    'submit_deliverable',
    'Submit work deliverable for AI validation. If approved, USDT releases to seller.',
    {
      escrowId: z.string().describe('Escrow ID'),
      deliverable: z.string().describe('The completed work / output'),
    },
    async ({ escrowId, deliverable }) => {
      const result = await agent.submitDeliverable(escrowId, deliverable);
      return { content: [{ type: 'text', text: result }] };
    }
  );

  server.tool(
    'list_escrows',
    'List all escrows and their statuses',
    {},
    async () => {
      const escrows = agent.getEscrowEngine().getAll();
      const total = agent.getEscrowEngine().getTotalEscrowed();
      return { content: [{ type: 'text', text: JSON.stringify({ escrows, totalEscrowed: total }, null, 2) }] };
    }
  );

  // ==================== NEGOTIATION ====================

  server.tool(
    'negotiate',
    'Open a price negotiation with a service seller',
    {
      serviceId: z.string().describe('Service to negotiate for'),
      offerUsdt: z.string().describe('Your initial offer in USDT'),
    },
    async ({ serviceId, offerUsdt }) => {
      const svc = agent.getServiceRegistry().get(serviceId);
      if (!svc) return { content: [{ type: 'text', text: 'Service not found' }] };
      const neg = agent.getNegotiationEngine().openNegotiation({
        service: svc, buyerAgentId: agent.agentId, offerUsdt,
      });
      return { content: [{ type: 'text', text: JSON.stringify(neg, null, 2) }] };
    }
  );

  // ==================== CHAT ====================

  server.tool(
    'agent_chat',
    'Send a natural language message to the ChainPay agent',
    { message: z.string().describe('What you want the agent to do') },
    async ({ message }) => {
      const response = await agent.processCommand(message);
      return { content: [{ type: 'text', text: response }] };
    }
  );

  // ==================== START ====================

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
