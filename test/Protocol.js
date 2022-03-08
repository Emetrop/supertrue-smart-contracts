const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

const utils = ethers.utils;

use(solidity);

/**
 * TODO: Test fund transfer / minting payments
 */
describe("EntireProtocol", function () {
    const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
    const PRICE_BASE = '2000000000000000';
    const PRICE_INCREMENT = '100000000000000';        //TODO: Test Price Incemenets
    const BASE_URI = "https://us-central1-supertrue-5bc93.cloudfunctions.net/api/artist/"; //Default Base URI
    const ARTISTS = [
        {name: "name1", ig: "ig1",},
        {name: "name2", ig: "ig2",},
    ];
    let configContract;
    let factoryContract;
    let artistContracts = [];
    let owner;
    let admin;
    let tester;
    let addrs;

    // quick fix to let gas reporter fetch data from gas station & coinmarketcap
    // before((done) => { setTimeout(done, 2000); });

    describe("Config Contract", function () {

        before(async function () {
            //Deploy
            const ConfigContract = await ethers.getContractFactory("Config");
            configContract = await ConfigContract.deploy();
            //Populate Accounts
            [owner, admin, tester, ...addrs] = await ethers.getSigners();
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
                    configContract.connect(admin).setTreasury(admin.address)
                ).to.be.revertedWith("Ownable: caller is not the owner");

                await expect(
                    configContract.connect(admin).setTreasuryFee(1000)
                ).to.be.revertedWith("Ownable: caller is not the owner");

                await expect(
                    configContract.connect(admin).addAdmin(admin.address)
                ).to.be.revertedWith("Ownable: caller is not the owner");
                
                await expect(
                    configContract.connect(admin).removeAdmin(owner.address)
                ).to.be.revertedWith("Ownable: caller is not the owner");
            });

        });

        describe("Data", function () {

            it("should remeber admins", async function () {
                //Not Admin
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
                expect(treasuryData[0]).to.equal(ZERO_ADDR);
                expect(treasuryData[1]).to.equal(2000);
                //New Values
                let newTreasury = await ethers.getSigner(2);
                let newTreasuryAmount = 1000;
                //Set
                let tx = await configContract.setTreasury(newTreasury.address);
                await expect(tx).to.emit(configContract, 'TreasurySet').withArgs(newTreasury.address);
                
                tx = await configContract.setTreasuryFee(newTreasuryAmount);
                await expect(tx).to.emit(configContract, 'TreasuryFeeSet').withArgs(newTreasuryAmount);

                //Check
                treasuryData = await configContract.getTreasuryData();
                expect(treasuryData[0]).to.equal(newTreasury.address);
                expect(treasuryData[1]).to.equal(newTreasuryAmount);
            });
        });

    });

  before(async function () {

        //Deploy Factory
        const ForwardCreator = await ethers.getContractFactory("ForwardCreator");
        // deploying new proxy
        factoryContract = await upgrades.deployProxy(ForwardCreator, { kind: "uups" });
        console.log("Factory deployed to:", factoryContract.address);  

        //Mock Config
        const ConfigContract = await ethers.getContractFactory("Config");
        let mockConfigContract = await ConfigContract.deploy();
        await factoryContract.setConfig(mockConfigContract.address);

        //Populate Accounts
        // [owner, ...addrs] = await ethers.getSigners();
    })

    describe("Factory", function () {

        it("Should have Config", async function () {
            expect(await factoryContract.getConfig()).not.to.equal(ZERO_ADDR);    //Starts With Defaults
            // expect(await factoryContract.getConfig()).to.equal(ZERO_ADDR);     //Starts Empty
            // expect(await factoryContract.getConfig()).to.equal(configContract.address);
        });

        it("Should Secure Config", async function () {
            //Secure
            await expect(
                factoryContract.connect(tester).setConfig(configContract.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });    
        it("Should change Config", async function () {
            //Set Config
            await factoryContract.setConfig(configContract.address);
            //Check Config
            expect(await factoryContract.getConfig()).to.equal(configContract.address);
        });

        it("Should inherit Owner", async function () {
            expect(await factoryContract.owner()).to.equal(owner.address);
        });

        it("Should inherit Admin", async function () {
            //Set Admin
            await configContract.addAdmin(admin.address);
            //Check Admin
            expect(await factoryContract.isAdmin(admin.address)).to.equal(true);
        });

        it("Should fail to return data on inexistent artists", async function () {
            await expect(
                factoryContract.getArtistContract(1)
            ).to.be.revertedWith("Non-Existent Artist");
        });
        
        it("Should deploy child: ForwardNFT Contract", async function () {
            const artistName = ARTISTS[1].name; //"name2";
            const artistIG = ARTISTS[1].ig; //"ig2";

            //Deploy New Artist
            // await factoryContract.createArtist(artistName, artistIG);       //TODO: How to get the id & address from that??
            let tx = await factoryContract.createArtist(artistName, artistIG).then(trans => trans.wait());
            // console.log("[TEST] Deployed Artist Contract:"+T1.address, tx);
            // let dep = await tx.wait();
            // console.log("Deployed Artist Contract:", dep);

            //Fetch New Artist Contract Address
            const artistContractAddr = await factoryContract.getArtistContract(1);

            //Attach 
            const ForwardNFT = await ethers.getContractFactory("ForwardNFT");
            const newArtistContract = await ForwardNFT.attach(artistContractAddr);
            //Keep
            artistContracts.push(newArtistContract);

            
            // let t1 = await newArtistContract.owner();
            // console.log("Deployed Artist Contract to:"+artistContractAddr, newArtistContract, t1);
            // console.log("Deployed Artist Contract:", artistContracts[0]);
            // console.log("Deployed Artist Contract Addr", artistContracts[0].hash);
            
            // expect(artistContractAddr).to.equal(artistContracts[0].hash);
            
            expect(artistContractAddr).not.to.equal(ZERO_ADDR);
        });

        it("Should Not allow same artist to be deployed twice", async function () {
            const artistName = ARTISTS[1].name; //"name2";
            const artistIG = ARTISTS[1].ig; //"ig2";

            await expect(
                //Deploy New Artist
                factoryContract.createArtist(artistName, artistIG)
            ).to.be.revertedWith("SOME KIND OF ERROR");
            
        });

        it("Factory should be upgradable", async function () {
            //Fetch New Implementation Contract
            let NewImplementation = await ethers.getContractFactory("contracts/contracts-test/ForwardCreatorv2.sol:ForwardCreatorv2");
            await upgrades.upgradeProxy(factoryContract, NewImplementation);
        
            //Update Interface
            const newFactoryContract = await NewImplementation.attach(factoryContract.address);
            // console.log("Upgraded Facroty (Hub) at: "+ factoryContract.address, newFactoryContract);

            //Validate Upgrade
            let hasChanged = await newFactoryContract.hasChanged();
            //Verify Upgrade
            expect(hasChanged).to.equal(true);
        });

    });
    
    describe("Artist NFT", function () {
        let artistContract;

        before(async function () {
            artistContract = artistContracts[0];
        });
        
        it("Should inherit Owner", async function () {
            //Not Admin
            expect(await artistContract.owner()).to.equal(owner.address);
        });

        it("Should inherit Admin", async function () {
            //Set Admin
            await configContract.addAdmin(admin.address);
            //Check Admin
            expect(await artistContract.isAdmin(admin.address)).to.equal(true);
        });

        it("Should have price", async function () {
            let result = await artistContract.price();
            expect(result).to.equal(PRICE_BASE);
        });
        
        it("Should have Contract URI", async function () {
            let result = await artistContract.contractURI();
            expect(result).to.equal(BASE_URI + "1/storefront");
        });

        it("Can Change Contract URI", async function () {
            // let curBaseURI = await configContract.getBaseURI();
            let newBaseURI = "https://test-domain.com/api/";
            //Change
            await configContract.setBaseURI(newBaseURI);

            //Sleep
            // await new Promise(resolve => setTimeout(resolve, 2000));
            // let curArtistBaseURI = await artistContract.baseURI();
            // console.log("curArtistBaseURI", curArtistBaseURI);   //V
            //Check
            expect(await configContract.getBaseURI()).to.equal(newBaseURI);
            expect(await artistContract.contractURI()).to.equal(newBaseURI+"1/storefront");

            //Change Back
            await configContract.setBaseURI(BASE_URI);
            //Check
            expect(await configContract.getBaseURI()).to.equal(BASE_URI);
        });

        it("Can Override Contract URI", async function () {
            let newContractURI = "https://test-domain.com/NEW-ARTIST-JSON-URI/";
            //Change
            await artistContract.setContractURI(newContractURI);
            expect(await artistContract.contractURI()).to.equal(newContractURI);
            //Fail
            await expect(
                artistContract.connect(tester).setContractURI("NO")
            ).to.be.revertedWith("Only admin or artist");
            //Undo (By Admin)
            await artistContract.connect(admin).setContractURI("");
            expect(await artistContract.contractURI()).to.equal(BASE_URI + "1/storefront");
        });
        
        it("Beacon should be upgradable", async function () {
            //Current Implementation
            const OldImplementation = await ethers.getContractFactory("ForwardNFT");
            //New Implementation
            const NewImplementation = await ethers.getContractFactory("contracts/contracts-test/ForwardNFTv2.sol:ForwardNFTv2");
            // const NewImplementation = await ethers.getContractFactory("contracts/contracts-test/ForwardNFTv3.sol:ForwardNFTv3");
            let newImplementation = await NewImplementation.deploy();

            //-- Prep
            //Fetch Beacon
            let BeaconAddress = await factoryContract.beaconAddress();
            //Register Beacon
            await upgrades.forceImport(BeaconAddress, OldImplementation);
            //Validate Upgrade
            await upgrades.prepareUpgrade(BeaconAddress, NewImplementation);
                
            //Upgrade
            factoryContract.upgradeBeacon(newImplementation.address);

            //Update Interface
            const newArtistContract = await NewImplementation.attach(artistContract.address);
            // console.log("Upgraded Artist at: "+ artistContract.address, newArtistContract);

            //Validate Upgrade
            // let hasChanged = await artistContract.hasChanged();
            let hasChanged = await newArtistContract.hasChanged();

            //Verify Upgrade
            expect(hasChanged).to.equal(true);
        });

        describe("Tokens", function () {
            it("Should Mint NFTokens", async function () {
                let tx = await artistContract.mint(admin.address).then(trans => trans.wait());
                // console.log("minting", tx);
                //Fetch Token
                let result = await artistContract.ownerOf(1);
                expect(result).to.equal(admin.address);
            });
            it("Should Have Token URI", async function () {
                let tokenURI = BASE_URI + "1/json/1";
                let result = await artistContract.tokenURI(1);
                expect(result).to.equal(tokenURI);
            });
            it("Can Change Token URI", async function () {
                let newBaseURI = "https://test-domain.com/api/";
                //Change
                await configContract.setBaseURI(newBaseURI);
                //Check
                expect(await configContract.getBaseURI()).to.equal(newBaseURI);
                expect(await artistContract.tokenURI(1)).to.equal(newBaseURI+"1/json/1");
                //Change Back
                await configContract.setBaseURI(BASE_URI);
                //Check
                expect(await configContract.getBaseURI()).to.equal(BASE_URI);
            });
        });
    });
})

