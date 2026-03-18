export interface ChainConfig {
  name: string;
  type: 'evm' | 'ton' | 'tron' | 'solana';
  chainId?: number;
  rpcEnvKey: string;
  nativeSymbol: string;
  usdtAddress?: string;
  usdtDecimals: number;
  xautAddress?: string; // Tether Gold (XAU₮)
  xautDecimals?: number;
  explorerTx: string;
  testnet?: boolean;
}

// Supported Tether assets
export const TETHER_ASSETS = {
  USDT: { symbol: 'USD₮', name: 'Tether USD', decimals: 6 },
  XAUT: { symbol: 'XAU₮', name: 'Tether Gold', decimals: 6 },
} as const;

const isTestnet = process.env.NETWORK_MODE === 'testnet';

export const CHAINS: Record<string, ChainConfig> = {
  // Sepolia testnet — used when NETWORK_MODE=testnet
  ...(isTestnet ? {
    sepolia: {
      name: 'Sepolia',
      type: 'evm' as const,
      chainId: 11155111,
      rpcEnvKey: 'SEPOLIA_RPC',
      nativeSymbol: 'ETH',
      usdtAddress: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
      usdtDecimals: 6,
      explorerTx: 'https://sepolia.etherscan.io/tx/',
      testnet: true,
    },
  } : {}),
  ethereum: {
    name: 'Ethereum',
    type: 'evm',
    chainId: 1,
    rpcEnvKey: 'ETH_RPC',
    nativeSymbol: 'ETH',
    usdtAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    usdtDecimals: 6,
    xautAddress: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
    xautDecimals: 6,
    explorerTx: 'https://etherscan.io/tx/',
  },
  polygon: {
    name: 'Polygon',
    type: 'evm',
    chainId: 137,
    rpcEnvKey: 'POLYGON_RPC',
    nativeSymbol: 'MATIC',
    usdtAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    usdtDecimals: 6,
    explorerTx: 'https://polygonscan.com/tx/',
  },
  arbitrum: {
    name: 'Arbitrum',
    type: 'evm',
    chainId: 42161,
    rpcEnvKey: 'ARBITRUM_RPC',
    nativeSymbol: 'ETH',
    usdtAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    usdtDecimals: 6,
    explorerTx: 'https://arbiscan.io/tx/',
  },
  ton: {
    name: 'TON',
    type: 'ton',
    rpcEnvKey: 'TON_RPC',
    nativeSymbol: 'TON',
    usdtAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    usdtDecimals: 6,
    explorerTx: 'https://tonviewer.com/transaction/',
  },
  tron: {
    name: 'Tron',
    type: 'tron',
    rpcEnvKey: 'TRON_RPC',
    nativeSymbol: 'TRX',
    usdtAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    usdtDecimals: 6,
    explorerTx: 'https://tronscan.org/#/transaction/',
  },
  solana: {
    name: 'Solana',
    type: 'solana',
    rpcEnvKey: 'SOLANA_RPC',
    nativeSymbol: 'SOL',
    usdtAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    usdtDecimals: 6,
    explorerTx: 'https://solscan.io/tx/',
  },
};

export function getChainConfig(chain: string): ChainConfig {
  const config = CHAINS[chain.toLowerCase()];
  if (!config) throw new Error(`Unsupported chain: ${chain}`);
  return config;
}

export function detectChainFromAddress(address: string): string | null {
  if (address.startsWith('0x') && address.length === 42) return null; // Could be any EVM
  if (address.startsWith('T') && address.length === 34) return 'tron';
  if (address.startsWith('UQ') || address.startsWith('EQ')) return 'ton';
  if (address.length >= 32 && address.length <= 44 && !address.startsWith('0x') && !address.startsWith('T')) return 'solana';
  return null;
}
