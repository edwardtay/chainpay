declare module '@tetherto/wdk-protocol-lending-aave-evm' {
  export default class AaveProtocolEvm {
    constructor(account: any, config?: any);
    supply(params: { token: string; amount: bigint }, config?: any): Promise<{ hash: string; approveHash?: string }>;
    withdraw(params: { token: string; amount: bigint }): Promise<{ hash: string }>;
    borrow(params: { token: string; amount: bigint }): Promise<{ hash: string }>;
    repay(params: { token: string; amount: bigint }): Promise<{ hash: string; resetAllowanceHash?: string }>;
    quoteSupply(params: { token: string; amount: bigint }): Promise<{ fee: bigint }>;
    quoteBorrow(params: { token: string; amount: bigint }): Promise<{ fee: bigint }>;
    quoteWithdraw(params: { token: string; amount: bigint }): Promise<{ fee: bigint }>;
    quoteRepay(params: { token: string; amount: bigint }): Promise<{ fee: bigint }>;
    getAccountData(address: string): Promise<{
      totalCollateralBase: bigint;
      totalDebtBase: bigint;
      availableBorrowsBase: bigint;
      currentLiquidationThreshold: bigint;
      ltv: bigint;
      healthFactor: bigint;
    }>;
    setUseReserveAsCollateral(token: string, useAsCollateral: boolean): Promise<void>;
    setUserEMode(categoryId: number): Promise<void>;
  }
}

declare module '@tetherto/wdk-wallet-evm-erc-4337' {
  export default class WalletManagerEvmErc4337 {
    constructor(seedPhrase: string, config: any);
    getAccount(index: number): Promise<any>;
    getAccountByPath(path: string): Promise<any>;
  }
  export class WalletAccountEvmErc4337 {
    address: string;
    getBalance(): Promise<bigint>;
    getTokenBalance(token: string): Promise<bigint>;
    sendTransaction(tx: any, config?: any): Promise<{ hash: string; fee: bigint }>;
    getFeeRates(): Promise<any>;
    estimateFee(tx: any): Promise<bigint>;
    dispose(): void;
  }
}

declare module '@tetherto/wdk-protocol-swap-velora-evm' {
  export default class VeloraProtocolEvm {
    constructor(account: any, config?: any);
    swap(params: {
      tokenIn: string;
      tokenOut: string;
      tokenInAmount?: bigint;
      tokenOutAmount?: bigint;
      to?: string;
    }): Promise<{ hash: string; fee: bigint; tokenInAmount: bigint; tokenOutAmount: bigint }>;
    quoteSwap(params: {
      tokenIn: string;
      tokenOut: string;
      tokenInAmount?: bigint;
    }): Promise<{ fee: bigint; tokenInAmount: bigint; tokenOutAmount: bigint }>;
  }
}

declare module '@tetherto/wdk-protocol-bridge-usdt0-evm' {
  export default class Usdt0ProtocolEvm {
    constructor(account: any, config?: any);
    bridge(params: {
      targetChain: string;
      recipient: string;
      token: string;
      amount: bigint;
    }): Promise<{ hash: string; fee: bigint; amount: bigint }>;
    quoteBridge(params: {
      targetChain: string;
      recipient: string;
      token: string;
      amount: bigint;
    }): Promise<{ fee: bigint; amount: bigint }>;
  }
}
