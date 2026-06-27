const hre = require("hardhat");

async function main() {
  if (!process.env.DEPLOYED_AM_CONTRACT) {
    console.error("Environment variable 'DEPLOYED_AM_CONTRACT' is not set");
    process.exit(1);
  }
  if (!process.env.SUBJECT) {
    console.error("Environment variable 'SUBJECT' is not set");
    process.exit(1);
  }

  const contract = await ethers.getContractAt("AMContract", process.env.DEPLOYED_AM_CONTRACT);

  let result = await contract.getAttributeKeys(process.env.SUBJECT);
  console.log("getAttributeKeys(" + process.env.SUBJECT + ") =", result);

  for (const key of result) {
    let value = await contract.getAttribute(process.env.SUBJECT, key);
    console.log("getAttribute(" + process.env.SUBJECT + ", " + key + ") =", value);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
