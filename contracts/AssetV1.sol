// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

/**
 * Author: ThomasSchilder
 *
 * This smart contract manages decentralized assets.
 * Assets have a name, URL, protocol, type, and status.
 * Assets can be created, updated, and archived.
 *
 * In this version, access management is implemented via policyAddress linking.
 * Each asset can reference a policy contract (SmartPolicy). address(0) = public asset.
 */

contract AssetV1 {

    enum AssetType { DATASET, MODEL, FUNCTION, VM, CLUSTER }
    enum AssetStatus { AVAILABLE, ARCHIVED }
    enum Protocol { HTTP, FTP, S3 }

    struct Asset {
        address owner;
        uint64 id;
        string name;
        AssetType assetType;
        AssetStatus status;
        string url;
        Protocol protocol;
        string metadata;
        address policyAddress;
    }

    mapping(uint64 => Asset) public assets;
    uint64 public incrementalAssetId = 0;

    event AssetCreated(uint64 indexed assetId, AssetType indexed assetType, address indexed owner, string name, string url, Protocol protocol, string metadata);
    event AssetUpdated(uint64 indexed assetId);
    event AssetStatusChanged(uint64 indexed assetId, AssetStatus status);
    event AssetArchived(uint64 indexed assetId);
    event AssetPolicySet(uint64 indexed assetId, address indexed policyAddress);

    error AssetNotFound(uint64 assetId);
    error Unauthorized(uint64 assetId, address sender);
    error AssetArchivedError(uint64 assetId);

    modifier onlyOwner(uint64 assetId) {
        if (assets[assetId].owner == address(0)) revert AssetNotFound(assetId);
        if (msg.sender != assets[assetId].owner) revert Unauthorized(assetId, msg.sender);
        _;
    }

    modifier notArchived(uint64 assetId) {
        if (assets[assetId].status == AssetStatus.ARCHIVED) revert AssetArchivedError(assetId);
        _;
    }

    function createAsset(string calldata name, string calldata url, Protocol protocol, AssetType assetType, string calldata metadata) external {
        incrementalAssetId++;

        Asset storage asset = assets[incrementalAssetId];
        asset.owner = msg.sender;
        asset.id = incrementalAssetId;
        asset.name = name;
        asset.assetType = assetType;
        asset.status = AssetStatus.AVAILABLE;
        asset.url = url;
        asset.protocol = protocol;
        asset.metadata = metadata;

        emit AssetCreated(asset.id, asset.assetType, asset.owner, name, url, protocol, metadata);
    }

    function updateAsset(uint64 assetId, string calldata name, string calldata url, Protocol protocol, string calldata metadata) external onlyOwner(assetId) notArchived(assetId) {
        Asset storage asset = assets[assetId];
        asset.name = name;
        asset.url = url;
        asset.protocol = protocol;
        asset.metadata = metadata;

        emit AssetUpdated(assetId);
    }

    function setName(uint64 assetId, string calldata name) external onlyOwner(assetId) notArchived(assetId) {
        assets[assetId].name = name;
        emit AssetUpdated(assetId);
    }

    function setUrl(uint64 assetId, string calldata url) external onlyOwner(assetId) notArchived(assetId) {
        assets[assetId].url = url;
        emit AssetUpdated(assetId);
    }

    function setProtocol(uint64 assetId, Protocol protocol) external onlyOwner(assetId) notArchived(assetId) {
        assets[assetId].protocol = protocol;
        emit AssetUpdated(assetId);
    }

    function setMetadata(uint64 assetId, string calldata metadata) external onlyOwner(assetId) notArchived(assetId) {
        assets[assetId].metadata = metadata;
        emit AssetUpdated(assetId);
    }

    function changeStatus(uint64 assetId, AssetStatus status) external onlyOwner(assetId) notArchived(assetId) {
        assets[assetId].status = status;
        emit AssetStatusChanged(assetId, status);
    }

    function archiveAsset(uint64 assetId) external onlyOwner(assetId) notArchived(assetId) {
        assets[assetId].status = AssetStatus.ARCHIVED;
        emit AssetArchived(assetId);
        emit AssetStatusChanged(assetId, AssetStatus.ARCHIVED);
    }

    function getName(uint64 assetId) external view returns (string memory) {
        return assets[assetId].name;
    }

    function getUrl(uint64 assetId) external view returns (string memory) {
        return assets[assetId].url;
    }

    function getProtocol(uint64 assetId) external view returns (Protocol) {
        return assets[assetId].protocol;
    }

    function getAssetType(uint64 assetId) external view returns (AssetType) {
        return assets[assetId].assetType;
    }

    function getOwner(uint64 assetId) external view returns (address) {
        return assets[assetId].owner;
    }

    function getStatus(uint64 assetId) external view returns (AssetStatus) {
        return assets[assetId].status;
    }

    function getMetadata(uint64 assetId) external view returns (string memory) {
        return assets[assetId].metadata;
    }

    function setPolicyAddress(uint64 assetId, address _policyAddress) external onlyOwner(assetId) notArchived(assetId) {
        assets[assetId].policyAddress = _policyAddress;
        emit AssetPolicySet(assetId, _policyAddress);
    }

    function getPolicyAddress(uint64 assetId) external view returns (address) {
        return assets[assetId].policyAddress;
    }
}
