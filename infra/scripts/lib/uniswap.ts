/** Official Uniswap v4 Sepolia deployments (developers.uniswap.org/contracts/v4/deployments, read 2026-09-08). */
export const UNISWAP_SEPOLIA = {
  poolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
  universalRouter: '0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b',
  positionManager: '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4',
  stateView: '0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c',
  quoter: '0x61b3f2011a92d183c7dbadbda940a7555ccf9227',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  /** Sepolia WETH9 the Uniswap deployments use. Off the product path since 2026-09-09 (fiat pairs). */
  weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
} as const;
