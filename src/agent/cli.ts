import * as dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';
import { ChainPayAgent } from './agent';

async function main() {
  const seedPhrase = process.env.SEED_PHRASE;
  if (!seedPhrase) {
    console.error('Error: SEED_PHRASE not set in .env file');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('Note: ANTHROPIC_API_KEY not set. Running in offline mode (no AI reasoning).');
  }

  console.log(`
+--------------------------------------------------+
|           ChainPay v2.0                  |
|   Agent-to-Agent Commerce on Tether WDK           |
|   AI-Powered | Multi-Chain | Self-Custodial       |
+--------------------------------------------------+
`);

  const agent = new ChainPayAgent(seedPhrase);

  console.log('Initializing multi-chain wallets...');
  await agent.initialize();
  console.log('Ready! Type "help" for commands or talk naturally.\n');

  const result = await agent.processCommand('addresses');
  console.log(result);
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question('chainpay> ', async (input) => {
      if (!input.trim()) { prompt(); return; }
      if (['exit', 'quit'].includes(input.trim().toLowerCase())) {
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      }

      try {
        const response = await agent.processCommand(input);
        console.log('\n' + response + '\n');
      } catch (error: any) {
        console.error('Error:', error.message);
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
