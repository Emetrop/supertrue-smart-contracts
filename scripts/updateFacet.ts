const { ethers } = require("hardhat");

const { getSelectors, FacetCutAction } = require("../deploy/libraries/diamond");

// const diamondAddress = "0x386a0a2CF2925552867e7B0d915cFE27a5E8E80E"; // rinkeby
// const facetName = "SupertrueHubFacet";
// const newMethods = ["getArtistsNumber"];

async function updateFacet() {
  const FacetContract = await ethers.getContractFactory(facetName);
  const facetContract = await FacetContract.deploy();
  await facetContract.deployed();

  console.log(`Facet deployed: ${facetContract.address}`)

  const cut = []
  cut.push({
    facetAddress: facetContract.address,
    action: FacetCutAction.Replace,
    functionSelectors: getSelectors(facetContract).remove(newMethods)
  });

  if (newMethods.length) {
    cut.push({
      facetAddress: facetContract.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facetContract).get(newMethods)
    });
  }

  // upgrade diamond with facets
  console.log('Diamond Cut:', cut)
  const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress)

  // call to init function
  const tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, '0x') // empty init
  console.log('Diamond cut tx: ', tx.hash)

  const receipt = await tx.wait()

  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`)
  }

  console.log('Completed diamond cut')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  updateFacet()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

exports.updateFacet = updateFacet
