// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AuctionHouse} from "../src/AuctionHouse.sol";
import {DemoUSDC} from "../src/DemoUSDC.sol";
import {AssetRevenueVault} from "../src/AssetRevenueVault.sol";
import {AssetLaunchCoordinator} from "../src/AssetLaunchCoordinator.sol";
import {ENSAssetRegistry} from "../src/ENSAssetRegistry.sol";
import {IVerifiableFactory, IPermissionedResolver} from "../src/interfaces/IENSv2.sol";
import {PoolKey, ILBPStrategy, ICCAFactory, IV4PositionManager} from "../src/interfaces/IUniswapLaunch.sol";

interface ITestCCA {
    function sweepUnsoldTokens() external;
    function submitBid(uint256 maxPrice, uint128 budget, address owner, bytes calldata data) external returns (uint256);
    function checkpoint() external;
    function clearingPrice() external view returns (uint256);
    function isGraduated() external view returns (bool);
    function exitBid(uint256 id) external;
    function claimTokens(uint256 id) external;
}

interface ITestPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

interface ITestQuoter {
    struct QuoteParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 exactAmount;
        bytes hookData;
    }
    function quoteExactInputSingle(QuoteParams calldata params) external returns (uint256, uint256);
}

interface ITestRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

contract SepoliaIntegrationTest is Test {
    struct SwapParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 amountIn;
        uint128 amountOutMinimum;
        bytes hookData;
    }
    uint256 constant SIGNER = 0xA11CE;
    address constant STRATEGY = 0x95434E898Af471945Cab33D5064d2aC1A6Ba2000;
    address constant FACTORY = 0x000000001F26a0044BaA66024e7b6599c61963F8;
    AuctionHouse house;
    DemoUSDC currency;
    ENSAssetRegistry naming;
    AssetLaunchCoordinator launches;
    address creator = makeAddr("creator");
    address investor = makeAddr("investor");
    address secondInvestor = makeAddr("second investor");
    uint256 asset;
    uint256 slot;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_FORK_RPC_URL", string(""));
        vm.skip(bytes(rpc).length == 0);
        vm.createSelectFork(rpc);
        currency = new DemoUSDC();
        house = new AuctionHouse(currency, address(this), vm.addr(SIGNER), vm.addr(SIGNER));
        naming = new ENSAssetRegistry(
            address(house),
            IVerifiableFactory(0x9e726Eb570beb6BCEb495AB8cdA7df517d4e841C),
            0xA80338aAA8D23831cEa25E858D1774534aBb0263,
            0x14F09Fd05d4585759e54844DC9B00147131Cf243,
            hex"0b706c616365642d64656d6f0365746800",
            uint64(block.timestamp + 365 days)
        );
        launches = new AssetLaunchCoordinator(house, ILBPStrategy(STRATEGY), ICCAFactory(FACTORY));
        house.configureServices(naming, address(launches));
        _authorize(creator);
        _authorize(investor);
        vm.prank(creator);
        asset = house.publishAsset("ipfs://asset");
        vm.prank(creator);
        slot = house.createSlot(asset, "ipfs://slot");
        vm.prank(investor);
        currency.faucet();
        vm.prank(secondInvestor);
        currency.faucet();
    }

    function testENSv2WinnerCanEditOnlyOwnArtworkAndIsRevoked() public {
        vm.prank(creator);
        uint256 otherSlot = house.createSlot(asset, "ipfs://second-slot");
        AuctionHouse.CampaignTerms memory terms = AuctionHouse.CampaignTerms(
            uint64(block.timestamp),
            uint64(block.timestamp + 60),
            uint64(block.timestamp + 120),
            uint64(block.timestamp + 180),
            1000,
            0
        );
        vm.prank(creator);
        uint256 campaign = house.createCampaign(slot, terms);
        vm.prank(investor);
        currency.approve(address(house), 1e6);
        vm.prank(investor);
        house.bid(campaign, 1e6, "ipfs://winning-logo", keccak256("logo"));
        vm.warp(terms.bidEnd);
        house.finalize(campaign);
        IPermissionedResolver resolver = naming.slotResolvers(slot);
        bytes memory name = naming.slotNames(slot);
        assertEq(
            abi.decode(
                resolver.resolve(name, abi.encodeWithSignature("text(bytes32,string)", bytes32(0), "ad.metadata")),
                (string)
            ),
            "ipfs://slot"
        );
        assertEq(
            abi.decode(
                naming.assetResolvers(asset)
                    .resolve(
                        naming.assetNames(asset),
                        abi.encodeWithSignature("text(bytes32,string)", bytes32(0), "ad.metadata")
                    ),
                (string)
            ),
            "ipfs://asset"
        );
        vm.prank(investor);
        resolver.setText(name, "ad.artwork", "ipfs://updated-logo");
        assertEq(
            abi.decode(
                resolver.resolve(name, abi.encodeWithSignature("text(bytes32,string)", bytes32(0), "ad.artwork")),
                (string)
            ),
            "ipfs://updated-logo"
        );
        vm.prank(investor);
        vm.expectRevert();
        resolver.setText(name, "ad.revenueToken", "attacker");
        IPermissionedResolver otherResolver = naming.slotResolvers(otherSlot);
        bytes memory otherName = naming.slotNames(otherSlot);
        vm.prank(investor);
        vm.expectRevert();
        otherResolver.setText(otherName, "ad.artwork", "attacker");
        vm.prank(secondInvestor);
        vm.expectRevert();
        resolver.setText(name, "ad.artwork", "attacker");
        vm.warp(terms.displayEnd);
        house.completeWithoutEscrow(campaign);
        vm.prank(investor);
        vm.expectRevert();
        resolver.setText(name, "ad.artwork", "expired");
    }

    function testRealCCATokenClaimsAndFundedV4Migration() public {
        (AssetRevenueVault vault, ITestCCA auction, AssetLaunchCoordinator.LaunchTerms memory sale) = _launch(100e6);
        assertEq(vault.balanceOf(creator), 200 ether);
        assertEq(vault.balanceOf(address(auction)), 600 ether);
        assertFalse(vault.activated());
        vm.roll(sale.startBlock);
        uint256 first = _bid(auction, investor, sale.floorPrice * 20, 150e6);
        vm.roll(sale.startBlock + 1);
        uint256 second = _bid(auction, secondInvestor, sale.floorPrice * 30, 250e6);
        vm.roll(sale.claimBlock);
        auction.checkpoint();
        assertTrue(auction.isGraduated());
        auction.exitBid(first);
        auction.exitBid(second);
        auction.claimTokens(first);
        auction.claimTokens(second);
        assertGt(vault.balanceOf(investor), 0);
        assertGt(vault.balanceOf(secondInvestor), 0);
        vm.roll(sale.migrationBlock);
        assertTrue(launches.migrateAndActivate(asset));
        assertTrue(vault.activated());
        (,,,,,,, uint256 positionId, bytes32 poolId,) = launches.launches(asset);
        assertTrue(poolId != bytes32(0));
        IV4PositionManager manager = launches.positionManager();
        assertEq(manager.ownerOf(positionId), creator);
        assertGt(manager.getPositionLiquidity(positionId), 0);
        _trade(vault, manager, positionId);
    }

    function testUnsuccessfulCCARefundsBudgetAndNeverActivates() public {
        (AssetRevenueVault vault, ITestCCA auction, AssetLaunchCoordinator.LaunchTerms memory sale) = _launch(1000e6);
        vm.roll(sale.startBlock);
        uint256 id = _bid(auction, investor, sale.floorPrice * 20, 10e6);
        vm.roll(sale.migrationBlock);
        auction.checkpoint();
        assertFalse(auction.isGraduated());
        uint256 beforeBalance = currency.balanceOf(investor);
        auction.exitBid(id);
        assertEq(currency.balanceOf(investor) - beforeBalance, 10e6);
        vm.expectRevert(AssetLaunchCoordinator.InvalidState.selector);
        launches.migrateAndActivate(asset);
        assertFalse(vault.activated());
    }

    function testUnsuccessfulLaunchReturnsTokenReservesToCreator() public {
        (AssetRevenueVault vault, ITestCCA auction, AssetLaunchCoordinator.LaunchTerms memory sale) = _launch(1000e6);
        vm.roll(sale.migrationBlock);
        auction.checkpoint();
        ILBPStrategy(STRATEGY).migrate(address(auction));
        assertEq(vault.balanceOf(creator), 400 ether);
        vm.prank(creator);
        auction.sweepUnsoldTokens();
        assertEq(vault.balanceOf(creator), 1000 ether);
        vm.expectRevert(AssetLaunchCoordinator.InvalidState.selector);
        launches.activateMigratedLaunch(asset, 1);
        assertFalse(vault.activated());
    }

    function testDirectOfficialMigrationCanStillActivate() public {
        (AssetRevenueVault vault, ITestCCA auction, AssetLaunchCoordinator.LaunchTerms memory sale) = _launch(100e6);
        vm.expectRevert(AssetLaunchCoordinator.InvalidState.selector);
        launches.activateMigratedLaunch(asset, 1);
        vm.roll(sale.startBlock);
        _bid(auction, investor, sale.floorPrice * 20, 400e6);
        vm.roll(sale.migrationBlock);
        auction.checkpoint();
        uint256 positionId = launches.positionManager().nextTokenId();
        ILBPStrategy(STRATEGY).migrate(address(auction));
        launches.activateMigratedLaunch(asset, positionId);
        assertTrue(vault.activated());
        vm.expectRevert(AssetLaunchCoordinator.InvalidState.selector);
        launches.activateMigratedLaunch(asset, positionId);
    }

    function _launch(uint128 minimumRaise)
        private
        returns (AssetRevenueVault vault, ITestCCA auction, AssetLaunchCoordinator.LaunchTerms memory sale)
    {
        uint64 start = uint64(block.number + 5);
        uint256 floor = uint256(1e5) * (1 << 96) / 1e18;
        AssetLaunchCoordinator.FinancingTerms memory terms = AssetLaunchCoordinator.FinancingTerms(
            "Asset revenue",
            "ASSET",
            1000 ether,
            5000,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days)
        );
        sale = AssetLaunchCoordinator.LaunchTerms(
            600 ether, 200 ether, 2_000_000, start, start + 10, start + 11, start + 12, floor, floor, minimumRaise
        );
        vm.prank(creator);
        (address token, address cca) = launches.createLaunch(asset, terms, sale);
        vault = AssetRevenueVault(token);
        auction = ITestCCA(cca);
    }

    function _bid(ITestCCA auction, address owner, uint256 price, uint128 budget) private returns (uint256) {
        address permit2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
        vm.prank(owner);
        currency.approve(permit2, budget);
        vm.prank(owner);
        ITestPermit2(permit2).approve(address(currency), address(auction), budget, uint48(block.timestamp + 1 days));
        vm.prank(owner);
        return auction.submitBid(price, budget, owner, "");
    }

    function _authorize(address wallet) private {
        uint64 deadline = uint64(block.timestamp + 60);
        bytes32 hash = keccak256(abi.encode(house.PARTICIPANT_TYPEHASH(), wallet, uint256(0), deadline));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(SIGNER, keccak256(abi.encodePacked("\x19\x01", house.domainSeparator(), hash)));
        house.authorizeParticipant(wallet, deadline, abi.encodePacked(r, s, v));
    }

    function _trade(AssetRevenueVault vault, IV4PositionManager manager, uint256 positionId) private {
        (PoolKey memory key,) = manager.getPoolAndPositionInfo(positionId);
        bool zeroForOne = key.currency0 == address(currency);
        ITestQuoter quoter = ITestQuoter(0x61B3f2011A92d183C7dbaDBdA940a7555Ccf9227);
        (uint256 out,) = quoter.quoteExactInputSingle(ITestQuoter.QuoteParams(key, zeroForOne, 1e6, ""));
        assertGt(out, 0);
        address router = 0x470FFC67b1feEEC31D16C46AC7545C98716a194c;
        address permit2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
        vm.prank(investor);
        currency.approve(permit2, 1e6);
        vm.prank(investor);
        ITestPermit2(permit2).approve(address(currency), router, 1e6, uint48(block.timestamp + 300));
        bytes[] memory params = new bytes[](3);
        uint128 minimum = uint128(out * 99 / 100);
        params[0] = abi.encode(SwapParams(key, zeroForOne, uint128(1e6), minimum, bytes("")));
        params[1] = abi.encode(address(currency), uint256(1e6));
        params[2] = abi.encode(address(vault), uint256(minimum));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(hex"060c0f", params);
        uint256 beforeBalance = vault.balanceOf(investor);
        vm.prank(investor);
        ITestRouter(router).execute(hex"10", inputs, block.timestamp + 300);
        assertGe(vault.balanceOf(investor) - beforeBalance, minimum);
    }
}
