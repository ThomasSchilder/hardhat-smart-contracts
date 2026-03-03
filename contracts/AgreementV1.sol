// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

/**
 * Author: ThomasSchilder
 *
 * This smart contract contains a small proof-of-concept for decentralized authentication.
 * The data stored in this contract is what I minimally need to test the login functionality.
 *
 * For now, I have implemented the allowed addresses as a list. In the future, the allowed addresses
 * will be included in an SLA, such that we can store the conditions under which researchers have access.
 */

contract Agreement {

    enum AssetType { DATASET, MODEL, FUNCTION, VM, CLUSTER }
    struct Asset {
        address owner;
        uint64 id;
        AssetType assetType;
        mapping(address => bool) users;
    }

    // Public state variables
    mapping(uint64 => Asset) public assets;
    uint64 public incrementalAssetId = 0;

    // Events
    event AssetCreated(uint64 indexed assetId, AssetType indexed assetType, address indexed owner);
    event UserAccessChanged(uint64 indexed assetId, address indexed userAddress, bool hasAccess);
    // Errors
    error InvalidUserAccessConfiguration(uint64 assetId, address[] users, bool[] access);
    error Unauthorized(uint64 assetId, address sender);

    function createAsset(AssetType assetType) external {
        incrementalAssetId++;

        Asset storage asset = assets[incrementalAssetId];
        asset.owner = msg.sender;
        asset.id = incrementalAssetId;
        asset.assetType = assetType;

        // Return assetId;
        emit AssetCreated(asset.id, asset.assetType, asset.owner);
    }

    function setUserAccess(uint64 assetId, address[] calldata users, bool[] calldata access) external {
        Asset storage asset = assets[assetId];
        if (msg.sender != asset.owner) revert Unauthorized(assetId, msg.sender);
        if (users.length != access.length) revert InvalidUserAccessConfiguration(assetId, users, access);

        for (uint i = 0; i < users.length; i++) {
            address user = users[i];
            bool hasAccess = access[i];
            asset.users[user] = hasAccess;

            emit UserAccessChanged(asset.id, user, hasAccess);
        }
    }
    /**
     * Getter functions
     */

    function getAssetType(uint64 assetId) external view returns (AssetType assetType)  {
        return assets[assetId].assetType;
    }

    function getAssetOwner(uint64 assetId) external view returns (address owner) {
        return assets[assetId].owner;
    }

    function userIsAllowed(uint64 assetId, address user) external view returns (bool hasAccess) {
        return assets[assetId].users[user];
    }
}