const hre = require("hardhat");

async function main() {
  if (!process.env.DEPLOYED_AM_CONTRACT) {
    console.error("Environment variable 'DEPLOYED_AM_CONTRACT' is not set");
    process.exit(1);
  }

  const [, amOwner] = await hre.ethers.getSigners();
  const policy = await hre.ethers.deployContract("ResearcherPolicy", [process.env.DEPLOYED_AM_CONTRACT], { signer: amOwner });
  await policy.waitForDeployment();

  const address = await policy.getAddress();
  console.log("ResearcherPolicy deployed to:", address);
  console.log("Policy owner:", amOwner.address);
  console.log("\nSet in .env: DEPLOYED_RESEARCHER_POLICY_CONTRACT=" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
