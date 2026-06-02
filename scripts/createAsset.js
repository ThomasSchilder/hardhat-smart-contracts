/**
 * Example script to create a new asset using the AssetV1 contract.
 *
 */

const hre = require("hardhat");

async function main() {

    if (!process.env.DEPLOYED_ADDRESS) {
        console.error("Environment variable 'DEPLOYED_ADDRESS' is not set");
        process.exit(1);
    }
    const contract = await ethers.getContractAt("AssetV1", process.env.DEPLOYED_ADDRESS);

    let name = "Hello world 4";
    let url = "https://docs.google.com/document/d/1iuGD04XCu3jvj2qJNcL_XnPjSm-Hoxxt/export?format=docx";
    let protocol = 0;
    let metadata = '{"description":"A fourth demo dataset for testing","format":"DOCX","size":"6KB"}'

    let tx = await contract.createAsset(name, url, protocol, protocol, metadata);


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

