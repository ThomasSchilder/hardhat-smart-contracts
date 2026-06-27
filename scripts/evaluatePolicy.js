const hre = require("hardhat");

async function main() {
  if (!process.env.DEPLOYED_RESEARCHER_POLICY_CONTRACT) {
    console.error("Environment variable 'DEPLOYED_RESEARCHER_POLICY_CONTRACT' is not set");
    process.exit(1);
  }
  if (!process.env.SUBJECT) {
    console.error("Environment variable 'SUBJECT' is not set");
    process.exit(1);
  }

  const contract = await ethers.getContractAt("ResearcherPolicy", process.env.DEPLOYED_RESEARCHER_POLICY_CONTRACT);

  let result = await contract.evaluate(process.env.SUBJECT);
  console.log("evaluate(" + process.env.SUBJECT + ") =", result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
