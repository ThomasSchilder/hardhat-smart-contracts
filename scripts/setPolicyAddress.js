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
  if (!process.env.DEPLOYED_RESEARCHER_POLICY_CONTRACT) {
    console.error("Environment variable 'DEPLOYED_RESEARCHER_POLICY_CONTRACT' is not set");
    process.exit(1);
  }

  // const contract = await ethers.getContractAt("AssetV1", process.env.DEPLOYED_ASSETV1_CONTRACT);
  const signers = await ethers.getSigners();
  const contract = await ethers.getContractAt("AssetV1", process.env.DEPLOYED_ASSETV1_CONTRACT, signers[1]);

  let tx = await contract.setPolicyAddress(process.env.ASSET_ID, process.env.DEPLOYED_RESEARCHER_POLICY_CONTRACT);
  let receipt = await tx.wait();

  const event = receipt.logs.find(log => log.fragment && log.fragment.name === "AssetPolicySet");
  console.log("Policy set:", {
    assetId: event.args.assetId.toString(),
    policyAddress: event.args.policyAddress
  });

  let policyAddr = await contract.getPolicyAddress(process.env.ASSET_ID);
  console.log("Verified on-chain: policyAddress =", policyAddr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
