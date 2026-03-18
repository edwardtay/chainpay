import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337';
import WalletManagerTon from '@tetherto/wdk-wallet-ton';
import WalletManagerTron from '@tetherto/wdk-wallet-tron';
import WalletManagerSolana from '@tetherto/wdk-wallet-solana';
import { CHAINS, ChainConfig } from '../utils/chains';

export class MultiChainWalletManager {
  private wdk: any;
  private wallets: Map<string, any> = new Map();
  private accounts: Map<string, any> = new Map();
  private smartAccounts: Map<string, any> = new Map(); // ERC-4337
  private gaslessEnabled = false;

  constructor(private seedPhrase: string) {}

  async initialize(): Promise<void> {
    this.wdk = new WDK(this.seedPhrase);

    // Register standard EVM wallets
    for (const [chainName, config] of Object.entries(CHAINS)) {
      if (config.type === 'evm') {
        const rpc = process.env[config.rpcEnvKey];
        if (!rpc) continue;
        const wallet = new WalletManagerEvm(this.seedPhrase, { provider: rpc });
        this.wallets.set(chainName, wallet);
        const account = await wallet.getAccount(0);
        this.accounts.set(chainName, account);
      }
    }

    // Register ERC-4337 smart accounts for gasless transactions
    await this.initializeGaslessAccounts();

    // Register TON wallet
    const tonRpc = process.env.TON_RPC;
    if (tonRpc) {
      const tonConfig: any = { provider: tonRpc };
      if (process.env.TON_API_KEY) {
        tonConfig.apiKey = process.env.TON_API_KEY;
      }
      const wallet = new WalletManagerTon(this.seedPhrase, tonConfig);
      this.wallets.set('ton', wallet);
      const account = await wallet.getAccount(0);
      this.accounts.set('ton', account);
    }

    // Register Tron wallet
    const tronRpc = process.env.TRON_RPC;
    if (tronRpc) {
      const wallet = new WalletManagerTron(this.seedPhrase, { provider: tronRpc });
      this.wallets.set('tron', wallet);
      const account = await wallet.getAccount(0);
      this.accounts.set('tron', account);
    }

    // Register Solana wallet
    const solRpc = process.env.SOLANA_RPC;
    if (solRpc) {
      const wallet = new WalletManagerSolana(this.seedPhrase, { rpcUrl: solRpc });
      this.wallets.set('solana', wallet);
      const account = await wallet.getAccount(0);
      this.accounts.set('solana', account);
    }
  }

  /**
   * Initialize ERC-4337 smart accounts for gasless transactions.
   * Supports paymaster token mode (pay gas with USDT) or sponsorship.
   */
  private async initializeGaslessAccounts(): Promise<void> {
    const bundlerUrl = process.env.BUNDLER_URL;
    const paymasterUrl = process.env.PAYMASTER_URL;
    if (!bundlerUrl) return; // Gasless not configured

    const erc4337Chains: Array<{ name: string; chainId: number; rpcKey: string }> = [
      { name: 'ethereum', chainId: 1, rpcKey: 'ETH_RPC' },
      { name: 'polygon', chainId: 137, rpcKey: 'POLYGON_RPC' },
      { name: 'arbitrum', chainId: 42161, rpcKey: 'ARBITRUM_RPC' },
    ];

    for (const chain of erc4337Chains) {
      const rpc = process.env[chain.rpcKey];
      if (!rpc) continue;

      try {
        const config: any = {
          chainId: chain.chainId,
          provider: rpc,
          bundlerUrl,
          entryPointAddress: '0x0000000071727De22E5E9d4467Bb36C96B9b25ef7',
          safeModulesVersion: '0.3.0',
        };

        if (paymasterUrl) {
          const paymasterAddress = process.env.PAYMASTER_ADDRESS;
          const usdtAddress = CHAINS[chain.name]?.usdtAddress;

          if (process.env.SPONSORED === 'true') {
            config.isSponsored = true;
            config.paymasterUrl = paymasterUrl;
            config.sponsorshipPolicyId = process.env.SPONSORSHIP_POLICY_ID;
          } else if (paymasterAddress && usdtAddress) {
            config.paymasterUrl = paymasterUrl;
            config.paymasterAddress = paymasterAddress;
            config.paymasterToken = { address: usdtAddress };
          }
        } else {
          config.useNativeCoins = true;
        }

        const wallet = new WalletManagerEvmErc4337(this.seedPhrase, config);
        const account = await wallet.getAccount(0);
        this.smartAccounts.set(chain.name, account);
        this.gaslessEnabled = true;
      } catch {
        // ERC-4337 not available for this chain
      }
    }
  }

