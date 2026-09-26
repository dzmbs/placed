// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IAssetNaming} from "./interfaces/IMarketplaceServices.sol";
import {ENSGrant, IVerifiableFactory, IUserRegistry, IPermissionedResolver} from "./interfaces/IENSv2.sol";

contract ENSAssetRegistry is IAssetNaming, ERC1155Holder {
    error Unauthorized();
    error InvalidInput();

    event AssetNamed(uint256 indexed assetId, bytes dnsName, address registry, address resolver);
    event SlotNamed(uint256 indexed slotId, bytes dnsName, address resolver);

    uint256 private constant TEXT_ROLE = 1 << 4;
    uint256 private constant TEXT_ADMIN_ROLE = TEXT_ROLE << 128;
    address public immutable auctionHouse;
    IVerifiableFactory public immutable factory;
    address public immutable registryImplementation;
    address public immutable resolverImplementation;
    IUserRegistry public immutable rootRegistry;
    bytes public parentName;
    uint64 public immutable nameExpiry;

    mapping(uint256 => IUserRegistry) public assetRegistries;
    mapping(uint256 => IPermissionedResolver) public assetResolvers;
    mapping(uint256 => IPermissionedResolver) public slotResolvers;
    mapping(uint256 => bytes) public assetNames;
    mapping(uint256 => bytes) public slotNames;
    mapping(uint256 => address) public slotWinners;

    constructor(
        address house,
        IVerifiableFactory proxyFactory,
        address registryImpl,
        address resolverImpl,
        bytes memory parentDNS,
        uint64 expiry
    ) {
        if (
            house.code.length == 0 || address(proxyFactory).code.length == 0 || registryImpl.code.length == 0
                || resolverImpl.code.length == 0 || parentDNS.length < 2 || parentDNS[parentDNS.length - 1] != 0
                || expiry <= block.timestamp
        ) revert InvalidInput();
        auctionHouse = house;
        factory = proxyFactory;
        registryImplementation = registryImpl;
        resolverImplementation = resolverImpl;
        parentName = parentDNS;
        nameExpiry = expiry;
        rootRegistry = _newRegistry(keccak256("root"));
    }

    modifier onlyHouse() {
        if (msg.sender != auctionHouse) revert Unauthorized();
        _;
    }

    function registerAsset(uint256 assetId, address, string calldata metadataURI) external onlyHouse {
        if (address(assetRegistries[assetId]) != address(0)) revert InvalidInput();
        string memory label = string.concat("a", Strings.toString(assetId));
        bytes memory name = _prepend(label, parentName);
        IUserRegistry registry = _newRegistry(keccak256(abi.encode("asset-registry", assetId)));
        IPermissionedResolver resolver = _newResolver(keccak256(abi.encode("asset-resolver", assetId)));
        assetRegistries[assetId] = registry;
        assetResolvers[assetId] = resolver;
        assetNames[assetId] = name;
        rootRegistry.register(label, address(this), address(registry), address(resolver), 0, nameExpiry);
        resolver.setText(name, "ad.metadata", metadataURI);
        emit AssetNamed(assetId, name, address(registry), address(resolver));
    }

    function registerSlot(uint256 assetId, uint256 slotId, string calldata metadataURI) external onlyHouse {
        if (address(assetRegistries[assetId]) == address(0) || address(slotResolvers[slotId]) != address(0)) {
            revert InvalidInput();
        }
        string memory label = string.concat("s", Strings.toString(slotId));
        bytes memory name = _prepend(label, assetNames[assetId]);
        IPermissionedResolver resolver = _newResolver(keccak256(abi.encode("slot-resolver", slotId)));
        slotResolvers[slotId] = resolver;
        slotNames[slotId] = name;
        assetRegistries[assetId].register(label, address(this), address(0), address(resolver), 0, nameExpiry);
        resolver.setText(name, "ad.metadata", metadataURI);
        emit SlotNamed(slotId, name, address(resolver));
    }

    function setWinner(uint256 slotId, address winner, string calldata artworkURI) external onlyHouse {
        if (slotWinners[slotId] != address(0) || winner == address(0)) revert InvalidInput();
        IPermissionedResolver resolver = slotResolvers[slotId];
        bytes memory name = slotNames[slotId];
        resolver.setText(name, "ad.artwork", artworkURI);
        resolver.grantSetterRoles(abi.encodeCall(IPermissionedResolver.setText, (name, "ad.artwork", "")), winner);
        slotWinners[slotId] = winner;
    }

    function revokeWinner(uint256 slotId, address winner) external onlyHouse {
        if (slotWinners[slotId] != winner || winner == address(0)) revert InvalidInput();
        slotResolvers[slotId].revokeRoles(uint256(keccak256("ad.artwork")), TEXT_ROLE, winner);
        delete slotWinners[slotId];
    }

    function setRevenueToken(uint256 assetId, address token) external onlyHouse {
        assetResolvers[assetId].setText(assetNames[assetId], "ad.revenueToken", Strings.toHexString(token));
    }

    function _newRegistry(bytes32 salt) private returns (IUserRegistry) {
        ENSGrant[] memory grants = new ENSGrant[](1);
        grants[0] = ENSGrant(address(this), 1); // Registrar only; names cannot be transferred or upgraded.
        return IUserRegistry(
            factory.deployProxy(
                registryImplementation, uint256(salt), abi.encodeCall(IUserRegistry.initialize, (grants))
            )
        );
    }

    function _newResolver(bytes32 salt) private returns (IPermissionedResolver) {
        ENSGrant[] memory grants = new ENSGrant[](1);
        grants[0] = ENSGrant(address(this), TEXT_ROLE | TEXT_ADMIN_ROLE);
        return IPermissionedResolver(
            factory.deployProxy(
                resolverImplementation,
                uint256(salt),
                abi.encodeCall(IPermissionedResolver.initialize, (grants, new bytes[](0)))
            )
        );
    }

    function _prepend(string memory label, bytes memory suffix) private pure returns (bytes memory) {
        return abi.encodePacked(uint8(bytes(label).length), bytes(label), suffix);
    }
}
