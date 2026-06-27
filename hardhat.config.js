require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
    ]
  },
  networks: {
    besu: {
      url: process.env.BESU_RPC_URL || "http://127.0.0.1:8545",
      chainId: 1811,
      accounts: [
        process.env.BESU_PRIVATE_KEY,
        process.env.BESU_AM_CONTRACT_OWNER_PRIVATE_KEY,
      ].filter(Boolean),
      gasPrice: 0,
    }
  }
};

module.exports = config;