  getWallet(chain: string): any {
    const wallet = this.wallets.get(chain.toLowerCase());
    if (!wallet) throw new Error(`Wallet not initialized for chain: ${chain}`);
    return wallet;
  }

  getAccount(chain: string): any {
    const account = this.accounts.get(chain.toLowerCase());
    if (!account) throw new Error(`Account not initialized for chain: ${chain}`);
    return account;
  }

  /**
   * Get ERC-4337 smart account for gasless transactions.
   */
  getSmartAccount(chain: string): any | undefined {
    return this.smartAccounts.get(chain.toLowerCase());
  }

  /**
   * Send a gasless transaction via ERC-4337 if available, otherwise standard.
   */
  async sendGaslessOrStandard(chain: string, tx: { to: string; amount: bigint; token?: string }): Promise<{ hash: string; gasless: boolean }> {
    const smartAccount = this.smartAccounts.get(chain.toLowerCase());
    if (smartAccount) {
      try {
        const result = await smartAccount.sendTransaction(tx);
        return { hash: result.hash, gasless: true };
      } catch {
        // Fall back to standard
      }
    }

    const account = this.getAccount(chain);
    const result = await account.sendTransaction(tx);
    return { hash: result.hash, gasless: false };
  }

  isGaslessEnabled(): boolean {
    return this.gaslessEnabled;
  }

  getGaslessChains(): string[] {
    return Array.from(this.smartAccounts.keys());
  }

  async getAddress(chain: string): Promise<string> {
    const account = this.getAccount(chain);
    return account.address || account.getAddress?.() || '';
  }

  async getSmartAccountAddress(chain: string): Promise<string | null> {
    const sa = this.smartAccounts.get(chain.toLowerCase());
    if (!sa) return null;
    return sa.address || sa.getAddress?.() || null;
  }

  async getAllAddresses(): Promise<Record<string, string>> {
    const addresses: Record<string, string> = {};
    for (const chain of this.accounts.keys()) {
      try {
        addresses[chain] = await this.getAddress(chain);
        // Also include smart account address if available
        const saAddr = await this.getSmartAccountAddress(chain);
        if (saAddr) addresses[`${chain}-4337`] = saAddr;
      } catch {
        // Skip chains that fail
      }
    }
    return addresses;
  }

  async getBalance(chain: string): Promise<{ native: string; usdt: string; xaut?: string }> {
    const account = this.getAccount(chain);
    const config = CHAINS[chain.toLowerCase()];

    const nativeBalance = await account.getBalance();
    let usdtBalance = '0';
    let xautBalance: string | undefined;

    if (config?.usdtAddress) {
      try {
        const tokenBal = await account.getTokenBalance(config.usdtAddress);
        usdtBalance = tokenBal?.toString() || '0';
      } catch {
        usdtBalance = '0';
      }
    }

    // Check XAU₮ (Tether Gold) balance if supported on this chain
    if (config?.xautAddress) {
      try {
        const xautBal = await account.getTokenBalance(config.xautAddress);
        xautBalance = xautBal?.toString() || '0';
      } catch {
        xautBalance = '0';
      }
    }

    return {
      native: nativeBalance?.toString() || '0',
      usdt: usdtBalance,
      ...(xautBalance !== undefined ? { xaut: xautBalance } : {}),
    };
  }

  async getAllBalances(): Promise<Record<string, { native: string; usdt: string; xaut?: string }>> {
    const balances: Record<string, { native: string; usdt: string; xaut?: string }> = {};
    for (const chain of this.accounts.keys()) {
      try {
        balances[chain] = await this.getBalance(chain);
      } catch {
        balances[chain] = { native: '0', usdt: '0' };
      }
    }
    return balances;
  }

  getInitializedChains(): string[] {
    return Array.from(this.wallets.keys());
  }
}
