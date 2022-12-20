const { ethers, upgrades } = require("hardhat");

// const beaconAddress = "0x1A237Ec9006AfBF7A4Fd0CC142fD186ef2917B8A"; // rinkeby

async function upgradeNFT() {
  // deploy LibPricing
  const LibPricingContract = await ethers.getContractFactory("LibPricing");
  const libPricingContract = await LibPricingContract.deploy();
  await libPricingContract.deployed();

  const SupertrueNFTContract = await ethers.getContractFactory("SupertrueNFT", {
    libraries: { LibPricing: libPricingContract.address }
  });

  await upgrades.upgradeBeacon(beaconAddress, SupertrueNFTContract, { unsafeAllowLinkedLibraries: true });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  upgradeNFT()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

exports.upgradeNFT = upgradeNFT
