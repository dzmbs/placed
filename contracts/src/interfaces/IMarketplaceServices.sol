// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IAssetNaming {
    function registerAsset(uint256 assetId, address creator, string calldata metadataURI) external;
    function registerSlot(uint256 assetId, uint256 slotId, string calldata metadataURI) external;
    function setWinner(uint256 slotId, address winner, string calldata artworkURI) external;
    function revokeWinner(uint256 slotId, address winner) external;
    function setRevenueToken(uint256 assetId, address token) external;
}

interface IAssetRevenueVault {
    function auctionHouse() external view returns (address);
    function assetId() external view returns (uint256);
    function creator() external view returns (address);
    function currency() external view returns (address);
    function revenueBps() external view returns (uint16);
    function termStart() external view returns (uint64);
    function termEnd() external view returns (uint64);
    function activated() external view returns (bool);
    function activate() external;
    function registerCampaign() external;
    function completeCampaign() external;
    function depositRevenue(uint256 amount) external;
}

interface IFinancingActivation {
    function activateFinancing(uint256 assetId, uint256 positionId, bytes32 poolId) external;
}
