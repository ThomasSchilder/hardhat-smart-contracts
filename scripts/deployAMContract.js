const hre = require("hardhat");

async function main() {
  if (!process.env.BESU_AM_CONTRACT_OWNER_PRIVATE_KEY) {
    console.error("Environment variable 'BESU_AM_CONTRACT_OWNER_PRIVATE_KEY' is not set");
    process.exit(1);
  }

  const [deployer, amOwner] = await hre.ethers.getSigners();
  const signer = amOwner || deployer;

  const amContract = await hre.ethers.deployContract("AMContract", [], { signer });
  await amContract.waitForDeployment();

  const address = await amContract.getAddress();
  console.log("AMContract deployed to:", address);
  console.log("Issuer (AMContract owner):", signer.address);
  console.log("\nSet in .env: DEPLOYED_AM_CONTRACT=" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
