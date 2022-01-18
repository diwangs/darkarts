const DummyGreeter = artifacts.require("DummyGreeter");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(DummyGreeter);
};
