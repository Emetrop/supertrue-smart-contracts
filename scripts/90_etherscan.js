// const { ethers, upgrades } = require("hardhat");

async function main() {
    try{
        // Verify your contracts with Etherscan
        console.log("Start code verification on etherscan");
        await run("verify:verify", {
            address: "0x98b28d02af16600790aae38d8f587ea99585bbb2",
            contract: "contracts/Config.sol:Config",
            contractArguments: [],
        });
        console.log("End code verification on etherscan");
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