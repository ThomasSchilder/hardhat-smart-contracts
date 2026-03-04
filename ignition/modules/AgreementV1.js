const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const AgreementV1Module = buildModule("AgreementV1Module", (m) => {
  const agreement = m.contract("Agreement");

  return { agreement };
});

module.exports = AgreementV1Module;