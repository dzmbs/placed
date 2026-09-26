// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAssetNaming, IAssetRevenueVault} from "./interfaces/IMarketplaceServices.sol";

contract AuctionHouse is Ownable2Step, EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum CampaignState {
        Bidding,
        Displaying,
        Completed,
        NoSale,
        Refunded
    }

    struct Asset {
        address creator;
        string metadataURI;
        address financingSeries;
    }

    struct Slot {
        uint256 assetId;
        string metadataURI;
        uint256 currentCampaignId;
    }

    struct CampaignTerms {
        uint64 bidStart;
        uint64 bidEnd;
        uint64 displayStart;
        uint64 displayEnd;
        uint16 minIncreaseBps;
        uint16 escrowBps;
    }

    struct Campaign {
        uint256 slotId;
        CampaignTerms terms;
        CampaignState state;
        address financingSeries;
        uint16 revenueBps;
        address bidder;
        uint256 bid;
        uint256 held;
        string artworkURI;
        bytes32 artworkHash;
    }

    error Unauthorized();
    error InvalidInput();
    error InvalidState();
    error NotReady();
    error BidTooLow(uint256 minimum);
    error UnexpectedReceipt();

    event ParticipantAuthorized(address indexed wallet);
    event AssetPublished(uint256 indexed assetId, address indexed creator, string metadataURI);
    event SlotCreated(uint256 indexed assetId, uint256 indexed slotId, string metadataURI);
    event CampaignCreated(uint256 indexed campaignId, uint256 indexed slotId, address financingSeries);
    event BidPlaced(
        uint256 indexed campaignId, address indexed bidder, uint256 amount, string artworkURI, bytes32 artworkHash
    );
    event CampaignFinalized(uint256 indexed campaignId, address indexed winner, uint256 released, uint256 held);
    event PaymentReleased(uint256 indexed campaignId, uint256 creatorAmount, uint256 vaultAmount);
    event CampaignCompleted(uint256 indexed campaignId, bytes32 proofHash);
    event CampaignRefunded(uint256 indexed campaignId, address indexed winner, uint256 amount);
    event Withdrawal(address indexed wallet, uint256 amount);
    event FinancingRegistered(uint256 indexed assetId, address indexed series);
    event FinancingActivated(uint256 indexed assetId, address indexed series, uint256 positionId, bytes32 poolId);
    event SignersUpdated(address participantSigner, address proofSigner);

    uint256 public constant FIRST_BID = 1_000_000;
    bytes32 public constant PARTICIPANT_TYPEHASH =
        keccak256("ParticipantAuthorization(address wallet,uint256 nonce,uint64 deadline)");
    bytes32 public constant PROOF_TYPEHASH =
        keccak256("ProofRelease(uint256 campaignId,bytes32 artworkHash,bytes32 proofHash,uint64 deadline)");

    IERC20 public immutable currency;
    address public participantSigner;
    address public proofSigner;
    IAssetNaming public naming;
    address public financingFactory;

    uint256 public assetCount;
    uint256 public slotCount;
    uint256 public campaignCount;
    uint256 public openBidBalance;
    uint256 public withdrawalBalance;
    uint256 public campaignEscrowBalance;

    mapping(address => bool) public authorizedParticipants;
    mapping(address => uint256) public participantNonces;
    mapping(address => uint256) public withdrawalCredits;
    mapping(uint256 => Asset) private _assets;
    mapping(uint256 => Slot) private _slots;
    mapping(uint256 => Campaign) private _campaigns;

    constructor(IERC20 usdc, address admin, address humanSigner, address fulfillmentSigner)
        Ownable(admin)
        EIP712("PlacedAuctionHouse", "1")
    {
        if (address(usdc) == address(0) || humanSigner == address(0) || fulfillmentSigner == address(0)) {
            revert InvalidInput();
        }
        if (IERC20Metadata(address(usdc)).decimals() != 6) revert InvalidInput();
        currency = usdc;
        participantSigner = humanSigner;
        proofSigner = fulfillmentSigner;
    }

    function configureServices(IAssetNaming namingService, address launchFactory) external onlyOwner {
        if (address(naming) != address(0) || financingFactory != address(0) || assetCount != 0) revert InvalidState();
        if (address(namingService).code.length == 0 || launchFactory.code.length == 0) revert InvalidInput();
        naming = namingService;
        financingFactory = launchFactory;
    }

    function updateSigners(address humanSigner, address fulfillmentSigner) external onlyOwner {
        if (humanSigner == address(0) || fulfillmentSigner == address(0)) revert InvalidInput();
        participantSigner = humanSigner;
        proofSigner = fulfillmentSigner;
        emit SignersUpdated(humanSigner, fulfillmentSigner);
    }

    function authorizeParticipant(address wallet, uint64 deadline, bytes calldata signature) external {
        if (wallet == address(0) || block.timestamp > deadline) revert Unauthorized();
        uint256 nonce = participantNonces[wallet]++;
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(PARTICIPANT_TYPEHASH, wallet, nonce, deadline)));
        if (ECDSA.recover(digest, signature) != participantSigner) revert Unauthorized();
        authorizedParticipants[wallet] = true;
        emit ParticipantAuthorized(wallet);
    }

    function publishAsset(string calldata metadataURI) external nonReentrant returns (uint256 id) {
        _requireParticipant();
        if (address(naming) == address(0)) revert NotReady();
        _requireURI(metadataURI);
        id = ++assetCount;
        _assets[id] = Asset(msg.sender, metadataURI, address(0));
        naming.registerAsset(id, msg.sender, metadataURI);
        emit AssetPublished(id, msg.sender, metadataURI);
    }

    function createSlot(uint256 assetId, string calldata metadataURI) external nonReentrant returns (uint256 id) {
        if (_asset(assetId).creator != msg.sender) revert Unauthorized();
        _requireURI(metadataURI);
        id = ++slotCount;
        _slots[id] = Slot(assetId, metadataURI, 0);
        naming.registerSlot(assetId, id, metadataURI);
        emit SlotCreated(assetId, id, metadataURI);
    }

    function createCampaign(uint256 slotId, CampaignTerms calldata terms) external nonReentrant returns (uint256 id) {
        Slot storage slot = _slot(slotId);
        Asset storage asset = _asset(slot.assetId);
        if (asset.creator != msg.sender) revert Unauthorized();
        if (slot.currentCampaignId != 0) revert InvalidState();
        if (
            terms.bidStart < block.timestamp || terms.bidEnd <= terms.bidStart || terms.displayStart <= terms.bidEnd
                || terms.displayEnd <= terms.displayStart || terms.minIncreaseBps > 10_000 || terms.escrowBps > 10_000
        ) revert InvalidInput();
        address series;
        uint16 share;
        if (asset.financingSeries != address(0)) {
            IAssetRevenueVault vault = IAssetRevenueVault(asset.financingSeries);
            if (vault.activated() && terms.displayStart >= vault.termStart() && terms.displayEnd <= vault.termEnd()) {
                series = address(vault);
                share = vault.revenueBps();
                vault.registerCampaign();
            }
        }
        id = ++campaignCount;
        Campaign storage campaign = _campaigns[id];
        campaign.slotId = slotId;
        campaign.terms = terms;
        campaign.financingSeries = series;
        campaign.revenueBps = share;
        slot.currentCampaignId = id;
        emit CampaignCreated(id, slotId, series);
    }

    function bid(uint256 campaignId, uint256 amount, string calldata artworkURI, bytes32 artworkHash)
        external
        nonReentrant
    {
        _requireParticipant();
        Campaign storage campaign = _campaign(campaignId);
        if (
            campaign.state != CampaignState.Bidding || block.timestamp < campaign.terms.bidStart
                || block.timestamp >= campaign.terms.bidEnd
        ) revert InvalidState();
        if (_assets[_slots[campaign.slotId].assetId].creator == msg.sender) revert Unauthorized();
        uint256 minimum = minimumBid(campaignId);
        if (amount < minimum) revert BidTooLow(minimum);
        _requireURI(artworkURI);
        if (artworkHash == bytes32(0)) revert InvalidInput();
        uint256 beforeBalance = currency.balanceOf(address(this));
        currency.safeTransferFrom(msg.sender, address(this), amount);
        if (currency.balanceOf(address(this)) - beforeBalance != amount) revert UnexpectedReceipt();
        if (campaign.bid != 0) {
            withdrawalCredits[campaign.bidder] += campaign.bid;
            withdrawalBalance += campaign.bid;
            openBidBalance -= campaign.bid;
        }
        campaign.bidder = msg.sender;
        campaign.bid = amount;
        campaign.artworkURI = artworkURI;
        campaign.artworkHash = artworkHash;
        openBidBalance += amount;
        emit BidPlaced(campaignId, msg.sender, amount, artworkURI, artworkHash);
    }

    function withdrawOutbid() external nonReentrant {
        uint256 amount = withdrawalCredits[msg.sender];
        if (amount == 0) revert InvalidInput();
        withdrawalCredits[msg.sender] = 0;
        withdrawalBalance -= amount;
        currency.safeTransfer(msg.sender, amount);
        emit Withdrawal(msg.sender, amount);
    }

    function finalize(uint256 campaignId) external nonReentrant {
        Campaign storage campaign = _campaign(campaignId);
        if (campaign.state != CampaignState.Bidding || block.timestamp < campaign.terms.bidEnd) revert InvalidState();
        if (campaign.bid == 0) {
            campaign.state = CampaignState.NoSale;
            _close(campaign);
            emit CampaignFinalized(campaignId, address(0), 0, 0);
            return;
        }
        campaign.state = CampaignState.Displaying;
        openBidBalance -= campaign.bid;
        uint256 released = Math.mulDiv(campaign.bid, 10_000 - campaign.terms.escrowBps, 10_000);
        campaign.held = campaign.bid - released;
        campaignEscrowBalance += campaign.held;
        naming.setWinner(campaign.slotId, campaign.bidder, campaign.artworkURI);
        _release(campaignId, campaign, released);
        emit CampaignFinalized(campaignId, campaign.bidder, released, campaign.held);
    }

    function releaseProof(uint256 campaignId, bytes32 proofHash, uint64 deadline, bytes calldata signature)
        external
        nonReentrant
    {
        Campaign storage campaign = _campaign(campaignId);
        _requireDisplayed(campaign);
        if (campaign.held == 0 || proofHash == bytes32(0) || block.timestamp > deadline) revert InvalidInput();
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(PROOF_TYPEHASH, campaignId, campaign.artworkHash, proofHash, deadline))
        );
        if (ECDSA.recover(digest, signature) != proofSigner) revert Unauthorized();
        uint256 amount = campaign.held;
        campaign.held = 0;
        campaignEscrowBalance -= amount;
        campaign.state = CampaignState.Completed;
        _release(campaignId, campaign, amount);
        naming.revokeWinner(campaign.slotId, campaign.bidder);
        _close(campaign);
        emit CampaignCompleted(campaignId, proofHash);
    }

    function completeWithoutEscrow(uint256 campaignId) external nonReentrant {
        Campaign storage campaign = _campaign(campaignId);
        _requireDisplayed(campaign);
        if (campaign.held != 0) revert InvalidState();
        campaign.state = CampaignState.Completed;
        naming.revokeWinner(campaign.slotId, campaign.bidder);
        _close(campaign);
        emit CampaignCompleted(campaignId, bytes32(0));
    }

    function refundEscrow(uint256 campaignId) external onlyOwner nonReentrant {
        Campaign storage campaign = _campaign(campaignId);
        if (campaign.state != CampaignState.Displaying || campaign.held == 0) revert InvalidState();
        uint256 amount = campaign.held;
        campaign.held = 0;
        campaignEscrowBalance -= amount;
        campaign.state = CampaignState.Refunded;
        naming.revokeWinner(campaign.slotId, campaign.bidder);
        _close(campaign);
        currency.safeTransfer(campaign.bidder, amount);
        emit CampaignRefunded(campaignId, campaign.bidder, amount);
    }

    function registerFinancing(uint256 assetId, address series) external nonReentrant {
        if (msg.sender != financingFactory) revert Unauthorized();
        Asset storage asset = _asset(assetId);
        if (asset.financingSeries != address(0)) revert InvalidState();
        IAssetRevenueVault vault = IAssetRevenueVault(series);
        if (
            vault.auctionHouse() != address(this) || vault.assetId() != assetId || vault.creator() != asset.creator
                || vault.currency() != address(currency)
        ) revert InvalidInput();
        asset.financingSeries = series;
        naming.setRevenueToken(assetId, series);
        emit FinancingRegistered(assetId, series);
    }

    function activateFinancing(uint256 assetId, uint256 positionId, bytes32 poolId) external nonReentrant {
        if (msg.sender != financingFactory || poolId == bytes32(0) || positionId == 0) revert Unauthorized();
        Asset storage asset = _asset(assetId);
        if (asset.financingSeries == address(0)) revert InvalidState();
        IAssetRevenueVault(asset.financingSeries).activate();
        emit FinancingActivated(assetId, asset.financingSeries, positionId, poolId);
    }

    function minimumBid(uint256 campaignId) public view returns (uint256) {
        Campaign storage campaign = _campaign(campaignId);
        if (campaign.bid == 0) return FIRST_BID;
        uint256 increase = Math.mulDiv(campaign.bid, campaign.terms.minIncreaseBps, 10_000, Math.Rounding.Ceil);
        return campaign.bid + Math.max(increase, 1);
    }

    function getAsset(uint256 id) external view returns (Asset memory) {
        return _asset(id);
    }

    function getSlot(uint256 id) external view returns (Slot memory) {
        return _slot(id);
    }

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        return _campaign(id);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _asset(uint256 id) private view returns (Asset storage result) {
        result = _assets[id];
        if (result.creator == address(0)) revert InvalidInput();
    }

    function _slot(uint256 id) private view returns (Slot storage result) {
        result = _slots[id];
        if (result.assetId == 0) revert InvalidInput();
    }

    function _campaign(uint256 id) private view returns (Campaign storage result) {
        result = _campaigns[id];
        if (result.slotId == 0) revert InvalidInput();
    }

    function _requireParticipant() private view {
        if (!authorizedParticipants[msg.sender]) revert Unauthorized();
    }

    function _requireURI(string calldata uri) private pure {
        if (bytes(uri).length == 0 || bytes(uri).length > 2048) revert InvalidInput();
    }

    function _requireDisplayed(Campaign storage campaign) private view {
        if (campaign.state != CampaignState.Displaying || block.timestamp < campaign.terms.displayEnd) {
            revert InvalidState();
        }
    }

    function _release(uint256 id, Campaign storage campaign, uint256 amount) private {
        if (amount == 0) return;
        uint256 vaultAmount = Math.mulDiv(amount, campaign.revenueBps, 10_000);
        uint256 creatorAmount = amount - vaultAmount;
        if (vaultAmount != 0) {
            currency.forceApprove(campaign.financingSeries, vaultAmount);
            IAssetRevenueVault(campaign.financingSeries).depositRevenue(vaultAmount);
        }
        if (creatorAmount != 0) currency.safeTransfer(_assets[_slots[campaign.slotId].assetId].creator, creatorAmount);
        emit PaymentReleased(id, creatorAmount, vaultAmount);
    }

    function _close(Campaign storage campaign) private {
        _slots[campaign.slotId].currentCampaignId = 0;
        if (campaign.financingSeries != address(0)) IAssetRevenueVault(campaign.financingSeries).completeCampaign();
    }
}
