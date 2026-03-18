import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm';
import { MultiChainWalletManager } from './wallet-manager';
import { getChainConfig, CHAINS } from '../utils/chains';

/**
 * YieldManager — Optimizes idle USDT by supplying to Aave V3.
 *
 * Uses @tetherto/wdk-protocol-lending-aave-evm for real Aave V3 operations.
 * When escrow funds or idle balances exceed a threshold, the agent
 * autonomously supplies to Aave. When funds are needed, it withdraws.
 */
export class YieldManager {
  private aaveInstances: Map<string, AaveProtocolEvm> = new Map();
  private suppliedPositions: Map<string, { chain: string; amount: string; timestamp: Date }> = new Map();

  constructor(private walletManager: MultiChainWalletManager) {}

  /**
   * Initialize Aave protocol instances for EVM chains.
   */
  async initialize(chains: string[] = ['ethereum', 'polygon', 'arbitrum']): Promise<void> {
    for (const chain of chains) {
      try {
        const account = this.walletManager.getAccount(chain);
        const aave = new AaveProtocolEvm(account);
        this.aaveInstances.set(chain, aave);
      } catch {
        // Chain not initialized or not supported
      }
    }
  }

  /**
   * Supply USDT to Aave V3 on a specific chain.
   */
  async supplyToAave(chain: string, amountUsdt: string): Promise<{
    success: boolean;
    txHash?: string;
    approveHash?: string;
    error?: string;
  }> {
    const aave = this.aaveInstances.get(chain);
    if (!aave) return { success: false, error: `Aave not initialized for ${chain}` };

    const config = getChainConfig(chain);
    if (!config.usdtAddress) return { success: false, error: `No USDT on ${chain}` };

    const amount = BigInt(Math.floor(parseFloat(amountUsdt) * 10 ** config.usdtDecimals));

    try {
      const result = await aave.supply({
        token: config.usdtAddress,
        amount,
      });

      const posId = `${chain}-${Date.now()}`;
      this.suppliedPositions.set(posId, {
        chain,
        amount: amountUsdt,
        timestamp: new Date(),
      });

      return { success: true, txHash: result.hash, approveHash: result.approveHash };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Withdraw USDT from Aave V3.
   */
  async withdrawFromAave(chain: string, amountUsdt: string): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    const aave = this.aaveInstances.get(chain);
    if (!aave) return { success: false, error: `Aave not initialized for ${chain}` };

    const config = getChainConfig(chain);
    if (!config.usdtAddress) return { success: false, error: `No USDT on ${chain}` };

    const amount = BigInt(Math.floor(parseFloat(amountUsdt) * 10 ** config.usdtDecimals));

    try {
      const result = await aave.withdraw({
        token: config.usdtAddress,
        amount,
      });

      // Remove matching position
      for (const [id, pos] of this.suppliedPositions.entries()) {
        if (pos.chain === chain) {
          this.suppliedPositions.delete(id);
          break;
        }
      }

      return { success: true, txHash: result.hash };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get Aave account data for a chain.
   */
  async getAccountData(chain: string): Promise<{
    totalCollateral: string;
    totalDebt: string;
    availableBorrows: string;
    healthFactor: string;
  } | null> {
    const aave = this.aaveInstances.get(chain);
    if (!aave) return null;

    try {
      const address = await this.walletManager.getAddress(chain);
      const data = await aave.getAccountData(address);
      return {
        totalCollateral: data.totalCollateralBase.toString(),
        totalDebt: data.totalDebtBase.toString(),
        availableBorrows: data.availableBorrowsBase.toString(),
        healthFactor: data.healthFactor.toString(),
      };
    } catch {
      return null;
    }
  }

  getSuppliedPositions(): Array<{ id: string; chain: string; amount: string; timestamp: Date }> {
    return Array.from(this.suppliedPositions.entries()).map(([id, pos]) => ({ id, ...pos }));
  }

  getTotalSupplied(): number {
    return Array.from(this.suppliedPositions.values()).reduce(
      (sum, pos) => sum + parseFloat(pos.amount), 0
    );
  }

  /**
   * Evaluate whether idle funds should be supplied to Aave.
   */
  evaluateYieldOpportunity(
    idleFunds: Record<string, string>,
    escrowedAmount: number,
    monthlySpend: number
  ): { shouldSupply: boolean; chain: string; amount: string; reasoning: string } {
    const requiredBuffer = escrowedAmount + monthlySpend * 2;

    let bestChain = '';
    let bestAmount = 0;

    for (const [chain, balance] of Object.entries(idleFunds)) {
      const config = CHAINS[chain];
      if (!config || config.type !== 'evm') continue; // Aave only on EVM
      const bal = parseFloat(balance) / 10 ** config.usdtDecimals;
      if (bal > bestAmount) {
        bestAmount = bal;
        bestChain = chain;
      }
    }

    const supplyableAmount = bestAmount - requiredBuffer;
    const threshold = 10;

    if (supplyableAmount > threshold && bestChain) {
      return {
        shouldSupply: true,
        chain: bestChain,
        amount: supplyableAmount.toFixed(2),
        reasoning: `${supplyableAmount.toFixed(2)} USDT idle on ${bestChain} above ${requiredBuffer.toFixed(2)} buffer. Supply to Aave V3 for yield.`,
      };
    }

    return {
      shouldSupply: false,
      chain: bestChain || 'polygon',
      amount: '0',
      reasoning: `Idle: ${bestAmount.toFixed(2)} USDT, Buffer needed: ${requiredBuffer.toFixed(2)}. Already supplied: ${this.getTotalSupplied().toFixed(2)} USDT. No action.`,
    };
  }

  getInitializedChains(): string[] {
    return Array.from(this.aaveInstances.keys());
  }
}
