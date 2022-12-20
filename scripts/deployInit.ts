const { ethers } = require("hardhat");

const diamondAddress = "" // required
const params = [
  // add init params here
];

async function deployInit() {
  // deploy DiamondInit
  const DiamondInit = await ethers.getContractFactory('DiamondInit')
  const diamondInit = await DiamondInit.deploy()
  await diamondInit.deployed()
  console.log('DiamondInit deployed:', diamondInit.address)

  const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress)

  // call to init function
  const functionCall = diamondInit.interface.encodeFunctionData('init', params.length ? params : '0x')
  const tx = await diamondCut.diamondCut([], diamondInit.address, functionCall)
  console.log('Diamond cut tx: ', tx.hash)
  const receipt = await tx.wait()

  if (!receipt.status) {
    throw Error(`Diamond init failed: ${tx.hash}`)
  }
  console.log('Diamond init completed')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployInit()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

exports.deployInit = deployInit
