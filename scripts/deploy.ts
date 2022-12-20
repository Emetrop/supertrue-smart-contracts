const { ethers, upgrades } = require("hardhat");

const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')

async function deployDiamond () {
  const accounts = await ethers.getSigners()
  const contractOwner = accounts[0]

  // deploy SupertrueNFT beacon
  const SupertrueNFTContract = await ethers.getContractFactory("SupertrueNFT");
  const supertrueNFTbeacon = await upgrades.deployBeacon(SupertrueNFTContract);
  await supertrueNFTbeacon.deployed();
  console.log("SupertrueNFT beacon deployed to:", supertrueNFTbeacon.address);

  // deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet')
  const diamondCutFacet = await DiamondCutFacet.deploy()
  await diamondCutFacet.deployed()
  console.log('DiamondCutFacet deployed:', diamondCutFacet.address)

  // deploy SupertrueDiamond
  const Diamond = await ethers.getContractFactory('SupertrueDiamond')
  const diamond = await Diamond.deploy(contractOwner.address, diamondCutFacet.address)
  await diamond.deployed()
  console.log('SupertrueDiamond deployed:', diamond.address)

  // deploy DiamondInit
  // DiamondInit provides a function that is called when the diamond is upgraded to initialize state variables
  // See https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
  const DiamondInit = await ethers.getContractFactory('DiamondInit')
  const diamondInit = await DiamondInit.deploy()
  await diamondInit.deployed()
  console.log('DiamondInit deployed:', diamondInit.address)

  // deploy facets
  console.log('')
  console.log('Deploying facets')

  // too many functions per 1 transaction so we split it into 2 transactions
  const facetNames1 = [
    'DiamondLoupeFacet',
    'SupertrueConfigFacet',
    // 'SupertrueHubFacet'
  ]

  let cut = []
  for (const facetName of facetNames1) {
    const Facet = await ethers.getContractFactory(facetName)
    const facet = await Facet.deploy()
    await facet.deployed()
    console.log(`${facetName} deployed: ${facet.address}`)
    cut.push({
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    })
  }

  // Removing mysterious contract, remove and get values
  cut = cut.map(c => ({...c, functionSelectors: c.functionSelectors.filter(f => typeof f === "string")}));

  // upgrade diamond with facets
  console.log('')
  console.log('Diamond Cut:', cut)
  const diamondCut = await ethers.getContractAt('IDiamondCut', diamond.address)

  // call to init function
  // const functionCall = diamondInit.interface.encodeFunctionData('init', [supertrueNFTbeacon.address])
  let tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, '0x') // empty init
  // const tx = await diamondCut.diamondCut(cut, diamondInit.address, functionCall)
  console.log('Diamond cut tx: ', tx.hash)
  let receipt = await tx.wait()

  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`)
  }

  console.log('First facet deployment round done')

  const facetNames2 = [
    // 'DiamondLoupeFacet',
    // 'SupertrueConfigFacet',
    'SupertrueHubFacet'
  ]

  cut = []
  for (const facetName of facetNames2) {
    const Facet = await ethers.getContractFactory(facetName)
    const facet = await Facet.deploy()
    await facet.deployed()
    console.log(`${facetName} deployed: ${facet.address}`)
    cut.push({
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    })
  }

  // Removing mysterious contract, remove and get values
  cut = cut.map(c => ({...c, functionSelectors: c.functionSelectors.filter(f => typeof f === "string")}));

  // call to init function
  const functionCall = diamondInit.interface.encodeFunctionData('init', [supertrueNFTbeacon.address])
  tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, '0x') // empty init
  // tx = await diamondCut.diamondCut(cut, diamondInit.address, functionCall)
  console.log('Diamond cut tx: ', tx.hash)
  receipt = await tx.wait()

  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`)
  }

  console.log('Second facet deployment round done')

  tx = await diamondCut.diamondCut([], diamondInit.address, functionCall)
  console.log('Diamond cut tx: ', tx.hash)
  receipt = await tx.wait()

  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`)
  }

  console.log('Completed!')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployDiamond()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

exports.deployDiamond = deployDiamond
