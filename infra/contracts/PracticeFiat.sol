// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * Practice fiat for Kenji's FX desk (docs/HANDOFF-fx-fiat-pairs.md): Practice Euro and Practice Israeli Shekel.
 *
 * Same family as the Sepolia practice dollar (`tokens.demoUsdc`, symbol USDC, 6 decimals, open `mint`): anyone may
 * mint, so the ~$100M pool inventories are theatre, not capital, and the bank's LP key can top a pool up without a
 * faucet. Not protocol code (BLOXCHAIN-INTEGRATION.md §3.4) - a plain OpenZeppelin ERC-20 with two overrides.
 * Never a real-money token; never Circle USDC.
 */
contract PracticeFiat is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// Open mint, exactly like the practice dollar. Practice money is free by design.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
