// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// ABI subset of ENSv2 commit 71a3b7339dbc55ab47667abdfe8303bac4f4c24e.
struct ENSGrant {
    address account;
    uint256 roleBitmap;
}

interface IVerifiableFactory {
    function deployProxy(address implementation, uint256 salt, bytes calldata data) external returns (address);
}

interface IUserRegistry {
    function initialize(ENSGrant[] calldata grants) external;
    function register(
        string calldata label,
        address owner,
        address registry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256);
}

interface IPermissionedResolver {
    function initialize(ENSGrant[] calldata grants, bytes[] calldata calls) external;
    function setText(bytes calldata name, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
    function grantSetterRoles(bytes calldata setter, address account) external returns (bool);
    function revokeRoles(uint256 resource, uint256 roleBitmap, address account) external returns (bool);
}
