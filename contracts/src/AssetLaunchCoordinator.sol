// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AuctionHouse} from "./AuctionHouse.sol";
import {AssetRevenueVault} from "./AssetRevenueVault.sol";
import {
    PoolKey,
    PoolParameters,
    PositionDefinition,
    LiquidityAllocationBracket,
    MigratorParameters,
    AuctionParameters,
    ILBPStrategy,
    ICCAFactory,
    ICCAAuction,
    IV4PositionManager
} from "./interfaces/IUniswapLaunch.sol";

contract AssetLaunchCoordinator is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct FinancingTerms {
        string name;
        string symbol;
        uint128 totalSupply;
        uint16 revenueBps;
        uint64 termStart;
        uint64 termEnd;
    }

    struct LaunchTerms {
        uint128 auctionSupply;
        uint128 liquiditySupply;
        uint24 liquidityCurrencyMps;
        uint64 startBlock;
        uint64 endBlock;
        uint64 claimBlock;
        uint64 migrationBlock;
        uint256 floorPrice;
        uint256 priceTickSpacing;
        uint128 minimumRaise;
    }

    struct Launch {
        address vault;
        address auction;
        address creator;
        uint128 auctionSupply;
        uint128 liquiditySupply;
        uint24 liquidityCurrencyMps;
        uint64 migrationBlock;
        uint256 positionId;
        bytes32 poolId;
        bool migrationAttempted;
    }

    error Unauthorized();
    error InvalidTerms();
    error InvalidState();
    event LaunchCreated(
        uint256 indexed assetId, address indexed vault, address indexed auction, uint256 retainedSupply
    );
    event MigrationResult(uint256 indexed assetId, bool activated, uint256 positionId, bytes32 poolId);

    AuctionHouse public immutable auctionHouse;
    IERC20 public immutable currency;
    ILBPStrategy public immutable strategy;
    ICCAFactory public immutable ccaFactory;
    IV4PositionManager public immutable positionManager;
    mapping(uint256 => Launch) public launches;

    constructor(AuctionHouse house, ILBPStrategy launchStrategy, ICCAFactory factory) {
        if (
            address(house).code.length == 0 || address(launchStrategy).code.length == 0
                || address(factory).code.length == 0 || launchStrategy.initializerFactory() != address(factory)
        ) revert InvalidTerms();
        auctionHouse = house;
        currency = house.currency();
        strategy = launchStrategy;
        ccaFactory = factory;
        positionManager = IV4PositionManager(launchStrategy.positionManager());
    }

    function createLaunch(uint256 assetId, FinancingTerms calldata terms, LaunchTerms calldata sale)
        external
        nonReentrant
        returns (address token, address auction)
    {
        AuctionHouse.Asset memory asset = auctionHouse.getAsset(assetId);
        if (asset.creator != msg.sender) revert Unauthorized();
        if (asset.financingSeries != address(0) || launches[assetId].vault != address(0)) revert InvalidState();
        if (
            sale.auctionSupply == 0 || sale.liquiditySupply == 0
                || uint256(sale.auctionSupply) + sale.liquiditySupply > terms.totalSupply
                || sale.liquidityCurrencyMps == 0 || sale.liquidityCurrencyMps > 1e7 || sale.startBlock <= block.number
                || sale.endBlock <= sale.startBlock + 1 || sale.endBlock - sale.startBlock > 1e7
                || sale.claimBlock < sale.endBlock || sale.migrationBlock <= sale.endBlock || sale.floorPrice == 0
                || sale.priceTickSpacing == 0 || sale.minimumRaise == 0 || bytes(terms.name).length > 64
                || bytes(terms.symbol).length > 16
        ) revert InvalidTerms();
        AssetRevenueVault vault = new AssetRevenueVault(
            address(auctionHouse),
            assetId,
            msg.sender,
            currency,
            terms.revenueBps,
            terms.termStart,
            terms.termEnd,
            terms.name,
            terms.symbol,
            terms.totalSupply,
            address(this)
        );
        token = address(vault);
        bytes32 salt = keccak256(abi.encode(assetId, token));
        LiquidityAllocationBracket[] memory brackets = new LiquidityAllocationBracket[](1);
        brackets[0] = LiquidityAllocationBracket(0, sale.liquidityCurrencyMps);
        MigratorParameters memory migration = MigratorParameters(
            token,
            address(currency),
            sale.migrationBlock,
            sale.liquiditySupply,
            msg.sender,
            msg.sender,
            PoolParameters(3000, 60, address(0)),
            abi.encode(new PositionDefinition[](0)),
            abi.encode(brackets)
        );
        AuctionParameters memory params = AuctionParameters(
            address(currency),
            msg.sender,
            address(strategy),
            sale.startBlock,
            sale.endBlock,
            sale.claimBlock,
            sale.priceTickSpacing,
            address(0),
            sale.floorPrice,
            sale.minimumRaise,
            releaseSchedule(sale.endBlock - sale.startBlock)
        );
        bytes memory initializerParams = abi.encode(params);
        auction = ccaFactory.getAddress(
            token, sale.auctionSupply, initializerParams, keccak256(abi.encode(salt, migration)), address(strategy)
        );
        launches[assetId] = Launch(
            token,
            auction,
            msg.sender,
            sale.auctionSupply,
            sale.liquiditySupply,
            sale.liquidityCurrencyMps,
            sale.migrationBlock,
            0,
            bytes32(0),
            false
        );
        auctionHouse.registerFinancing(assetId, token);
        uint256 distributionSupply = uint256(sale.auctionSupply) + sale.liquiditySupply;
        IERC20(token).forceApprove(address(strategy), distributionSupply);
        strategy.initializeDistribution(token, distributionSupply, abi.encode(migration, initializerParams), salt);
        if (auction.code.length == 0) revert InvalidState();
        uint256 retained = terms.totalSupply - distributionSupply;
        if (retained != 0) IERC20(token).safeTransfer(msg.sender, retained);
        emit LaunchCreated(assetId, token, auction, retained);
    }

    function migrateAndActivate(uint256 assetId) external nonReentrant returns (bool activated) {
        Launch storage launch = launches[assetId];
        if (
            launch.vault == address(0) || launch.migrationAttempted || block.number < launch.migrationBlock
                || block.timestamp >= AssetRevenueVault(launch.vault).termStart()
        ) revert InvalidState();
        ICCAAuction(launch.auction).checkpoint();
        if (!ICCAAuction(launch.auction).isGraduated()) revert InvalidState();
        uint256 positionId = positionManager.nextTokenId();
        launch.migrationAttempted = true;
        strategy.migrate(launch.auction);
        // The official strategy can recover funds without minting an LP. A successful transaction alone is insufficient.
        if (positionManager.nextTokenId() != positionId + 1) {
            emit MigrationResult(assetId, false, 0, bytes32(0));
            return false;
        }
        _activate(assetId, positionId);
        return true;
    }

    function activateMigratedLaunch(uint256 assetId, uint256 positionId) external nonReentrant {
        Launch storage launch = launches[assetId];
        if (
            launch.vault == address(0) || AssetRevenueVault(launch.vault).activated()
                || block.number < launch.migrationBlock
                || block.timestamp >= AssetRevenueVault(launch.vault).termStart()
                || !ICCAAuction(launch.auction).isGraduated() || ICCAAuction(launch.auction).sweepCurrencyBlock() == 0
        ) revert InvalidState();
        PoolKey memory reservedKey = PoolKey(
            launch.vault < address(currency) ? launch.vault : address(currency),
            launch.vault < address(currency) ? address(currency) : launch.vault,
            3000,
            60,
            address(0)
        );
        if (strategy.registeredPoolIds(keccak256(abi.encode(reservedKey))) != address(0)) revert InvalidState();
        launch.migrationAttempted = true;
        _activate(assetId, positionId);
    }

    function _activate(uint256 assetId, uint256 positionId) private {
        Launch storage launch = launches[assetId];
        (PoolKey memory key,) = positionManager.getPoolAndPositionInfo(positionId);
        bool pairMatches = (key.currency0 == launch.vault && key.currency1 == address(currency))
            || (key.currency1 == launch.vault && key.currency0 == address(currency));
        if (
            !pairMatches || key.fee != 3000 || key.tickSpacing != 60
                || (key.hooks != address(0) && key.hooks != address(strategy))
                || positionManager.ownerOf(positionId) != launch.creator
                || positionManager.getPositionLiquidity(positionId) == 0
        ) revert InvalidState();
        launch.positionId = positionId;
        launch.poolId = keccak256(abi.encode(key));
        auctionHouse.activateFinancing(assetId, positionId, launch.poolId);
        emit MigrationResult(assetId, true, positionId, launch.poolId);
    }

    function releaseSchedule(uint64 blocks) public pure returns (bytes memory) {
        if (blocks < 2 || blocks > 1e7) revert InvalidTerms();
        uint24 rate = uint24(1e7 / blocks);
        uint24 finalRate = uint24(1e7 - uint256(rate) * (blocks - 1));
        return abi.encodePacked(rate, uint40(blocks - 1), finalRate, uint40(1));
    }
}
