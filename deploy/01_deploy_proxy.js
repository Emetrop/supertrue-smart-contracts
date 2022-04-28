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
  // const treasuryAddress = "0x0000000000000000000000000000000000000001"; // TODO change for deployment

  const ConfigContract = await ethers.getContractFactory("SupertrueConfig");
  const configContract = await ConfigContract.deploy(treasuryAddress);
  await configContract.deployed();
  console.log("SupertrueConfig deployed to:", configContract.address);

  const SupertrueNFTContract = await ethers.getContractFactory("SupertrueNFT");
  const supertrueNFTContract = await SupertrueNFTContract.deploy();
  await supertrueNFTContract.deployed();
  console.log("SupertrueNFT deployed to:", supertrueNFTContract.address);

  const SupertrueCreator = await ethers.getContractFactory("SupertrueCreator");

  // deploying new proxy
  const proxy = await upgrades.deployProxy(SupertrueCreator,
    [configContract.address, supertrueNFTContract.address],{
    // https://docs.openzeppelin.com/upgrades-plugins/1.x/api-hardhat-upgrades#common-options
    kind: "uups",
    timeout: 120000
  });
  await proxy.deployed();
  console.log("SupertrueCreator deployed to:", proxy.address);

  // Verify your contracts with Etherscan
  // You don't want to verify on localhost
  if (chainId !== localChainId) {
    // wait for etherscan to be ready to verify
    console.log("Start code verification on etherscan");
    await sleep(15000);
    // TODO fix verification for other contracts
    //Verify Proxy
    // await run("verify:verify", {
    //   address: proxy.address,
    //   contract: "contracts/SupertrueCreator.sol:SupertrueCreator",
    //   contractArguments: [configContract.address, supertrueNFTContract.address],
    // });
    //Verify Config
    await run("verify:verify", {
      address: configContract.address,
      contract: "contracts/SupertrueConfig.sol:SupertrueConfig",
      contractArguments: [treasuryAddress],
    });

    console.log("End code verification on etherscan");
  }
};

module.exports.tags = ["Supertrue", "SupertrueCreator"];
