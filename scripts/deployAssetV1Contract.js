const hre = require("hardhat");

async function main() {
  const AssetV1 = await hre.ethers.deployContract("AssetV1");
  await AssetV1.waitForDeployment();

  const address = await AssetV1.getAddress();
  console.log("AssetV1 deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
