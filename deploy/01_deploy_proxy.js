// deploy/01_deploy_proxy.js

const { ethers, upgrades } = require("hardhat");

const localChainId = "31337";

const sleep = (ms) =>
  new Promise((r) =>
    setTimeout(() => {
      // console.log(`waited for ${(ms / 1000).toFixed(3)} seconds`);
      r();
    }, ms)
  );

module.exports = async ({ chainId }) => {
  const ConfigContract = await ethers.getContractFactory("Config");
  const configContract = await ConfigContract.deploy();
  await configContract.deployed();
  console.log("Config Deployed to:", configContract.address);

  const SuperTrueNFTContract = await ethers.getContractFactory("SuperTrueNFT");
  const superTrueNFTContract = await SuperTrueNFTContract.deploy();
  await superTrueNFTContract.deployed();
  console.log("SuperTrueNFT Deployed to:", configContract.address);

  const SuperTrueCreator = await ethers.getContractFactory("SuperTrueCreator");

  // deploying new proxy
  const proxy = await upgrades.deployProxy(SuperTrueCreator,
    [configContract.address, superTrueNFTContract.address],{
    // https://docs.openzeppelin.com/upgrades-plugins/1.x/api-hardhat-upgrades#common-options
    kind: "uups",
    timeout:120000
  });
  await proxy.deployed();
  console.log("Super True Hub deployed to:", proxy.address);

  //Set Config
  // proxy.setConfig(configContract.address);

  // Verify your contracts with Etherscan
  // You don't want to verify on localhost
  if (chainId !== localChainId) {
    // wait for etherscan to be ready to verify
    console.log("Start code verification on etherscan");
    await sleep(15000);
    //Verify Proxy
    await run("verify:verify", {
      address: proxy.address,
      contract: "contracts/SuperTrueCreator.sol:SuperTrueCreator",
      contractArguments: [configContract.address],
    });
    //Verify Config
    await run("verify:verify", {
      address: configContract.address,
      contract: "contracts/Config.sol:Config",
      contractArguments: [],
    });

    console.log("End code verification on etherscan");
  }

};
module.exports.tags = ["Supertrue", "SuperTrueCreator"];
