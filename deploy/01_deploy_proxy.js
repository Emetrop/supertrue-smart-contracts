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
  const ForwardCreator = await ethers.getContractFactory("ForwardCreator");

  // deploying new proxy
  const proxy = await upgrades.deployProxy(ForwardCreator, { kind: "uups" });
  console.log("Super True Hub deployed to:", proxy.address);

  // // creating artist
  // // getting existing proxy
  // const proxy = await ForwardCreator.attach(
  //   "0x5933e81E1EbF73E07445E6FF480B6044453AE372"
  // );
  
  // // Creating artist
  // const artist = await proxy.createArtist("Kanye West", "kanyewest").then(trans => trans.wait());
  // console.log("Artist deployed to:", artist);

  // Verify your contracts with Etherscan
  // You don't want to verify on localhost
  if (chainId !== localChainId) {
    // wait for etherscan to be ready to verify
    console.log("Start code verification on etherscan");
    await sleep(15000);
    await run("verify:verify", {
      address: proxy.address,
      contract: "contracts/ForwardCreator.sol:ForwardCreator",
      contractArguments: [],
    });
    console.log("End code verification on etherscan");
  }
};
module.exports.tags = ["Forward", "ForwardCreator"];
