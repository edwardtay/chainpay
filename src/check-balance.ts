import * as dotenv from 'dotenv';
dotenv.config();

import { MultiChainWalletManager } from './services/wallet-manager';
import { CHAINS } from './utils/chains';

async function main() {
  const seedPhrase = process.env.SEED_PHRASE;
  if (!seedPhrase) {
    console.error('Error: SEED_PHRASE not set in .env');
    process.exit(1);
  }

  console.log('Checking balances across all chains...\n');

  const manager = new MultiChainWalletManager(seedPhrase);
  await manager.initialize();

  const addresses = await manager.getAllAddresses();
  const balances = await manager.getAllBalances();

  for (const chain of manager.getInitializedChains()) {
    const config = CHAINS[chain];
    if (!config) continue;
    const addr = addresses[chain] || '?';
    const bal = balances[chain] || { native: '0', usdt: '0' };

    // Format native balance
    let nativeFormatted = '0';
    if (config.type === 'evm') {
      nativeFormatted = (parseInt(bal.native) / 1e18).toFixed(6);
    } else {
      nativeFormatted = bal.native;
    }

    // Format USDT balance
    const usdtFormatted = (parseInt(bal.usdt) / 10 ** config.usdtDecimals).toFixed(2);

    const testnetLabel = (config as any).testnet ? ' [TESTNET]' : '';
    console.log(`${config.name}${testnetLabel}:`);
    console.log(`  Address: ${addr}`);
    console.log(`  ${config.nativeSymbol}: ${nativeFormatted}`);
    console.log(`  USDT: ${usdtFormatted}`);
    console.log('');
  }

  // ERC-4337 smart accounts
  const gaslessChains = manager.getGaslessChains();
  if (gaslessChains.length > 0) {
    console.log('ERC-4337 Smart Accounts:');
    for (const chain of gaslessChains) {
      const addr = await manager.getSmartAccountAddress(chain);
      console.log(`  ${chain}: ${addr}`);
    }
    console.log('');
  }

  console.log(`Gasless enabled: ${manager.isGaslessEnabled()}`);
  process.exit(0);
}

main().catch(console.error);
