const { ethers, upgrades } = require("hardhat");

/* eslint prefer-const: "off" */

async function deployNFTBeacon () {
  const SupertrueNFTContract = await ethers.getContractFactory("SupertrueNFT");

  // deploying new beacon
  const beacon = await upgrades.deployBeacon(SupertrueNFTContract);
  await beacon.deployed();
  console.log("SupertrueNFT beacon deployed to:", beacon.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployNFTBeacon()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

exports.deployNFTBeacon = deployNFTBeacon
