const { ethers, upgrades } = require("hardhat");

// const localChainId = "31337";
const factoryAddress = "0x55544B6A8a3B4FaA22BB5303F3Ebb15ED0344d3F";

async function main() {
    const [deployer, admin] = await ethers.getSigners();

    //Log
    // console.log("Deployer account:", deployer.address);

    //Config
    const ConfigContract = await ethers.getContractFactory("Config");
    //Deploy
    const configContract = await ConfigContract.deploy();
    //Log
    console.log("Config Deployed to:", configContract.address);


    console.log("Update Factory Proxy:");

    //Fetch New Implementation Contract
    let NewImplementation = await ethers.getContractFactory("ForwardCreator");
    //Current Implementation
    // const OldImplementation = await ethers.getContractFactory("ForwardCreator");
          
    //Register Beacon
    // await upgrades.forceImport(factoryAddress, OldImplementation);
    //Validate Upgrade
    await upgrades.prepareUpgrade(factoryAddress, NewImplementation);

    //Upgrade    
    // await upgrades.upgradeProxy(factoryContract, NewImplementation);

    //Attach
    const newFactoryContract = await NewImplementation.attach(factoryContract.address);
    //Set Config
    newFactoryContract.setConfig(configContract.address);

    //Log
    console.log("ForwardCreator Contract Updated");
}
  
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
});