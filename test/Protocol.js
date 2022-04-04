const { ethers, waffle } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");
const { signTypedData, SignTypedDataVersion } = require('@metamask/eth-sig-util');

const utils = ethers.utils;

use(solidity);

/**
 * TODO: Test fund transfer / minting payments
 * TODO: Test Tips (with mint)
 * TODO: Test Donations (send without mint)
 */
describe("EntireProtocol", function () {
    const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
    const PRICE_BASE = '2000000000000000';
    const PRICE_INCREMENT = '100000000000000'; //TODO: Test Price Incemenets
    const CREATION_FEE = 2000000000000000;
    const BASE_URI = "https://us-central1-supertrue-5bc93.cloudfunctions.net/api/artist/"; //Default Base URI
    const ARTISTS = [
        {name: "name1", ig: "ig_name1", guid:'ig:id1'},
        {name: "name2", ig: "ig_name2", guid:'ig:id2'},
    ];
    let configContract;
    let factoryContract;
    let artistContract;
    let artistContracts = [];
    let owner;
    let admin;
    let tester;
    let treasury;

    // ************* signatures
    const types = {
        EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
        ],
        Message: [
            { name: 'signer', type: 'uint256' },
            { name: 'account', type: 'address' },
            { name: 'instagram', type: 'string' },
            { name: 'artistId', type: 'uint256' },
        ]
    };
    const signer1 = "0x8eC13C4982a5Fb8b914F0927C358E14f8d657133";
    const signer2 = "0xb9fAfb1De9083eAa09Fd7D058784a0316a2960B1";
    const signer1PrivateKey = Buffer.from(
      'e3126708c26c5312d95395c6fb53329166484e57375b0493e3713b0cccfdf792',
      'hex',
    );
    const signer2PrivateKey = Buffer.from(
      '8b38a7dfbdfd6d05f27ec2223d91f8a30026a4f1add7507a296a5cc177513733',
      'hex',
    );

    beforeEach(async function () {
        [owner, admin, tester, treasury] = await ethers.getSigners();

        //Config
        const ConfigContract = await ethers.getContractFactory("Config");
        configContract = await ConfigContract.deploy(treasury.address);

        //Deploy Factory
        const SuperTrueCreator = await ethers.getContractFactory("SuperTrueCreator");
        const SuperTrueNFTImplementation = await ethers.getContractFactory("SuperTrueNFT");
        const superTrueNFTImplementation = await SuperTrueNFTImplementation.deploy();

        //Deploying new proxy
        factoryContract = await upgrades.deployProxy(SuperTrueCreator, [configContract.address, superTrueNFTImplementation.address], { kind: "uups" });

        const price = await factoryContract.getCreationPrice();

        //Deploy New Artist
        let tx = await factoryContract.createArtist(ARTISTS[0].name, ARTISTS[0].ig, ARTISTS[0].guid, { value: price });
        await tx.wait();

        //Fetch New Artist Contract Address
        const artistContractAddr = await factoryContract.getArtistContract(1);

        //Attach
        const SuperTrueNFT = await ethers.getContractFactory("SuperTrueNFT");
        artistContract = await SuperTrueNFT.attach(artistContractAddr);
    })

    describe("Config Contract", function () {
        it("should be a SuperTrueConfig", async function () {
            expect(await configContract.role()).to.equal("SuperTrueConfig");
        });

        describe("Permissions", function () {
            it("should be owned by deployer", async function () {
                expect(await configContract.owner()).to.equal(owner.address);
            });

            it("should be pausable", async function () {
                expect(await configContract.paused()).to.equal(false);
                //Pause
                await configContract.pause();
                expect(await configContract.paused()).to.equal(true);
                //Unpause
                await configContract.unpause();
                expect(await configContract.paused()).to.equal(false);
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

            it("should change creation fee", async function () {
                expect(await configContract.getCreationFee()).to.equal(CREATION_FEE);

                const newCreationFee = 999;

                const tx = await configContract.connect(owner).setCreationFee(newCreationFee);
                await expect(tx).to.emit(configContract, 'CreationFeeSet').withArgs(newCreationFee);

                expect(await configContract.getCreationFee()).to.equal(newCreationFee);
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
                expect(treasuryData[0]).to.equal(treasury.address);
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
                factoryContract.getArtistContract(99)
            ).to.be.revertedWith("Non-Existent Artist");
        });

        it("Should fail to deploy child: SuperTrueNFT Contract without value", async function () {
            await expect(
              factoryContract.createArtist("artistName", "artistIG", "artistGUID")
            ).to.be.revertedWith("Insufficient Payment'");
        })

        it("Should deploy child: SuperTrueNFT Contract", async function () {
            const artistName = ARTISTS[1].name; //"name2";
            const artistIG = ARTISTS[1].ig; //"ig2";
            const artistGUID = ARTISTS[1].guid;
            const price = await factoryContract.getCreationPrice();

            //Deploy New Artist
            //TODO: How to get the id & address from that??
            let tx = await factoryContract.createArtist(artistName, artistIG, artistGUID, { value: price });

            await expect(tx).to.emit(factoryContract, 'ArtistCreated');

            await tx.wait();

            // console.log("[TEST] Deployed Artist Contract:"+T1.address, tx);
            // let dep = await tx.wait();
            // console.log("Deployed Artist Contract:", dep);

            //Fetch New Artist Contract Address
            const artistContractAddr = await factoryContract.getArtistContract(1);

            // let t1 = await newArtistContract.owner();
            // console.log("Deployed Artist Contract to:"+artistContractAddr, newArtistContract, t1);
            // console.log("Deployed Artist Contract:", artistContracts[0]);
            // console.log("Deployed Artist Contract Addr", artistContracts[0].hash);

            // expect(artistContractAddr).to.equal(artistContracts[0].hash);

            expect(artistContractAddr).not.to.equal(ZERO_ADDR);
        });

        it("Should Not allow same guid artist to be deployed twice", async function () {
            const price = await factoryContract.getCreationPrice();

            await expect(
                factoryContract.createArtist(ARTISTS[1].name, ARTISTS[1].ig, ARTISTS[0].guid, { value: price })
            ).to.be.revertedWith("GUID already used");
        });

        it("Factory should be upgradable", async function () {
            //Fetch New Implementation Contract
            let NewImplementation = await ethers.getContractFactory("contracts/contracts-test/SuperTrueCreatorv2.sol:SuperTrueCreatorv2");
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
        it("Should inherit Owner", async function () {
            //Not Admin
            expect(await artistContract.owner()).to.equal(owner.address);
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
            ).to.be.revertedWith("Only owner");
            //Undo
            await artistContract.setContractURI(BASE_URI);
            expect(await artistContract.contractURI()).to.equal(BASE_URI);
        });

        it("Could be pausable", async function () {
            expect(await artistContract.paused()).to.equal(false);
            //Pause
            await artistContract.pause();
            expect(await artistContract.paused()).to.equal(true);
            //Should fail to mint
            await expect(
                artistContract.mint(tester.address)
            ).to.be.revertedWith("Pausable: paused");
            //Unpause
            await artistContract.unpause();
            expect(await artistContract.paused()).to.equal(false);
        });

        it("Could be blocked", async function () {
            //Block
            let tx = await artistContract.blockContract(true);
            await expect(tx).to.emit(artistContract, 'Blocked');
            //Should fail to mint
            await expect(
                artistContract.mint(tester.address)
            ).to.be.revertedWith("Pausable: paused");
            //Unblock
            tx = await artistContract.blockContract(false);
            await expect(tx).to.emit(artistContract, 'Blocked');
        });

        it("Should obey protocol pause", async function () {
            //Pause
            await configContract.pause();
            expect(await artistContract.paused()).to.equal(true);
            //Should fail to mint
            await expect(
                artistContract.mint(tester.address)
            ).to.be.revertedWith("Pausable: paused");
            //Unpause
            await configContract.unpause();
            expect(await artistContract.paused()).to.equal(false);
        });

        it("Beacon should be upgradable", async function () {
            //Current Implementation
            const OldImplementation = await ethers.getContractFactory("SuperTrueNFT");
            //New Implementation
            const NewImplementation = await ethers.getContractFactory("contracts/contracts-test/SuperTrueNFTv2.sol:SuperTrueNFTv2");
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
            it("Should Fail To Mint NFT Without Value", async function () {
                await expect(
                  artistContract.mint(admin.address)
                ).to.be.revertedWith("Insufficient Payment");
            });

            it("Should Mint NFTokens", async function () {
                const price = await artistContract.price();

                let tx = await artistContract.mint(admin.address, { value: price });
                await tx.wait();

                //Fetch Token
                let result = await artistContract.ownerOf(1);
                expect(result).to.equal(admin.address);
            });
            it("Should Have Token URI", async function () {
                const price = await artistContract.price();

                let tx = await artistContract.mint(admin.address, { value: price });
                await tx.wait();

                let tokenURI = BASE_URI + "1/json/1";
                let result = await artistContract.tokenURI(1);
                expect(result).to.equal(tokenURI);
            });
            it("Can Change Token URI", async function () {
                const price = await artistContract.price();

                let tx = await artistContract.mint(admin.address, { value: price });
                await tx.wait();

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

        describe("Claim", function () {
            before(async function () {
                await configContract.setSigners(signer1, signer2);
            });

            it("Signers are correctly set up", async function () {
                expect(await configContract.signer1()).to.equal(signer1);
                expect(await configContract.signer2()).to.equal(signer2);
            });

            it("Should get correct signer address", async function () {
                const artist = await artistContract.artist();

                const typedData = {
                    types,
                    primaryType: "Message",
                    domain: {
                        name: "SuperTrue",
                        version: "1",
                        chainId: 31337,
                        verifyingContract: artistContract.address
                    },
                    message: {
                        signer: 1,
                        account: owner.address,
                        instagram: artist.instagram,
                        artistId: 1
                    }
                };

                const signature = signTypedData({privateKey: signer1PrivateKey, data: typedData, version: SignTypedDataVersion.V4});

                expect(await artistContract.getSigner(signature, 1)).to.equal(signer1);
            });

            it("Should claim account", async function () {
                const artist = await artistContract.artist();
                const artistAccount = owner.address;

                const typedData1 = {
                    types,
                    primaryType: "Message",
                    domain: {
                        name: "SuperTrue",
                        version: "1",
                        chainId: 31337,
                        verifyingContract: artistContract.address
                    },
                    message: {
                        signer: 1,
                        account: artistAccount,
                        instagram: artist.instagram,
                        artistId: Number(artist.id)
                    }
                };

                const typedData2 = {
                    types,
                    primaryType: "Message",
                    domain: {
                        name: "SuperTrue",
                        version: "1",
                        chainId: 31337,
                        verifyingContract: artistContract.address
                    },
                    message: {
                        signer: 2,
                        account: artistAccount,
                        instagram: artist.instagram,
                        artistId: Number(artist.id)
                    }
                };

                const signature1 = signTypedData({privateKey: signer1PrivateKey, data: typedData1, version: SignTypedDataVersion.V4});
                const signature2 = signTypedData({privateKey: signer2PrivateKey, data: typedData2, version: SignTypedDataVersion.V4});

                const tx = await artistContract.claim(signature1, signature2);

                await expect(tx).to.emit(artistContract, 'ArtistClaimed').withArgs(artistAccount);
                expect((await artistContract.artist()).account).to.equal(artistAccount);
            });
        });

        describe("Payments", function () {
            it("should increase artist pending funds after mint", async function () {
                const startBalance = 0;

                expect(await artistContract.artistPendingFunds()).to.equal(startBalance);

                const price = await artistContract.price();
                let tx = await artistContract.mint(tester.address, { value: price });
                await tx.wait();

                const addedBalance = price * 0.8; // 80% for artist

                expect(await artistContract.artistPendingFunds()).to.equal(startBalance + addedBalance);
            });

            it("should increase treasury pending funds after mint", async function () {
                const startBalance = 0;

                expect(await artistContract.treasuryPendingFunds()).to.equal(startBalance);

                const price = await artistContract.price();
                let tx = await artistContract.mint(tester.address, { value: price });
                await tx.wait();

                const addedBalance = price * 0.2; // 20% for treasury

                expect(await artistContract.treasuryPendingFunds()).to.equal(startBalance + addedBalance);
            });

            it("Should treasury pending funds equals to 0 after withdraw", async function () {
                const price = await artistContract.price();
                let tx = await artistContract.mint(tester.address, { value: price });
                await tx.wait();

                tx = await artistContract.withdrawTreasury();
                await tx.wait();

                expect(await artistContract.treasuryPendingFunds()).to.equal(0);
            });

            it("Should fail when try to do treasury withdraw with no pending treasury funds", async function () {
                await expect(artistContract.withdrawTreasury()).to.be.revertedWith("No Pending Funds");
            });

            it("Should fail when try to do artist withdraw without claimed account", async function () {
                const price = await artistContract.price();
                let tx = await artistContract.mint(tester.address, { value: price });
                await tx.wait();

                await expect(artistContract.withdrawArtist()).to.be.revertedWith("Artist Account Not Set");
            });

            const claimAccount = async () => {
                const artist = await artistContract.artist();
                const artistAccount = owner.address;

                const typedData1 = {
                    types,
                    primaryType: "Message",
                    domain: {
                        name: "SuperTrue",
                        version: "1",
                        chainId: 31337,
                        verifyingContract: artistContract.address
                    },
                    message: {
                        signer: 1,
                        account: artistAccount,
                        instagram: artist.instagram,
                        artistId: Number(artist.id)
                    }
                };

                const typedData2 = {
                    types,
                    primaryType: "Message",
                    domain: {
                        name: "SuperTrue",
                        version: "1",
                        chainId: 31337,
                        verifyingContract: artistContract.address
                    },
                    message: {
                        signer: 2,
                        account: artistAccount,
                        instagram: artist.instagram,
                        artistId: Number(artist.id)
                    }
                };

                const signature1 = signTypedData({privateKey: signer1PrivateKey, data: typedData1, version: SignTypedDataVersion.V4});
                const signature2 = signTypedData({privateKey: signer2PrivateKey, data: typedData2, version: SignTypedDataVersion.V4});

                const tx = await artistContract.claim(signature1, signature2);
                await tx.wait();
            }

            it("Should artist pending funds equals to 0 after withdraw", async function () {
                const price = await artistContract.price();
                let tx = await artistContract.mint(tester.address, { value: price });
                await tx.wait();

                await claimAccount();

                tx = await artistContract.withdrawArtist();
                await tx.wait();

                expect(await artistContract.artistPendingFunds()).to.equal(0);
            });

            it("Should receive native currency via transfer", async function () {
                const tx = await tester.sendTransaction({
                    to: artistContract.address,
                    value: 888,
                });

                await tx.wait();

                expect(await waffle.provider.getBalance(artistContract.address)).to.equal(888);
            });

            it("Should increase pending funds after transfer", async function () {
                const tx = await tester.sendTransaction({
                    to: artistContract.address,
                    value: 100,
                });

                await tx.wait();

                expect(await artistContract.artistPendingFunds()).to.equal(80);
                expect(await artistContract.treasuryPendingFunds()).to.equal(20);
            });
        });
    });
})

