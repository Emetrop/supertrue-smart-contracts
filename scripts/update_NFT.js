const { ethers, upgrades } = require("hardhat");

// const localChainId = "31337";
const factoryAddress = "0x55544B6A8a3B4FaA22BB5303F3Ebb15ED0344d3F";

async function main() {
    const [deployer, admin] = await ethers.getSigners();

    //Log
    // console.log("Deployer account:", deployer.address);
    console.log("Update NFT Beacon:", deployer.address);

    //-- Factory
    const ForwardCreator = await ethers.getContractFactory("ForwardCreator");
    const factoryContract = await ForwardCreator.attach(factoryAddress);
    console.log("Attached to Factory @ ", factoryContract.address);  

    //Fetch Beacon Address
    let BeaconAddress = await factoryContract.beaconAddress();
     
    const OldImplementation = await ethers.getContractFactory("ForwardNFT");   //Current Implementation
    const NewImplementation = await ethers.getContractFactory("ForwardNFT");   //New Implementation
    
    //-- Prep
    //Register Beacon
    await upgrades.forceImport(BeaconAddress, OldImplementation);
    //Deploy New Implementation
    let newImplementation = await NewImplementation.deploy();
    //Validate Upgrade
    await upgrades.prepareUpgrade(BeaconAddress, NewImplementation);
        
    //Upgrade
    factoryContract.upgradeBeacon(newImplementation.address);

    //Log
    console.log("ForwardNFT Beacon Contract Updated");
}
  
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
});