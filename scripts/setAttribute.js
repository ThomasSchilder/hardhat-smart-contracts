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
  if (!process.env.ATTR_KEY) {
    console.error("Environment variable 'ATTR_KEY' is not set");
    process.exit(1);
  }
  if (!process.env.ATTR_VALUE) {
    console.error("Environment variable 'ATTR_VALUE' is not set");
    process.exit(1);
  }

  const [, amOwner] = await ethers.getSigners();
  const contract = await ethers.getContractAt("AMContract", process.env.DEPLOYED_AM_CONTRACT, amOwner);

  let tx = await contract.setAttribute(
    process.env.SUBJECT,
    process.env.ATTR_KEY,
    process.env.ATTR_VALUE
  );
  let receipt = await tx.wait();

  const event = receipt.logs.find(log => log.fragment && log.fragment.name === "AttributeSet");
  console.log("Attribute set:", {
    subject: event.args.subject,
    key: event.args.key,
    value: event.args.value
  });

  let value = await contract.getAttribute(process.env.SUBJECT, process.env.ATTR_KEY);
  console.log("Verified on-chain:", process.env.ATTR_KEY, "=", value);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
