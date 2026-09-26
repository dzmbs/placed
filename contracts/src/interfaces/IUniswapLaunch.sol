// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// ABI subsets pinned to CCA 2.1.0 and Liquidity Launchpad 3.3.0.
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct PoolParameters {
    uint24 fee;
    int24 tickSpacing;
    address hook;
}

struct PositionDefinition {
    int24 offsetLower;
    int24 offsetUpper;
    uint24 weight;
    address overridePositionRecipient;
}

struct LiquidityAllocationBracket {
    uint128 lowerThreshold;
    uint24 rate;
}

struct MigratorParameters {
    address token;
    address currency;
    uint64 migrationBlock;
    uint128 reservedTokenAmountForLP;
    address recipient;
    address positionRecipient;
    PoolParameters poolParameters;
    bytes positionDefinitions;
    bytes lpAllocationSchedule;
}

struct AuctionParameters {
    address currency;
    address tokensRecipient;
    address fundsRecipient;
    uint64 startBlock;
    uint64 endBlock;
    uint64 claimBlock;
    uint256 tickSpacing;
    address validationHook;
    uint256 floorPrice;
    uint128 requiredCurrencyRaised;
    bytes auctionStepsData;
}

interface ILBPStrategy {
    function registeredPoolIds(bytes32 poolId) external view returns (address);
    function initializerFactory() external view returns (address);
    function positionManager() external view returns (address);
    function initializeDistribution(address token, uint256 supply, bytes calldata configData, bytes32 salt) external;
    function migrate(address initializer) external;
}

interface ICCAFactory {
    function getAddress(address token, uint256 amount, bytes calldata config, bytes32 salt, address sender)
        external
        view
        returns (address);
    function protocolFeeController() external view returns (address);
}

interface ICCAAuction {
    function sweepCurrencyBlock() external view returns (uint256);
    function checkpoint() external;
    function isGraduated() external view returns (bool);
}

interface IV4PositionManager {
    function nextTokenId() external view returns (uint256);
    function ownerOf(uint256 id) external view returns (address);
    function getPoolAndPositionInfo(uint256 id) external view returns (PoolKey memory, uint256);
    function getPositionLiquidity(uint256 id) external view returns (uint128);
}
