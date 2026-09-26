// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet faucet token with no real monetary value.
contract DemoUSDC is ERC20 {
    constructor() ERC20("Placed Demo USDC", "pUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        _mint(msg.sender, 10_000 * 1e6);
    }
}
