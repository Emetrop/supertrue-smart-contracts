const { ethers, upgrades } = require("hardhat");

// const localChainId = "31337";


async function main() {
    const [deployer, admin] = await ethers.getSigners();

    //Log
    console.log("Deployer account:", deployer.address);
  
    //Config
    const contract = await ethers.getContractFactory("Config");
    //Deploy
    const instance = await contract.deploy();

    //Set Configs
    // instance.setTreasury("ADDR");
    // instance.setTreasuryFee(1000)
    // instance.addAdmin(admin.address)

    //Log
    console.log("Super True Config deployed to:", instance.address);

    try{
        // Verify your contracts with Etherscan
        // if (chainId && chainId !== localChainId) {// not on localhost
            // wait for etherscan to be ready to verify
            console.log("Start code verification on etherscan");
            // await sleep(15000);
            await run("verify:verify", {
                address: instance.address,
                contract: "Config",
                contractArguments: [],
            });
            console.log("End code verification on etherscan");
        // }
    }
    catch(error){
        console.error("Faild Etherscan Verification", error);
    }

}
  
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
});