const hre = require("hardhat");

async function main() {
  if (!process.env.DEPLOYED_ADDRESS) {
    console.error("Environment variable 'DEPLOYED_ADDRESS' is not set");
    process.exit(1);
  }

  const contractName = process.env.CONTRACT_NAME || "AssetV1";
  const fromBlock = process.env.FROM_BLOCK ? parseInt(process.env.FROM_BLOCK) : 0;

  const contract = await ethers.getContractAt(contractName, process.env.DEPLOYED_ADDRESS);

  console.log(`Querying events for ${contractName} at ${process.env.DEPLOYED_ADDRESS}`);
  console.log(`From block: ${fromBlock}`);
  console.log("---");

  const latestBlock = await ethers.provider.getBlockNumber();
  const CHUNK_SIZE = 5000;
  const allEvents = [];

  for (let start = fromBlock; start <= latestBlock; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, latestBlock);
    const chunkEvents = await contract.queryFilter("*", start, end);
    allEvents.push(...chunkEvents);
  }

  if (allEvents.length === 0) {
    console.log("No events found.");
    return;
  }

  for (const event of allEvents) {
    const block = await event.getBlock();
    const eventName = event.fragment ? event.fragment.name : "Unknown";
    const args = event.args ? Object.entries(event.args)
      .filter(([k]) => !Number.isInteger(Number(k)))
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") : "none";

    console.log(`Block ${block.number} | ${eventName} | ${args}`);
    console.log(`  tx: ${event.transactionHash}`);
  }

  console.log("---");
  console.log(`Total events: ${allEvents.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
