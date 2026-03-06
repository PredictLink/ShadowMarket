// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC — Test ERC20 token mimicking USDC
/// @notice 6-decimal ERC20 used for local and Hardhat testing
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        // Mint 1,000,000 USDC (6 decimals) to deployer
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    /// @notice Mint tokens for testing
    /// @param to Recipient address
    /// @param amount Amount in 6-decimal units
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Override decimals to match real USDC
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
