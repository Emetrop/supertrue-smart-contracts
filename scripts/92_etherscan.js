// const { ethers, upgrades } = require("hardhat");
/**
 * Forward Creator is actually ERC1967Proxy 
 */
 async function main() {
    try{
        // Verify your contracts with Etherscan
        console.log("Start code verification on etherscan");
        await run("verify:verify", {
            address: "0x570f9C6D48De0E9366072CaF963f8CBCD68d83ed",
            contract: "contracts/ForwardNFT.sol:ForwardNFT",
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