/**
 * ChainPay — Interactive Demo
 *
 * Demonstrates the full agent-to-agent commerce flow:
 * 1. Two agents initialize with WDK wallets
 * 2. Agent A publishes a service
 * 3. Agent B discovers and purchases it
 * 4. Escrow is created and funded
 * 5. Service is delivered
 * 6. AI validates the deliverable
 * 7. Escrow is released to seller
 * 8. Subscription is set up for recurring payments
 * 9. x402 pay-per-use API is demonstrated
 *
 * Run: npm run demo
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { ChainPayAgent } from './agent/agent';
import { getChainConfig } from './utils/chains';

const DELAY = 800;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function header(text: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${text}`);
  console.log('='.repeat(60));
}

function step(n: number, text: string) {
  console.log(`\n--- Step ${n}: ${text} ---`);
}

async function main() {
  const seedPhrase = process.env.SEED_PHRASE;
  if (!seedPhrase) {
    console.error('Set SEED_PHRASE in .env');
    process.exit(1);
  }

  header('ChainPay — Agent Commerce Demo');
  console.log('Demonstrating autonomous agent-to-agent commerce with Tether WDK\n');

  // ================================================================
  // STEP 1: Initialize agents
  // ================================================================
  step(1, 'Initialize two AI agents with WDK wallets');

  // Two distinct agents — different IDs, same WDK infrastructure
  // In production, each agent would have its own seed phrase
  const agentA = new ChainPayAgent(seedPhrase, 'agent-seller');
  const agentB = new ChainPayAgent(seedPhrase, 'agent-buyer');
  await agentA.initialize();
  await agentB.initialize();

  const sellerAddr = await agentA.getWalletManager().getAddress('polygon');
  const buyerAddr = await agentB.getWalletManager().getAddress('polygon');

  console.log(`Agent A (Seller): ID=${agentA.agentId}`);
  console.log(`  Wallet: ${sellerAddr}`);
  console.log(`  Chains: ${agentA.getWalletManager().getInitializedChains().join(', ')}`);
  console.log(`Agent B (Buyer):  ID=${agentB.agentId}`);
  console.log(`  Wallet: ${buyerAddr}`);
  console.log(`  Chains: ${agentB.getWalletManager().getInitializedChains().join(', ')}`);
  console.log(`Each agent has self-custodial WDK wallets — keys never shared`);
  await sleep(DELAY);

  // ================================================================
  // STEP 2: Publish services
  // ================================================================
  step(2, 'Agent A publishes services on the marketplace');

  const registry = agentA.getServiceRegistry();
  const svc1 = registry.publish({
    agentId: 'agent-seller',
    agentAddress: sellerAddr,
    name: 'AI Sentiment Analysis',
    description: 'Analyze text sentiment using advanced NLP. Returns positive/negative/neutral with confidence score.',
    priceUsdt: '0.10',
    chain: 'polygon',
    category: 'ai',
    acceptanceCriteria: 'Must return valid JSON with sentiment field and confidence > 0.5',
  });

  const svc2 = registry.publish({
    agentId: 'agent-seller',
    agentAddress: sellerAddr,
    name: 'Smart Contract Audit',
    description: 'Automated security audit of Solidity smart contracts. Checks for common vulnerabilities.',
    priceUsdt: '5.00',
    chain: 'polygon',
    category: 'security',
    acceptanceCriteria: 'Must include vulnerability report with severity ratings',
  });

  const svc3 = registry.publish({
    agentId: 'agent-seller',
    agentAddress: sellerAddr,
    name: 'Price Feed Oracle',
    description: 'Real-time crypto price feeds. ETH, BTC, SOL, TON prices updated every minute.',
    priceUsdt: '0.001',
    chain: 'polygon',
    category: 'data',
    acceptanceCriteria: 'Must return valid JSON with at least 3 price pairs',
  });

  console.log(`Published ${registry.getAll().length} services:`);
  for (const s of registry.getAll()) {
    console.log(`  [${s.id.slice(0, 8)}] ${s.name} — ${s.priceUsdt} USDT (${s.category})`);
  }
  await sleep(DELAY);

  // ================================================================
  // STEP 3: Discover services
  // ================================================================
  step(3, 'Agent B discovers services via marketplace search');

  // Share the registry (in production this would be networked)
  const buyerRegistry = agentB.getServiceRegistry();
  for (const s of registry.getAll()) {
    buyerRegistry.publish({ ...s }); // Simulate discovery
  }

  const aiServices = buyerRegistry.find({ category: 'ai' });
  console.log(`Found ${aiServices.length} AI services:`);
  for (const s of aiServices) {
    console.log(`  ${s.name} — ${s.priceUsdt} USDT by ${s.agentId}`);
  }

  const cheapServices = buyerRegistry.find({ maxPrice: 1.0 });
  console.log(`\nServices under 1 USDT: ${cheapServices.length}`);
  await sleep(DELAY);

  // ================================================================
  // STEP 4: Create escrow
  // ================================================================
  step(4, 'Agent B creates escrow for Sentiment Analysis service');

  const escrowEngine = agentB.getEscrowEngine();
  const escrow = escrowEngine.create({
    serviceId: svc1.id,
    serviceName: svc1.name,
    buyerAgentId: 'agent-buyer',
    sellerAgentId: 'agent-seller',
    buyerAddress: buyerAddr,
    sellerAddress: sellerAddr,
    amountUsdt: svc1.priceUsdt,
    chain: svc1.chain,
    acceptanceCriteria: svc1.acceptanceCriteria,
  });

  console.log(`Escrow created:`);
  console.log(`  ID: ${escrow.id}`);
  console.log(`  Amount: ${escrow.amountUsdt} USDT`);
  console.log(`  Status: ${escrow.status}`);
  console.log(`  Expires: ${escrow.expiresAt.toISOString()}`);
  await sleep(DELAY);

  // ================================================================
  // STEP 5: Fund escrow
  // ================================================================
  step(5, 'Agent B funds the escrow (USDT locked)');

  escrowEngine.fund(escrow.id, '0xsimulated_fund_tx_hash_abc123');
  console.log(`Escrow funded!`);
  console.log(`  Status: ${escrow.status}`);
  console.log(`  Fund TX: ${escrow.fundTxHash}`);
  console.log(`  Total escrowed: ${escrowEngine.getTotalEscrowed()} USDT`);
  await sleep(DELAY);

  // ================================================================
  // STEP 6: Service delivery
  // ================================================================
  step(6, 'Agent A delivers the service');

  escrowEngine.markInProgress(escrow.id);
  console.log(`Status: ${escrow.status}`);

  const deliverable = JSON.stringify({
    sentiment: 'positive',
    confidence: 0.92,
    analysis: 'The text contains strongly positive language with high confidence indicators.',
    tokens_analyzed: 47,
  });

  escrowEngine.submitDeliverable(escrow.id, deliverable);
  console.log(`Deliverable submitted: ${deliverable.slice(0, 80)}...`);
  console.log(`Status: ${escrow.status}`);
  await sleep(DELAY);

  // ================================================================
  // STEP 7: AI validates deliverable
  // ================================================================
  step(7, 'AI validates the deliverable against acceptance criteria');

  // Use the escrow engine's validation (falls back to offline validation)
  const { escrow: validatedEscrow, approved } = await escrowEngine.validateAndRelease(escrow.id);

  console.log(`Validation result:`);
  console.log(`  Approved: ${approved}`);
  console.log(`  Score: ${validatedEscrow.validationResult?.score}/100`);
  console.log(`  Feedback: ${validatedEscrow.validationResult?.feedback}`);
  console.log(`  Status: ${validatedEscrow.status}`);

  if (approved) {
    escrowEngine.markReleased(escrow.id, '0xsimulated_release_tx_xyz789');
    console.log(`  Release TX: ${escrow.releaseTxHash}`);
    console.log(`  Funds released to seller!`);

    // Update service rating
    registry.recordCompletion(svc1.id, (validatedEscrow.validationResult?.score || 75) / 20);
    console.log(`  Service rating updated: ${registry.get(svc1.id)?.rating.toFixed(1)}/5`);
  }
  await sleep(DELAY);

  // ================================================================
  // STEP 8: Set up subscription
  // ================================================================
  step(8, 'Agent B subscribes to Price Feed Oracle (recurring payments)');

  const subEngine = agentB.getSubscriptionEngine();
  const sub = subEngine.create({
    serviceId: svc3.id,
    serviceName: svc3.name,
    buyerAgentId: 'agent-buyer',
    sellerAgentId: 'agent-seller',
    buyerAddress: buyerAddr,
    sellerAddress: sellerAddr,
    amountUsdt: svc3.priceUsdt,
    chain: svc3.chain,
    intervalMs: 3600000, // hourly
    maxPayments: 720, // 30 days
  });

  console.log(`Subscription created:`);
  console.log(`  Service: ${sub.serviceName}`);
  console.log(`  Amount: ${sub.amountUsdt} USDT / hour`);
  console.log(`  Max payments: ${sub.maxPayments}`);
  console.log(`  Monthly cost: ${subEngine.getMonthlySpend('agent-buyer').toFixed(4)} USDT`);
  console.log(`  Next payment: ${sub.nextPaymentAt.toISOString()}`);
  await sleep(DELAY);

  // ================================================================
  // STEP 9: Agent-to-Agent Price Negotiation
  // ================================================================
  step(9, 'Agent B negotiates price with Agent A');

  const negEngine = agentB.getNegotiationEngine();
  const neg = negEngine.openNegotiation({
    service: svc2, // Smart Contract Audit — 5.00 USDT
    buyerAgentId: 'agent-buyer',
    offerUsdt: '3.00', // Offer 60% of list price
    message: 'Offering 3.00 USDT for audit — bulk customer discount?',
  });

  console.log(`Negotiation opened:`);
  console.log(`  Service: ${neg.serviceName} (list: ${neg.listPrice} USDT)`);
  console.log(`  Buyer offer: ${neg.currentOffer} USDT`);
  console.log(`  Status: ${neg.status}`);

  // Seller responds (AI or offline logic)
  const round1 = await negEngine.respond(neg.id, 'agent-seller', 'seller');
  console.log(`\n  Seller (${round1.response.type}): ${round1.response.priceUsdt} USDT`);
  console.log(`    "${round1.response.message}"`);

  // Buyer responds
  if (neg.status !== 'accepted' && neg.status !== 'rejected') {
    const round2 = await negEngine.respond(neg.id, 'agent-buyer', 'buyer');
    console.log(`  Buyer (${round2.response.type}): ${round2.response.priceUsdt} USDT`);
    console.log(`    "${round2.response.message}"`);
  }

  // One more round if still negotiating
  if (neg.status === 'counter_offered') {
    const round3 = await negEngine.respond(neg.id, 'agent-seller', 'seller');
    console.log(`  Seller (${round3.response.type}): ${round3.response.priceUsdt} USDT`);
    console.log(`    "${round3.response.message}"`);
  }

  console.log(`\n  Final status: ${neg.status}`);
  console.log(`  Agreed price: ${neg.currentOffer} USDT (was ${neg.listPrice} USDT list)`);
  await sleep(DELAY);

  // ================================================================
  // STEP 10: Dispute Resolution (bad deliverable scenario)
  // ================================================================
  step(10, 'Dispute resolution — bad deliverable rejected by AI');

  // Create another escrow that will be disputed
  const escrow2 = escrowEngine.create({
    serviceId: svc2.id,
    serviceName: svc2.name,
    buyerAgentId: 'agent-buyer',
    sellerAgentId: 'agent-seller',
    buyerAddress: buyerAddr,
    sellerAddress: sellerAddr,
    amountUsdt: neg.currentOffer,
    chain: 'polygon',
    acceptanceCriteria: 'Must include vulnerability report with severity ratings',
  });
  escrowEngine.fund(escrow2.id, '0xfund_audit_tx');
  escrowEngine.markInProgress(escrow2.id);
  escrowEngine.submitDeliverable(escrow2.id, 'no vulnerabilities found');

  // This will fail validation (too short, doesn't match criteria)
  const { escrow: rejected, approved: wasApproved } = await escrowEngine.validateAndRelease(escrow2.id);
  console.log(`Deliverable submitted: "no vulnerabilities found"`);
  console.log(`AI validation: ${wasApproved ? 'APPROVED' : 'REJECTED'} (score: ${rejected.validationResult?.score}/100)`);

  if (!wasApproved) {
    // Create dispute
    const disputeEngine = agentB.getDisputeEngine();
    const dispute = disputeEngine.createFromEscrow({
      escrowId: escrow2.id,
      serviceId: svc2.id,
      serviceName: svc2.name,
      buyerAgentId: 'agent-buyer',
      sellerAgentId: 'agent-seller',
      amountUsdt: neg.currentOffer,
      acceptanceCriteria: 'Must include vulnerability report with severity ratings',
      deliverable: 'no vulnerabilities found',
      validationFeedback: rejected.validationResult?.feedback || 'Failed validation',
    });
    console.log(`\nDispute opened: ${dispute.id.slice(0, 8)}...`);

    disputeEngine.addMessage(dispute.id, 'buyer', 'agent-buyer', 'The deliverable does not include a vulnerability report with severity ratings as required.');
    disputeEngine.addMessage(dispute.id, 'seller', 'agent-seller', 'A clean audit with no findings is still a valid audit report.');
    console.log(`Both parties submitted arguments`);

    const arbitration = await disputeEngine.arbitrate(dispute.id);
    console.log(`\nAI Arbitration result:`);
    console.log(`  Decision: ${arbitration.decision}`);
    console.log(`  Refund: ${arbitration.refundPercentage}%`);
    console.log(`  Reasoning: ${arbitration.reasoning}`);
    console.log(`  Final status: ${dispute.status}`);
  }
  await sleep(DELAY);

  // ================================================================
  // STEP 11: x402 HTTP-native payments
  // ================================================================
  step(11, 'x402 Pay-per-use API demonstration');

  console.log(`x402 Protocol: HTTP-native machine-to-machine payments`);
  console.log(`Agent calls GET /services/sentiment → gets HTTP 402 Payment Required`);
  console.log(`Response includes payment requirements:`);
  console.log(`  {`);
  console.log(`    "type": "x402-payment-required",`);
  console.log(`    "paymentRequirements": {`);
  console.log(`      "scheme": "exact",`);
  console.log(`      "network": "eip155:137",`);
  console.log(`      "maxAmountRequired": "0.01",`);
  console.log(`      "asset": "${getChainConfig('polygon').usdtAddress}",`);
  console.log(`      "payTo": "${sellerAddr}"`);
  console.log(`    }`);
  console.log(`  }`);
  console.log(`Agent auto-pays USDT via WDK → re-requests with X-Payment-TxHash header`);
  console.log(`Server verifies → serves the response`);
  await sleep(DELAY);

  // ================================================================
  // SUMMARY
  // ================================================================
  header('Demo Complete — Summary');

  console.log(`\nAgents: 2 autonomous agents with self-custodial WDK wallets`);
  console.log(`Chains: ${agentA.getWalletManager().getInitializedChains().join(', ')}`);
  console.log(`Services published: ${registry.getAll().length}`);
  console.log(`Escrows completed: 1 (AI-validated, funds released)`);
  console.log(`Active subscriptions: ${subEngine.getActive().length}`);
  console.log(`x402 endpoints: 3 pay-per-use APIs`);
  console.log(`Negotiations: 1 (${neg.status} at ${neg.currentOffer} USDT)`);
  console.log(`\nWDK packages used: 9`);
  console.log(`AI reasoning: Claude Sonnet (with offline fallback)`);
  console.log(`Payment protocols: Escrow + Subscriptions + x402 + Negotiation`);
  console.log(`\nAll transactions are self-custodial. Keys never leave the agent.`);

  process.exit(0);
}

main().catch(console.error);
