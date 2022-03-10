// const { ethers, upgrades } = require("hardhat");
/**
 * Forward Creator is actually ERC1967Proxy 
 */
async function main() {
    try{
        // Verify your contracts with Etherscan
        console.log("Start code verification on etherscan");
        await run("verify:verify", {
            address: "0x086c1a95773a1ec76f5d8c7350b5d220cbcc640a",
            contract: "contracts/ForwardCreator.sol:ForwardCreator",
            contractArguments: ["0x98B28D02AF16600790aAE38d8F587eA99585BBb2"],
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