const hre = require("hardhat");

async function main() {
  if (!process.env.DEPLOYED_ASSETV1_CONTRACT) {
    console.error("Environment variable 'DEPLOYED_ASSETV1_CONTRACT' is not set");
    process.exit(1);
  }
  if (!process.env.ASSET_ID) {
    console.error("Environment variable 'ASSET_ID' is not set");
    process.exit(1);
  }

  const contract = await ethers.getContractAt("AssetV1", process.env.DEPLOYED_ASSETV1_CONTRACT);

  let result = await contract.getPolicyAddress(process.env.ASSET_ID);
  console.log("getPolicyAddress(" + process.env.ASSET_ID + ") =", result);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
