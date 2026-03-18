import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

async function main() {
  const seedPhrase = WDK.getRandomSeedPhrase();

  console.log('========================================');
  console.log('  CHAINPAY PROTOCOL — WALLET GENERATED');
  console.log('========================================');
  console.log('');
  console.log('SEED PHRASE (SAVE THIS — DO NOT LOSE):');
  console.log(`  ${seedPhrase}`);
  console.log('');

  // EVM address (same for ETH, Polygon, Arbitrum, Sepolia)
  const evmWallet = new WalletManagerEvm(seedPhrase, { provider: 'https://sepolia.drpc.org' });
  const evmAccount = await evmWallet.getAccount(0);
  const evmAddr = evmAccount.address as string;

  console.log('DERIVED ADDRESSES:');
  console.log(`  EVM (ETH/Polygon/Arbitrum/Sepolia): ${evmAddr}`);
  console.log('');
  console.log('.env CONFIG:');
  console.log('----------------------------------------');
  console.log(`SEED_PHRASE=${seedPhrase}`);
  console.log(`NETWORK_MODE=testnet`);
  console.log(`SEPOLIA_RPC=https://sepolia.drpc.org`);
  console.log(`ETH_RPC=https://eth.drpc.org`);
  console.log(`POLYGON_RPC=https://polygon-rpc.com`);
  console.log(`ARBITRUM_RPC=https://arb1.arbitrum.io/rpc`);
  console.log(`TON_RPC=https://toncenter.com/api/v2/jsonRPC`);
  console.log(`TRON_RPC=https://api.trongrid.io`);
  console.log(`SOLANA_RPC=https://api.mainnet-beta.solana.com`);
  console.log(`PORT=3000`);
  console.log(`ANTHROPIC_API_KEY=`);
  console.log('----------------------------------------');
  console.log('');
  console.log('FUND THIS ADDRESS ON SEPOLIA:');
  console.log(`  ${evmAddr}`);
  console.log('');
  console.log('Faucets:');
  console.log('  Sepolia ETH:  https://faucets.chain.link/sepolia');
  console.log('  Sepolia ETH:  https://www.alchemy.com/faucets/ethereum-sepolia');
  console.log('  Test USDT:    0xd077a400968890eacc75cdc901f0356c943e4fdb on Sepolia');

  process.exit(0);
}

main().catch(console.error);
