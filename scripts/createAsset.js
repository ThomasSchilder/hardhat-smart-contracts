/**
 * Example script to create a new asset using the AssetV1 contract.
 *
 */

const hre = require("hardhat");
const ASSET_TYPE = {
    "DATASET":0,
    "MODEL":1,
    "FUNCTION": 2,
    "VM": 3,
    "CLUSTER": 4
};
const PROTOCOL = {
    "HTTP": 0,
    "FTP": 1,
    "S3": 2
};

async function main() {

    if (!process.env.DEPLOYED_ASSETV1_CONTRACT) {
        console.error("Environment variable 'DEPLOYED_ASSETV1_CONTRACT' is not set");
        process.exit(1);
    }
    const contract = await ethers.getContractAt("AssetV1", process.env.DEPLOYED_ASSETV1_CONTRACT);

    let name = "local-cluster";
    let url = "http://localhost:8080";
    let protocol = PROTOCOL.HTTP;
    let type = ASSET_TYPE.CLUSTER
    let metadata = '{"description":"A local cluster to deploy scientific workflows using dvre-workflow-scheduler","type": "k3s", "version": "v1.35.5+k3s1"}';

    let tx = await contract.createAsset(name, url, protocol, type, metadata);


    let receipt = await tx.wait();

    const event = receipt.logs.find(log => log.fragment && log.fragment.name === "AssetCreated");
    const assetId = event.args.assetId;
    console.log("Created asset with ID:", assetId.toString());



    let assetName = await contract.getName(assetId);
    let assetUrl = await contract.getUrl(assetId);
    let assetProtocol = await contract.getProtocol(assetId);
    let assetType = await contract.getAssetType(assetId);
    let assetMetadata = await contract.getMetadata(assetId);
    let assetStatus = await contract.getStatus(assetId);
    let assetOwner = await contract.getOwner(assetId);

    console.log("Asset details:", {
        name: assetName,
        url: assetUrl,
        protocol: assetProtocol,
        type: assetType,
        metadata: assetMetadata,
        status: assetStatus,
        owner: assetOwner
    });

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

