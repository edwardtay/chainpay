import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith('test-')) {
    return null;
  }
  client = new Anthropic();
  return client;
}

export function isLLMAvailable(): boolean {
  return getClient() !== null;
}

export interface AgentDecision {
  action: string;
  reasoning: string;
  params: Record<string, any>;
  confidence: number;
}

export async function agentReason(prompt: string, context: string): Promise<AgentDecision> {
  const c = getClient();
  if (!c) return offlineReason(prompt, context);

  try {
    const response = await c.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are an autonomous payment agent that manages USDT across multiple blockchains.
You make decisions about service purchases, payment validation, escrow releases, and yield optimization.
Always respond with valid JSON in this exact format:
{"action":"<action_name>","reasoning":"<why>","params":{<relevant_params>},"confidence":<0-1>}

Available actions:
- approve_escrow_release: Release escrowed funds (params: escrowId, reason)
- reject_escrow_release: Reject and refund (params: escrowId, reason)
- purchase_service: Buy a service from another agent (params: serviceId, maxPrice)
- optimize_yield: Move idle funds to Aave (params: amount, chain)
- withdraw_yield: Pull funds from Aave (params: amount, chain, reason)
- bridge_funds: Bridge USDT cross-chain (params: fromChain, toChain, amount, reason)
- create_subscription: Set up recurring payment (params: serviceId, interval, maxAmount)
- cancel_subscription: Stop recurring payment (params: subscriptionId, reason)
- no_action: Do nothing (params: reason)`,
      messages: [
        { role: 'user', content: `Context:\n${context}\n\nDecision needed:\n${prompt}` }
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]) as AgentDecision;
  } catch {
    return offlineReason(prompt, context);
  }
}

function offlineReason(_prompt: string, _context: string): AgentDecision {
  return {
    action: 'no_action',
    reasoning: 'AI reasoning unavailable (offline mode). Set ANTHROPIC_API_KEY to enable.',
    params: {},
    confidence: 0,
  };
}

export async function validateServiceOutput(
  serviceDescription: string,
  deliverable: string,
  criteria: string
): Promise<{ approved: boolean; score: number; feedback: string }> {
  const c = getClient();
  if (!c) return offlineValidate(deliverable, criteria);

  try {
    const response = await c.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: `You validate whether a service deliverable meets the requirements.
Respond with JSON: {"approved": boolean, "score": 0-100, "feedback": "explanation"}`,
      messages: [
        {
          role: 'user',
          content: `Service: ${serviceDescription}\nDeliverable: ${deliverable}\nAcceptance criteria: ${criteria}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return offlineValidate(deliverable, criteria);
  }
}

function offlineValidate(deliverable: string, criteria: string): { approved: boolean; score: number; feedback: string } {
  // Simple heuristic validation when AI is unavailable
  const hasContent = deliverable.length > 10;
  const matchesCriteria = criteria.split(' ').some(w =>
    deliverable.toLowerCase().includes(w.toLowerCase())
  );
  const score = hasContent ? (matchesCriteria ? 75 : 50) : 10;
  return {
    approved: score >= 60,
    score,
    feedback: hasContent
      ? `Offline validation: deliverable has content (${deliverable.length} chars). Score: ${score}/100.`
      : 'Offline validation: deliverable is too short.',
  };
}

export async function parseNaturalLanguageIntent(
  userMessage: string
): Promise<{ intent: string; params: Record<string, any> }> {
  const c = getClient();
  if (!c) return offlineParseIntent(userMessage);

  try {
    const response = await c.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: `Parse the user's natural language into a structured intent for a payment agent.
Respond with JSON: {"intent": "<intent_type>", "params": {<extracted_params>}}

Intent types:
- publish_service: User wants to offer a service (params: name, description, priceUsdt, chain)
- buy_service: User wants to purchase a service (params: query, maxPrice)
- check_balance: Check wallet balances (params: chain?)
- send_payment: Send USDT to someone (params: to, amount, chain)
- create_invoice: Create payment request (params: amount, chain, memo)
- list_services: Browse available services (params: category?)
- escrow_status: Check escrow status (params: escrowId?)
- start_subscription: Subscribe to a service (params: serviceId, interval)
- stop_subscription: Cancel subscription (params: subscriptionId)
- confirm_payment: Confirm a pending payment (params: {})
- optimize: Let agent optimize yield/positions (params: {})
- help: Show help (params: {})
- unknown: Can't parse (params: {originalMessage})`,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return offlineParseIntent(userMessage);
  }
}

function offlineParseIntent(msg: string): { intent: string; params: Record<string, any> } {
  const lower = msg.toLowerCase().trim();

  if (lower === 'confirm' || lower === 'yes' || lower === 'confirm payment') {
    return { intent: 'confirm_payment', params: {} };
  }
  if (lower.includes('balance')) return { intent: 'check_balance', params: {} };
  if (lower.includes('help')) return { intent: 'help', params: {} };
  if (lower.includes('escrow')) return { intent: 'escrow_status', params: {} };
  if (lower.includes('service') && lower.includes('list')) return { intent: 'list_services', params: {} };
  if (lower.includes('optimize') || lower.includes('yield')) return { intent: 'optimize', params: {} };

  if (lower.includes('publish') || lower.includes('offer')) {
    const priceMatch = msg.match(/([\d.]+)\s*USDT/i);
    const chainMatch = msg.match(/on\s+(\w+)/i);
    return {
      intent: 'publish_service',
      params: {
        name: msg.replace(/publish|offer|service|for|on\s+\w+|[\d.]+\s*usdt/gi, '').trim() || 'New Service',
        description: msg,
        priceUsdt: priceMatch ? priceMatch[1] : '1.00',
        chain: chainMatch ? chainMatch[1].toLowerCase() : 'polygon',
      },
    };
  }

  if (lower.includes('buy') || lower.includes('find') || lower.includes('search')) {
    const priceMatch = msg.match(/under\s+([\d.]+)/i);
    return {
      intent: 'buy_service',
      params: {
        query: msg.replace(/buy|find|search|under\s+[\d.]+\s*usdt?/gi, '').trim(),
        maxPrice: priceMatch ? parseFloat(priceMatch[1]) : undefined,
      },
    };
  }

  if (lower.includes('send') || lower.includes('pay') || lower.includes('transfer')) {
    const amountMatch = msg.match(/([\d.]+)\s*USDT/i);
    const toMatch = msg.match(/to\s+(0x[a-fA-F0-9]+|T[a-zA-Z0-9]+|UQ[a-zA-Z0-9]+)/i);
    const chainMatch = msg.match(/on\s+(\w+)/i);
    return {
      intent: 'send_payment',
      params: {
        amount: amountMatch ? amountMatch[1] : '0',
        to: toMatch ? toMatch[1] : '',
        chain: chainMatch ? chainMatch[1].toLowerCase() : 'polygon',
      },
    };
  }

  if (lower.includes('invoice')) {
    const amountMatch = msg.match(/([\d.]+)\s*USDT/i);
    const chainMatch = msg.match(/on\s+(\w+)/i);
    return {
      intent: 'create_invoice',
      params: {
        amount: amountMatch ? amountMatch[1] : '0',
        chain: chainMatch ? chainMatch[1].toLowerCase() : 'polygon',
        memo: msg,
      },
    };
  }

  if (lower.includes('subscribe')) {
    return { intent: 'start_subscription', params: { serviceId: '', interval: '1d' } };
  }

  if (lower.includes('cancel') && lower.includes('sub')) {
    return { intent: 'stop_subscription', params: { subscriptionId: '' } };
  }

  return { intent: 'unknown', params: { originalMessage: msg } };
}
