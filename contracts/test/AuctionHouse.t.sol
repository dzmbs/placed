// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AuctionHouse} from "../src/AuctionHouse.sol";
import {AssetRevenueVault} from "../src/AssetRevenueVault.sol";
import {DemoUSDC} from "../src/DemoUSDC.sol";
import {IAssetNaming} from "../src/interfaces/IMarketplaceServices.sol";

contract NamingFixture is IAssetNaming {
    mapping(uint256 => address) public winners;
    function registerAsset(uint256, address, string calldata) external {}
    function registerSlot(uint256, uint256, string calldata) external {}

    function setWinner(uint256 slot, address winner, string calldata) external {
        winners[slot] = winner;
    }

    function revokeWinner(uint256 slot, address) external {
        delete winners[slot];
    }
    function setRevenueToken(uint256, address) external {}
}

contract LaunchFixture {
    AuctionHouse public house;

    constructor(AuctionHouse market) {
        house = market;
    }

    function register(uint256 asset, AssetRevenueVault vault) external {
        house.registerFinancing(asset, address(vault));
    }

    function activate(uint256 asset) external {
        house.activateFinancing(asset, 1, bytes32(uint256(1)));
    }
}

contract AuctionHouseTest is Test {
    uint256 constant SIGNER_KEY = 0xA11CE;
    uint256 constant PROOF_KEY = 0xB0B;
    uint256 constant USDC = 1e6;
    bytes32 constant ART = keccak256("artwork");
    address creator = makeAddr("creator");
    address brand = makeAddr("brand");
    address otherBrand = makeAddr("other brand");
    address investor = makeAddr("investor");
    AuctionHouse house;
    DemoUSDC currency;
    NamingFixture naming;
    LaunchFixture launch;
    uint256 asset;
    uint256 slot;

    function setUp() public {
        vm.warp(1000);
        currency = new DemoUSDC();
        house = new AuctionHouse(currency, address(this), vm.addr(SIGNER_KEY), vm.addr(PROOF_KEY));
        naming = new NamingFixture();
        launch = new LaunchFixture(house);
        house.configureServices(naming, address(launch));
        _authorize(creator);
        _authorize(brand);
        _authorize(otherBrand);
        vm.prank(creator);
        asset = house.publishAsset("ipfs://asset");
        vm.prank(creator);
        slot = house.createSlot(asset, "ipfs://shirt-front");
        _fund(brand);
        _fund(otherBrand);
        _fund(creator);
    }

    function testListingHasNoFinancing() public view {
        assertEq(house.getAsset(asset).financingSeries, address(0));
        assertEq(house.getSlot(slot).assetId, asset);
    }

    function testPublishingAndBiddingRequireAuthorization() public {
        vm.prank(investor);
        vm.expectRevert(AuctionHouse.Unauthorized.selector);
        house.publishAsset("ipfs://unauthorized");
        uint256 campaign = _campaign(slot, 6000);
        vm.prank(investor);
        vm.expectRevert(AuctionHouse.Unauthorized.selector);
        house.bid(campaign, USDC, "ipfs://logo", ART);
        vm.prank(creator);
        vm.expectRevert(AuctionHouse.Unauthorized.selector);
        house.bid(campaign, USDC, "ipfs://logo", ART);
    }

    function testParticipantSignatureNonceExpiryAndDomain() public {
        uint64 deadline = uint64(block.timestamp + 100);
        bytes memory sig = _participantSignature(investor, deadline);
        house.authorizeParticipant(investor, deadline, sig);
        vm.expectRevert(AuctionHouse.Unauthorized.selector);
        house.authorizeParticipant(investor, deadline, sig);
        sig = _participantSignature(investor, deadline);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(AuctionHouse.Unauthorized.selector);
        house.authorizeParticipant(investor, deadline, sig);
        vm.warp(deadline + 1);
        vm.expectRevert(AuctionHouse.Unauthorized.selector);
        house.authorizeParticipant(investor, deadline, sig);
    }

    function testBidIncrementRoundsUpAndOutbidWithdrawalIsFull() public {
        uint256 campaign = _campaign(slot, 6000);
        assertEq(house.getCampaign(campaign).bid, 0);
        assertEq(house.minimumBid(campaign), USDC);
        vm.prank(brand);
        vm.expectRevert(abi.encodeWithSelector(AuctionHouse.BidTooLow.selector, USDC));
        house.bid(campaign, USDC - 1, "ipfs://logo", ART);
        _bid(campaign, brand, USDC + 1);
        assertEq(house.minimumBid(campaign), 1_100_002);
        _bid(campaign, otherBrand, 1_100_002);
        assertEq(house.withdrawalCredits(brand), USDC + 1);
        uint256 beforeBalance = currency.balanceOf(brand);
        vm.prank(brand);
        house.withdrawOutbid();
        assertEq(currency.balanceOf(brand) - beforeBalance, USDC + 1);
        assertEq(house.withdrawalBalance(), 0);
        assertEq(house.openBidBalance(), 1_100_002);
        _assertHouseConservation();
    }

    function testZeroIncrementStillRequiresOneSmallestUnit() public {
        AuctionHouse.CampaignTerms memory terms = _terms(0);
        terms.minIncreaseBps = 0;
        vm.prank(creator);
        uint256 campaign = house.createCampaign(slot, terms);
        _bid(campaign, brand, USDC);
        assertEq(house.minimumBid(campaign), USDC + 1);
    }

    function testSlotsRunIndependentlyAndCannotOverlapThemselves() public {
        vm.prank(creator);
        uint256 secondSlot = house.createSlot(asset, "ipfs://shirt-back");
        uint256 first = _campaign(slot, 6000);
        uint256 second = _campaign(secondSlot, 6000);
        AuctionHouse.CampaignTerms memory terms = _terms(0);
        vm.prank(creator);
        vm.expectRevert(AuctionHouse.InvalidState.selector);
        house.createCampaign(slot, terms);
        _bid(first, brand, 1000 * USDC);
        _bid(second, otherBrand, 500 * USDC);
        vm.warp(1100);
        house.finalize(first);
        house.finalize(second);
        assertEq(house.campaignEscrowBalance(), 900 * USDC);
        house.refundEscrow(first);
        assertEq(house.getCampaign(second).held, 300 * USDC);
        assertEq(naming.winners(secondSlot), otherBrand);
        _assertHouseConservation();
    }

    function testUnfinancedCreatorGetsAllReleasedFunds() public {
        uint256 campaign = _campaign(slot, 6000);
        _bid(campaign, brand, 1000 * USDC);
        uint256 beforeBalance = currency.balanceOf(creator);
        vm.warp(1100);
        house.finalize(campaign);
        assertEq(currency.balanceOf(creator) - beforeBalance, 400 * USDC);
        assertEq(house.getCampaign(campaign).held, 600 * USDC);
        vm.warp(1500);
        _release(campaign);
        assertEq(currency.balanceOf(creator) - beforeBalance, 1000 * USDC);
        assertEq(naming.winners(slot), address(0));
        assertEq(house.getSlot(slot).currentCampaignId, 0);
        _assertHouseConservation();
    }

    function testFinancedPaymentsAndRefundConserveValue() public {
        AssetRevenueVault vault = _finance(5000);
        uint256 campaign = _campaign(slot, 6000);
        _bid(campaign, brand, 1000 * USDC);
        uint256 creatorBefore = currency.balanceOf(creator);
        uint256 brandBefore = currency.balanceOf(brand);
        vm.warp(1100);
        house.finalize(campaign);
        assertEq(currency.balanceOf(creator) - creatorBefore, 200 * USDC);
        assertEq(vault.accountedRevenue(), 200 * USDC);
        assertEq(house.campaignEscrowBalance(), 600 * USDC);
        house.refundEscrow(campaign);
        assertEq(currency.balanceOf(brand) - brandBefore, 600 * USDC);
        assertEq(vault.accountedRevenue(), 200 * USDC);
        assertEq(vault.unresolvedCampaigns(), 0);
        vm.warp(1500);
        bytes memory rejectedSignature = _proofSignature(campaign, ART, keccak256("proof-photo"), 1600);
        vm.expectRevert(AuctionHouse.InvalidState.selector);
        house.releaseProof(campaign, keccak256("proof-photo"), 1600, rejectedSignature);
        _assertHouseConservation();
    }

    function testCompletionAndRefundAreMutuallyExclusive() public {
        uint256 campaign = _campaign(slot, 10_000);
        _bid(campaign, brand, USDC);
        vm.warp(1100);
        house.finalize(campaign);
        vm.warp(1500);
        _release(campaign);
        bytes memory rejectedSignature = _proofSignature(campaign, ART, keccak256("proof-photo"), 1600);
        vm.expectRevert(AuctionHouse.InvalidState.selector);
        house.releaseProof(campaign, keccak256("proof-photo"), 1600, rejectedSignature);
        vm.expectRevert(AuctionHouse.InvalidState.selector);
        house.refundEscrow(campaign);
    }

    function testProofBindsCampaignArtworkAndChain() public {
        uint256 campaign = _campaign(slot, 6000);
        _bid(campaign, brand, USDC);
        vm.warp(1100);
        house.finalize(campaign);
        vm.warp(1500);
        bytes32 proof = keccak256("photo");
        uint64 deadline = 1600;
        bytes memory sig = _proofSignature(campaign, bytes32(0), proof, deadline);
        vm.expectRevert(AuctionHouse.Unauthorized.selector);
        house.releaseProof(campaign, proof, deadline, sig);
        sig = _proofSignature(campaign, ART, proof, deadline);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(AuctionHouse.Unauthorized.selector);
        house.releaseProof(campaign, proof, deadline, sig);
    }

    function testZeroEscrowStillNeedsCompletionAfterDisplay() public {
        uint256 campaign = _campaign(slot, 0);
        _bid(campaign, brand, USDC);
        vm.warp(1100);
        house.finalize(campaign);
        assertEq(house.getSlot(slot).currentCampaignId, campaign);
        vm.expectRevert(AuctionHouse.InvalidState.selector);
        house.completeWithoutEscrow(campaign);
        vm.warp(1500);
        house.completeWithoutEscrow(campaign);
        assertEq(naming.winners(slot), address(0));
        assertEq(house.getSlot(slot).currentCampaignId, 0);
        assertGt(_campaign(slot, 0), campaign);
    }

    function testNoBidsMeansNoSaleAndClosesCoveredCampaign() public {
        AssetRevenueVault vault = _finance(5000);
        uint256 campaign = _campaign(slot, 6000);
        assertEq(vault.unresolvedCampaigns(), 1);
        vm.warp(1100);
        house.finalize(campaign);
        assertEq(uint256(house.getCampaign(campaign).state), uint256(AuctionHouse.CampaignState.NoSale));
        assertEq(vault.unresolvedCampaigns(), 0);
        assertEq(house.getSlot(slot).currentCampaignId, 0);
    }

    function testExistingCampaignDoesNotBecomeCoveredAfterActivation() public {
        uint256 campaign = _campaign(slot, 6000);
        AssetRevenueVault vault = _finance(5000);
        assertEq(house.getCampaign(campaign).financingSeries, address(0));
        _bid(campaign, brand, USDC);
        vm.warp(1100);
        house.finalize(campaign);
        assertEq(vault.accountedRevenue(), 0);
        assertEq(vault.unresolvedCampaigns(), 0);
    }

    function testFutureSlotsShareSupplyAndDifferentAssetsStayIndependent() public {
        AssetRevenueVault vault = _finance(5000);
        vm.prank(creator);
        uint256 futureSlot = house.createSlot(asset, "ipfs://new-panel");
        uint256 covered = _campaign(futureSlot, 6000);
        assertEq(house.getCampaign(covered).financingSeries, address(vault));
        assertEq(vault.totalSupply(), 1_000_000 ether);
        vm.prank(creator);
        uint256 otherAsset = house.publishAsset("ipfs://different-asset");
        vm.prank(creator);
        uint256 otherSlot = house.createSlot(otherAsset, "ipfs://other-panel");
        uint256 unfinanced = _campaign(otherSlot, 6000);
        assertEq(house.getCampaign(unfinanced).financingSeries, address(0));
        _bid(covered, brand, 100 * USDC);
        _bid(unfinanced, otherBrand, 100 * USDC);
        vm.warp(1100);
        house.finalize(covered);
        house.finalize(unfinanced);
        assertEq(vault.accountedRevenue(), 20 * USDC);
        assertEq(vault.unresolvedCampaigns(), 1);
        assertEq(house.campaignEscrowBalance(), 120 * USDC);
        _assertHouseConservation();
    }

    function testOnlyBoundServicesCanActivateOrRedirectRevenue() public {
        AssetRevenueVault vault = _finance(5000);
        vm.prank(creator);
        vm.expectRevert(AuctionHouse.Unauthorized.selector);
        house.activateFinancing(asset, 1, bytes32(uint256(1)));
        vm.prank(creator);
        vm.expectRevert(AssetRevenueVault.Unauthorized.selector);
        vault.depositRevenue(USDC);
        vm.prank(creator);
        vm.expectRevert(AssetRevenueVault.Unauthorized.selector);
        vault.completeCampaign();
        vm.expectRevert(AuctionHouse.InvalidState.selector);
        launch.register(asset, vault);
    }

    function testMaturityWaitsForEverySlotAndTransferredTokensCarryClaim() public {
        AssetRevenueVault vault = _finance(5000);
        vm.prank(creator);
        uint256 secondSlot = house.createSlot(asset, "ipfs://shirt-back");
        uint256 first = _campaign(slot, 6000);
        uint256 second = _campaign(secondSlot, 6000);
        _bid(first, brand, 1000 * USDC);
        _bid(second, otherBrand, 1000 * USDC);
        vm.warp(1100);
        house.finalize(first);
        house.finalize(second);
        vm.prank(creator);
        vault.transfer(investor, 100_000 ether);
        vm.warp(2000);
        vm.prank(investor);
        vm.expectRevert(AssetRevenueVault.NotMature.selector);
        vault.redeem(100_000 ether);
        _release(first);
        vm.prank(investor);
        vm.expectRevert(AssetRevenueVault.NotMature.selector);
        vault.redeem(100_000 ether);
        _release(second);
        assertEq(vault.accountedRevenue(), 1000 * USDC);
        vm.prank(investor);
        vault.redeem(100_000 ether);
        assertEq(currency.balanceOf(investor), 100 * USDC);
        uint256 remaining = vault.balanceOf(creator);
        vm.prank(creator);
        vault.redeem(remaining);
        assertEq(vault.accountedRevenue(), 0);
        assertEq(vault.totalSupply(), 0);
        vm.prank(investor);
        vm.expectRevert(AssetRevenueVault.InvalidAmount.selector);
        vault.redeem(100_000 ether);
        _assertHouseConservation();
    }

    function testFuzzSettlementConservation(uint96 rawBid, uint16 escrow, uint16 revenue) public {
        uint256 amount = bound(rawBid, USDC, 9000 * USDC);
        escrow = uint16(bound(escrow, 0, 10_000));
        revenue = uint16(bound(revenue, 1, 10_000));
        AssetRevenueVault vault = _finance(revenue);
        uint256 campaign = _campaign(slot, escrow);
        _bid(campaign, brand, amount);
        uint256 beforeBalance = currency.balanceOf(creator);
        vm.warp(1100);
        house.finalize(campaign);
        uint256 released = amount * (10_000 - escrow) / 10_000;
        assertEq(
            currency.balanceOf(creator) - beforeBalance + vault.accountedRevenue() + house.getCampaign(campaign).held,
            amount
        );
        assertEq(vault.accountedRevenue(), released * revenue / 10_000);
        vm.warp(2000);
        if (house.getCampaign(campaign).held == 0) house.completeWithoutEscrow(campaign);
        else _release(campaign);
        assertEq(currency.balanceOf(creator) - beforeBalance + vault.accountedRevenue(), amount);
        assertEq(vault.unresolvedCampaigns(), 0);
        _assertHouseConservation();
    }

    function _finance(uint16 revenue) private returns (AssetRevenueVault vault) {
        vault = new AssetRevenueVault(
            address(house),
            asset,
            creator,
            currency,
            revenue,
            1200,
            2000,
            "Shirt revenue",
            "SHIRT",
            1_000_000 ether,
            creator
        );
        launch.register(asset, vault);
        launch.activate(asset);
    }

    function _terms(uint16 escrow) private view returns (AuctionHouse.CampaignTerms memory) {
        uint64 nowTime = uint64(block.timestamp);
        return AuctionHouse.CampaignTerms(nowTime, nowTime + 100, nowTime + 200, nowTime + 500, 1000, escrow);
    }

    function _campaign(uint256 slotId, uint16 escrow) private returns (uint256 id) {
        AuctionHouse.CampaignTerms memory terms = _terms(escrow);
        vm.prank(creator);
        id = house.createCampaign(slotId, terms);
    }

    function _bid(uint256 campaign, address bidder, uint256 amount) private {
        vm.prank(bidder);
        house.bid(campaign, amount, "ipfs://logo", ART);
    }

    function _release(uint256 campaign) private {
        bytes32 proof = keccak256("proof-photo");
        uint64 deadline = uint64(block.timestamp + 100);
        house.releaseProof(campaign, proof, deadline, _proofSignature(campaign, ART, proof, deadline));
    }

    function _proofSignature(uint256 campaign, bytes32 artwork, bytes32 proof, uint64 deadline)
        private
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(abi.encode(house.PROOF_TYPEHASH(), campaign, artwork, proof, deadline));
        return _sign(PROOF_KEY, structHash);
    }

    function _authorize(address wallet) private {
        uint64 deadline = uint64(block.timestamp + 100);
        house.authorizeParticipant(wallet, deadline, _participantSignature(wallet, deadline));
    }

    function _participantSignature(address wallet, uint64 deadline) private view returns (bytes memory) {
        return _sign(
            SIGNER_KEY,
            keccak256(abi.encode(house.PARTICIPANT_TYPEHASH(), wallet, house.participantNonces(wallet), deadline))
        );
    }

    function _sign(uint256 key, bytes32 structHash) private view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(key, keccak256(abi.encodePacked("\x19\x01", house.domainSeparator(), structHash)));
        return abi.encodePacked(r, s, v);
    }

    function _fund(address wallet) private {
        vm.prank(wallet);
        currency.faucet();
        vm.prank(wallet);
        currency.approve(address(house), type(uint256).max);
    }

    function _assertHouseConservation() private view {
        assertEq(
            currency.balanceOf(address(house)),
            house.openBidBalance() + house.withdrawalBalance() + house.campaignEscrowBalance()
        );
    }
}
