const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

const utils = ethers.utils;
const addressZero = '0x0000000000000000000000000000000000000000';

use(solidity);

describe("Config Contract", function () {
    let configContract;
    let owner
    let addrs;

    before(async function () {
        //Deploy
        const ConfigContract = await ethers.getContractFactory("Config");
        configContract = await ConfigContract.deploy();
        //Addresses
        [owner, ...addrs] = await ethers.getSigners();

    })

    it("should be a SupertrueConfig", async function () {
        expect(await configContract.role()).to.equal("SupertrueConfig");
    });

    describe("Permissions", function () {
        it("should be owned by deployer", async function () {
            // const [owner] = await ethers.getSigners();
            expect(await configContract.owner()).to.equal(owner.address);
        });

        it("should prevent unauthorized access", async function () {
            await expect(
                configContract.connect(addrs[0]).setTreasury(addrs[0].address)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                configContract.connect(addrs[0]).setTreasuryFee(1000)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                configContract.connect(addrs[0]).addAdmin(addrs[0].address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
            
            await expect(
                configContract.connect(addrs[0]).removeAdmin(owner.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

    });

    describe("Data", function () {

        it("should remeber admins", async function () {
            //Not Admin
            const admin = await ethers.getSigner(1);
            expect(await configContract.isAdmin(admin.address)).to.equal(false);
            //Set Admin
            await configContract.addAdmin(admin.address);
            expect(await configContract.isAdmin(admin.address)).to.equal(true);
            //Remove Admin
            await configContract.removeAdmin(admin.address);
            expect(await configContract.isAdmin(admin.address)).to.equal(false);
        });
        
        it("should hold treasury data", async function () {
            //Defaults
            let treasuryData = await configContract.getTreasuryData();
            expect(treasuryData[0]).to.equal(addressZero);
            expect(treasuryData[1]).to.equal(2000);
            //New Values
            let newTreasury = await ethers.getSigner(2);
            let newTreasuryAmount = 1000;
            //Set
            await configContract.setTreasury(newTreasury.address);
            await configContract.setTreasuryFee(newTreasuryAmount);
            //Check
            treasuryData = await configContract.getTreasuryData();
            expect(treasuryData[0]).to.equal(newTreasury.address);
            expect(treasuryData[1]).to.equal(newTreasuryAmount);
        });
    });

});
