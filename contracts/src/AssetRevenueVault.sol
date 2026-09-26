// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Fixed-supply asset revenue token and its USDC vault. Only redemption burns shares.
contract AssetRevenueVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error Unauthorized();
    error InvalidTerms();
    error InvalidState();
    error NotMature();
    error InvalidAmount();
    error UnexpectedReceipt();

    event Activated();
    event RevenueReceived(uint256 amount, uint256 accountedRevenue);
    event Redeemed(address indexed holder, uint256 shares, uint256 amount);

    address public immutable auctionHouse;
    uint256 public immutable assetId;
    address public immutable creator;
    IERC20 public immutable currency;
    uint16 public immutable revenueBps;
    uint64 public immutable termStart;
    uint64 public immutable termEnd;
    uint256 public immutable initialSupply;

    bool public activated;
    uint256 public unresolvedCampaigns;
    uint256 public accountedRevenue;
    uint256 public lifetimeRevenue;

    constructor(
        address house,
        uint256 asset,
        address operator,
        IERC20 usdc,
        uint16 shareBps,
        uint64 start,
        uint64 end,
        string memory tokenName,
        string memory tokenSymbol,
        uint256 supply,
        address allocationRecipient
    ) ERC20(tokenName, tokenSymbol) {
        if (
            house == address(0) || operator == address(0) || address(usdc) == address(0) || asset == 0 || shareBps == 0
                || shareBps > 10_000 || start <= block.timestamp || end <= start || supply == 0
                || allocationRecipient == address(0) || bytes(tokenName).length == 0 || bytes(tokenSymbol).length == 0
        ) revert InvalidTerms();
        auctionHouse = house;
        assetId = asset;
        creator = operator;
        currency = usdc;
        revenueBps = shareBps;
        termStart = start;
        termEnd = end;
        initialSupply = supply;
        _mint(allocationRecipient, supply);
    }

    modifier onlyHouse() {
        if (msg.sender != auctionHouse) revert Unauthorized();
        _;
    }

    function activate() external onlyHouse {
        if (activated || block.timestamp >= termStart) revert InvalidState();
        activated = true;
        emit Activated();
    }

    function registerCampaign() external onlyHouse {
        if (!activated || block.timestamp >= termEnd) revert InvalidState();
        ++unresolvedCampaigns;
    }

    function completeCampaign() external onlyHouse {
        if (unresolvedCampaigns == 0) revert InvalidState();
        --unresolvedCampaigns;
    }

    function depositRevenue(uint256 amount) external onlyHouse nonReentrant {
        if (!activated || unresolvedCampaigns == 0 || amount == 0) revert InvalidState();
        uint256 beforeBalance = currency.balanceOf(address(this));
        currency.safeTransferFrom(msg.sender, address(this), amount);
        if (currency.balanceOf(address(this)) - beforeBalance != amount) revert UnexpectedReceipt();
        accountedRevenue += amount;
        lifetimeRevenue += amount;
        emit RevenueReceived(amount, accountedRevenue);
    }

    function redeem(uint256 shares) external nonReentrant returns (uint256 amount) {
        if (!activated || block.timestamp < termEnd || unresolvedCampaigns != 0) revert NotMature();
        if (shares == 0 || shares > balanceOf(msg.sender)) revert InvalidAmount();
        // Floor payouts against remaining shares; the last redeemer receives the rounding remainder.
        amount = Math.mulDiv(accountedRevenue, shares, totalSupply());
        _burn(msg.sender, shares);
        accountedRevenue -= amount;
        if (amount != 0) currency.safeTransfer(msg.sender, amount);
        emit Redeemed(msg.sender, shares, amount);
    }
}
