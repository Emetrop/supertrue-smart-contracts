import { ethers, waffle, upgrades } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { signTypedData, SignTypedDataVersion } from "@metamask/eth-sig-util";

// @ts-ignore
import { getSelectors, FacetCutAction } from "../scripts/libraries/diamond";

import {
  SupertrueHubFacet,
  SupertrueConfigFacet,
  SupertrueDiamond,
  SupertrueNFT,
  LibPricing,
  DiamondCutFacet,
  BeaconProxy,
} from "../typechain-types";

describe("EntireProtocol", () => {
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  const PRICE_BASE = "10000000000000000";
  const CREATION_FEE = 2000000000000000;
  const BASE_URI = "https://example.com/api/artist/"; // Default Base URI
  const ARTISTS = [
    { name: "name1", username: "username1", ig: "ig_name1", igId: "1" },
    { name: "name2", username: "username2", ig: "ig_name2", igId: "2" },
  ];

  // contracts
  let configContract: SupertrueConfigFacet;
  let factoryContract: SupertrueHubFacet;
  let artistContract: SupertrueNFT;
  let diamondContract: SupertrueDiamond;
  let libPricingContract: LibPricing;

  // accounts
  let owner: SignerWithAddress;
  let artist: SignerWithAddress;
  let admin: SignerWithAddress;
  let tester: SignerWithAddress;
  let relay: SignerWithAddress;
  let treasury: SignerWithAddress;

  // ************* signatures
  const signer1 = "0x8eC13C4982a5Fb8b914F0927C358E14f8d657133";
  const signer2 = "0xb9fAfb1De9083eAa09Fd7D058784a0316a2960B1";
  const signer1PrivateKey = Buffer.from(
    "e3126708c26c5312d95395c6fb53329166484e57375b0493e3713b0cccfdf792",
    "hex"
  );
  const signer2PrivateKey = Buffer.from(
    "8b38a7dfbdfd6d05f27ec2223d91f8a30026a4f1add7507a296a5cc177513733",
    "hex"
  );

  const getArtistUpdateSignedMessage = ({
    signer,
    account,
    instagramId,
    instagram,
  }: {
    signer: number;
    account: string;
    instagramId: string;
    instagram: string;
  }) => {
    const types = {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      Message: [
        { name: "signer", type: "uint256" },
        { name: "account", type: "address" },
        { name: "instagramId", type: "string" },
        { name: "instagram", type: "string" },
      ],
    };

    const data = {
      types,
      primaryType: "Message",
      domain: {
        name: "Supertrue",
        version: "1",
        chainId: 31337,
        verifyingContract: factoryContract.address,
      },
      message: {
        signer,
        account,
        instagramId,
        instagram,
      },
    };

    return signTypedData({
      privateKey: signer === 1 ? signer1PrivateKey : signer2PrivateKey,
      // @ts-ignore
      data,
      version: SignTypedDataVersion.V4,
    });
  };

  let supertrueNFTbeacon: BeaconProxy;
  let diamondCutFacet: DiamondCutFacet;

  before(async () => {
    // deploy LibPricing
    const LibPricingContract = await ethers.getContractFactory("LibPricing");
    libPricingContract = <LibPricing>await LibPricingContract.deploy();
    await libPricingContract.deployed();

    // deploy SupertrueNFT beacon
    const SupertrueNFTContract = await ethers.getContractFactory(
      "SupertrueNFT",
      {
        libraries: { LibPricing: libPricingContract.address },
      }
    );
    supertrueNFTbeacon = <BeaconProxy>await upgrades.deployBeacon(
      SupertrueNFTContract,
      {
        unsafeAllowLinkedLibraries: true,
      }
    );
    await supertrueNFTbeacon.deployed();

    // deploy DiamondCutFacet
    const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
    diamondCutFacet = <DiamondCutFacet>await DiamondCutFacet.deploy();
    await diamondCutFacet.deployed();
  });

  beforeEach(async () => {
    [owner, admin, tester, artist, relay, treasury] = await ethers.getSigners();

    // deploy SupertrueDiamond
    const Diamond = await ethers.getContractFactory("SupertrueDiamond");
    diamondContract = <DiamondCutFacet>(
      await Diamond.deploy(owner.address, diamondCutFacet.address)
    );
    await diamondContract.deployed();

    // deploy DiamondInit
    // DiamondInit provides a function that is called when the diamond is upgraded to initialize state variables
    // See https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
    const DiamondInit = await ethers.getContractFactory("DiamondInitTest");
    const diamondInit = await DiamondInit.deploy();
    await diamondInit.deployed();

    const FacetNames = [
      "DiamondLoupeFacet",
      "SupertrueConfigFacet",
      "SupertrueHubFacet",
    ];

    let cut = [];
    for (const FacetName of FacetNames) {
      const Facet = await ethers.getContractFactory(FacetName);
      const facet = await Facet.deploy();
      await facet.deployed();
      cut.push({
        facetAddress: facet.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(facet),
      });
    }

    // Removing mysterious contract, remove and get values
    cut = cut.map((c) => ({
      ...c,
      functionSelectors: c.functionSelectors.filter(
        (f: any) => typeof f === "string"
      ),
    }));

    // upgrade diamond with facets
    const diamondCut = await ethers.getContractAt(
      "IDiamondCut",
      diamondContract.address
    );

    // call to init function
    const functionCall = diamondInit.interface.encodeFunctionData("init", [
      supertrueNFTbeacon.address,
      relay.address,
      treasury.address,
    ]);
    // const tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, '0x') // empty init
    let tx = await diamondCut.diamondCut(
      cut,
      diamondInit.address,
      functionCall
    );
    await tx.wait();

    configContract = <SupertrueConfigFacet>(
      await ethers.getContractAt(
        "SupertrueConfigFacet",
        diamondContract.address
      )
    );
    factoryContract = <SupertrueHubFacet>(
      await ethers.getContractAt("SupertrueHubFacet", diamondContract.address)
    );

    const price = await factoryContract.getCreationPrice();

    const signature1 = getArtistUpdateSignedMessage({
      signer: 1,
      account: owner.address,
      instagramId: ARTISTS[0].igId,
      instagram: ARTISTS[0].ig,
    });
    const signature2 = getArtistUpdateSignedMessage({
      signer: 2,
      account: owner.address,
      instagramId: ARTISTS[0].igId,
      instagram: ARTISTS[0].ig,
    });

    // Deploy New Artist
    tx = await factoryContract.createArtist(
      ARTISTS[0].username,
      ARTISTS[0].name,
      ARTISTS[0].igId,
      ARTISTS[0].ig,
      signature1,
      signature2,
      { value: price }
    );
    await tx.wait();

    // Fetch New Artist Contract Address
    const artistContractAddr = await factoryContract.getArtistContract(1);

    // Attach
    const SupertrueNFT = await ethers.getContractFactory("SupertrueNFT", {
      libraries: { LibPricing: libPricingContract.address },
    });
    artistContract = <SupertrueNFT>(
      await SupertrueNFT.attach(artistContractAddr)
    );
  });

  describe("Config Contract", () => {
    describe("Permissions", () => {
      it("Should be owned by deployer", async () => {
        expect(await configContract.owner()).to.equal(owner.address);
      });

      it("Should be pausable", async () => {
        expect(await configContract.paused()).to.equal(false);
        // Pause
        await configContract.pause();
        expect(await configContract.paused()).to.equal(true);
        // Unpause
        await configContract.unpause();
        expect(await configContract.paused()).to.equal(false);
      });

      it("Should prevent unauthorized access", async () => {
        await expect(
          configContract.connect(admin).setTreasury(admin.address)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");

        await expect(
          configContract.connect(admin).setTreasuryFee(1000)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });

      it("Should change creation fee", async () => {
        expect(await configContract.creationFee()).to.equal(CREATION_FEE);

        const newCreationFee = 999;

        const tx = await configContract
          .connect(owner)
          .setCreationFee(newCreationFee);
        await expect(tx)
          .to.emit(configContract, "CreationFeeUpdated")
          .withArgs(newCreationFee);

        expect(await configContract.creationFee()).to.equal(newCreationFee);
      });
    });

    describe("Data", () => {
      it("Should hold treasury data", async () => {
        // Defaults
        let treasuryData = await configContract.treasuryData();
        expect(treasuryData[0]).to.equal(treasury.address);
        expect(treasuryData[1]).to.equal(2000);
        // New Values
        const newTreasury = await ethers.getSigner(2);
        const newTreasuryAmount = 1000;
        // Set
        let tx = await configContract.setTreasury(newTreasury.address);
        await expect(tx)
          .to.emit(configContract, "TreasuryUpdated")
          .withArgs(newTreasury.address);

        tx = await configContract.setTreasuryFee(newTreasuryAmount);
        await expect(tx)
          .to.emit(configContract, "TreasuryFeeUpdated")
          .withArgs(newTreasuryAmount);

        // Check
        treasuryData = await configContract.treasuryData();
        expect(treasuryData[0]).to.equal(newTreasury.address);
        expect(treasuryData[1]).to.equal(newTreasuryAmount);
      });
    });
  });

  describe("Factory", () => {
    it("Should have Config", async () => {
      expect(await factoryContract.getConfig()).not.to.equal(ZERO_ADDR); // Starts With Defaults
    });

    it("Should return 0 address for not existing artist id", async () => {
      await expect(await factoryContract.getArtistContract(99)).to.be.equal(
        ethers.constants.AddressZero
      );
    });

    it("Should return 0 address for not existing instagram id", async () => {
      await expect(
        await factoryContract.getArtistContractByInstagramId("99")
      ).to.be.equal(ethers.constants.AddressZero);
    });

    it("Should fail to deploy child: SupertrueNFT contract without value", async () => {
      const signature1 = getArtistUpdateSignedMessage({
        signer: 1,
        account: owner.address,
        instagramId: ARTISTS[0].igId,
        instagram: ARTISTS[0].ig,
      });
      const signature2 = getArtistUpdateSignedMessage({
        signer: 2,
        account: owner.address,
        instagramId: ARTISTS[0].igId,
        instagram: ARTISTS[0].ig,
      });

      await expect(
        factoryContract.createArtist(
          ARTISTS[0].username,
          ARTISTS[0].name,
          ARTISTS[0].igId,
          ARTISTS[0].ig,
          signature1,
          signature2
        )
      ).to.be.revertedWith("Insufficient payment'");
    });

    it("Should deploy child: SupertrueNFT Contract", async () => {
      const artistUsername = ARTISTS[1].username;
      const artistName = ARTISTS[1].name;
      const artistIG = ARTISTS[1].ig;
      const artistGUID = ARTISTS[1].igId;
      const price = await factoryContract.getCreationPrice();

      const signature1 = getArtistUpdateSignedMessage({
        signer: 1,
        account: owner.address,
        instagramId: artistGUID,
        instagram: artistIG,
      });
      const signature2 = getArtistUpdateSignedMessage({
        signer: 2,
        account: owner.address,
        instagramId: artistGUID,
        instagram: artistIG,
      });

      // Deploy New Artist
      // TODO: How to get the id & address from that??
      const tx = await factoryContract.createArtist(
        artistUsername,
        artistName,
        artistGUID,
        artistIG,
        signature1,
        signature2,
        { value: price }
      );

      await expect(tx).to.emit(factoryContract, "ArtistCreated");

      // console.log("[TEST] Deployed Artist Contract:"+T1.address, tx);
      // let dep = await tx.wait();
      // console.log("Deployed Artist Contract:", dep);

      // Fetch New Artist Contract Address
      const artistContractAddr = await factoryContract.getArtistContract(1);

      // let t1 = await newArtistContract.owner();
      // console.log("Deployed Artist Contract to:"+artistContractAddr, newArtistContract, t1);
      // console.log("Deployed Artist Contract:", artistContracts[0]);
      // console.log("Deployed Artist Contract Addr", artistContracts[0].hash);

      // expect(artistContractAddr).to.equal(artistContracts[0].hash);

      expect(artistContractAddr).not.to.equal(ZERO_ADDR);
    });

    it("Should not allow same instagram id to be deployed twice", async () => {
      const price = await factoryContract.getCreationPrice();

      const signature1 = getArtistUpdateSignedMessage({
        signer: 1,
        account: owner.address,
        instagramId: ARTISTS[1].igId,
        instagram: ARTISTS[1].ig,
      });
      const signature2 = getArtistUpdateSignedMessage({
        signer: 2,
        account: owner.address,
        instagramId: ARTISTS[1].igId,
        instagram: ARTISTS[1].ig,
      });

      await expect(
        factoryContract.createArtist(
          ARTISTS[1].username,
          ARTISTS[1].name,
          ARTISTS[0].igId,
          ARTISTS[1].ig,
          signature1,
          signature2,
          { value: price }
        )
      ).to.be.revertedWith("Instagram ID exists");
    });

    it("Should not allow same username to be deployed twice", async () => {
      const price = await factoryContract.getCreationPrice();

      const signature1 = getArtistUpdateSignedMessage({
        signer: 1,
        account: owner.address,
        instagramId: ARTISTS[1].igId,
        instagram: ARTISTS[1].ig,
      });
      const signature2 = getArtistUpdateSignedMessage({
        signer: 2,
        account: owner.address,
        instagramId: ARTISTS[1].igId,
        instagram: ARTISTS[1].ig,
      });

      await expect(
        factoryContract.createArtist(
          ARTISTS[0].username,
          ARTISTS[1].name,
          ARTISTS[1].igId,
          ARTISTS[1].ig,
          signature1,
          signature2,
          { value: price }
        )
      ).to.be.revertedWith("Username exists");
    });
  });

  describe("Artist NFT", () => {
    it("Should inherit Owner", async () => {
      // Not Admin
      expect(await artistContract.owner()).to.equal(owner.address);
    });

    it("Should have price", async () => {
      const result = await artistContract.price();
      expect(result).to.equal(PRICE_BASE);
    });

    it("Should have Contract URI", async () => {
      const result = await artistContract.contractURI();
      expect(result).to.equal(BASE_URI + "1/storefront");
    });

    it("Can Change Contract URI", async () => {
      // let curBaseURI = await configContract.baseURI();
      const newBaseURI = "https://test-domain.com/api/";
      // Change
      await configContract.setBaseURI(newBaseURI);

      // Sleep
      // await new Promise(resolve => setTimeout(resolve, 2000));
      // let curArtistBaseURI = await artistContract.baseURI();
      // console.log("curArtistBaseURI", curArtistBaseURI);   //V
      // Check
      expect(await configContract.baseURI()).to.equal(newBaseURI);
      expect(await artistContract.contractURI()).to.equal(
        newBaseURI + "1/storefront"
      );

      // Change Back
      await configContract.setBaseURI(BASE_URI);
      // Check
      expect(await configContract.baseURI()).to.equal(BASE_URI);
    });

    it("Could be pausable", async () => {
      expect(await artistContract.paused()).to.equal(false);
      // Pause
      await artistContract.pause();
      expect(await artistContract.paused()).to.equal(true);
      // Should fail to mint
      await expect(artistContract.mint(tester.address)).to.be.revertedWith(
        "Pausable: paused"
      );
      // Unpause
      await artistContract.unpause();
      expect(await artistContract.paused()).to.equal(false);
    });

    it("Should obey protocol pause", async () => {
      // Pause
      await configContract.pause();
      expect(await artistContract.paused()).to.equal(true);
      // Should fail to mint
      await expect(artistContract.mint(tester.address)).to.be.revertedWith(
        "Pausable: paused"
      );
      // Unpause
      await configContract.unpause();
      expect(await artistContract.paused()).to.equal(false);
    });

    it("Beacon should be upgradable", async () => {
      // New Implementation
      const NewImplementation = await ethers.getContractFactory(
        "SupertrueNFTv2",
        {
          libraries: { LibPricing: libPricingContract.address },
        }
      );
      const newImplementation = await NewImplementation.deploy();

      const oldTotalSupply = await artistContract.totalSupply();
      const oldArtistPendingFunds = await artistContract.artistPendingFunds();
      const oldTreasuryPendingFunds =
        await artistContract.treasuryPendingFunds();
      const oldPrice = await artistContract.price();
      const oldPrice500 = await artistContract.priceTokenId(500);
      const oldArtist = await artistContract.getArtist();

      // -- Prep
      // Fetch Beacon
      const beaconAddress = await configContract.nftBeacon();
      await upgrades.upgradeBeacon(beaconAddress, NewImplementation, {
        unsafeAllowLinkedLibraries: true,
      });

      // Upgrade
      await configContract.setNftBeacon(newImplementation.address);

      const updatedArtistContract = await ethers.getContractAt(
        "SupertrueNFTv2",
        artistContract.address
      );

      const hasChanged = await updatedArtistContract.hasChanged();

      expect(hasChanged).to.equal(true);

      const newTotalSupply = await updatedArtistContract.totalSupply();
      const newArtistPendingFunds =
        await updatedArtistContract.artistPendingFunds();
      const newTreasuryPendingFunds =
        await updatedArtistContract.treasuryPendingFunds();
      const newPrice = await updatedArtistContract.price();
      const newPrice500 = await updatedArtistContract.priceTokenId(500);
      const newArtist = await updatedArtistContract.getArtist();

      expect(oldTotalSupply).to.equal(newTotalSupply);
      expect(oldArtistPendingFunds).to.equal(newArtistPendingFunds);
      expect(oldTreasuryPendingFunds).to.equal(newTreasuryPendingFunds);
      expect(oldPrice).to.equal(newPrice);
      expect(oldPrice500).to.equal(newPrice500);

      expect(oldArtist.username).to.equal(newArtist.username);
      expect(oldArtist.instagramId).to.equal(newArtist.instagramId);
      expect(oldArtist.account).to.equal(newArtist.account);
    });

    describe("Pricing", () => {
      it("Should return correct price per tokenId", async () => {
        const startPrice = "10000000000000000"; // == 0.01 in native token with token price $1k (=$10)
        const endPrice = "50000000000000000"; // == 5 * startPrice == 0.05

        await expect(await artistContract.price()).to.be.equal(startPrice);
        await expect(await artistContract.priceTokenId(1)).to.be.equal(
          startPrice
        );
        await expect(await artistContract.priceTokenId(1000)).to.be.equal(
          endPrice
        );
        await expect(await artistContract.priceTokenId(10000)).to.be.equal(
          endPrice
        );

        await expect(
          (await artistContract.priceTokenId(2)).eq("10115300341324854")
        ).to.be.true;
        await expect(
          (await artistContract.priceTokenId(100)).eq("15500140949997395")
        ).to.be.true;
        await expect(
          (await artistContract.priceTokenId(500)).eq("33398500028846246")
        ).to.be.true;
        await expect(
          (await artistContract.priceTokenId(900)).eq("47039976742248925")
        ).to.be.true;
        await expect(
          (await artistContract.priceTokenId(999)).eq("49971138883301622")
        ).to.be.true;
      });

      it("Should change price", async () => {
        const newStartPrice = 10000; // == $100 (in cents)
        const newStartNFTPrice = "100000000000000000"; // == 0.1 in native token with token price $1k (=$100)
        const newEndNFTPrice = "500000000000000000"; // == 5 * startPrice == 0.5

        const tx = await artistContract
          .connect(relay)
          .setPricing(newStartPrice);
        await expect(tx)
          .to.emit(artistContract, "PricingUpdated")
          .withArgs(0, newStartPrice, newStartPrice * 5, 1000);

        await expect(await artistContract.price()).to.be.equal(
          newStartNFTPrice
        );
        await expect(await artistContract.priceTokenId(1)).to.be.equal(
          newStartNFTPrice
        );
        await expect(await artistContract.priceTokenId(1000)).to.be.equal(
          newEndNFTPrice
        );
        await expect(await artistContract.priceTokenId(10000)).to.be.equal(
          newEndNFTPrice
        );

        await expect(
          (await artistContract.priceTokenId(2)).eq("101153003413248540")
        ).to.be.true;
        await expect(
          (await artistContract.priceTokenId(100)).eq("155001409499973957")
        ).to.be.true;
        await expect(
          (await artistContract.priceTokenId(500)).eq("333985000288462466")
        ).to.be.true;
        await expect(
          (await artistContract.priceTokenId(900)).eq("470399767422489255")
        ).to.be.true;
        await expect(
          (await artistContract.priceTokenId(999)).eq("499711388833016220")
        ).to.be.true;
      });
    });

    describe("Tokens", () => {
      it("Should Fail To Mint NFT Without Value", async () => {
        await expect(artistContract.mint(admin.address)).to.be.revertedWith(
          "Insufficient Payment"
        );
      });

      it("Should Mint NFTokens", async () => {
        const price = await artistContract.price();

        const tx = await artistContract.mint(admin.address, { value: price });
        await tx.wait();

        // Fetch Token
        const result = await artistContract.ownerOf(1);
        expect(result).to.equal(admin.address);
      });
      it("Should Have Token URI", async () => {
        const price = await artistContract.price();

        const tx = await artistContract.mint(admin.address, { value: price });
        await tx.wait();

        const tokenURI = BASE_URI + "1/json/1";
        const result = await artistContract.tokenURI(1);
        expect(result).to.equal(tokenURI);
      });
      it("Can Change Token URI", async () => {
        const price = await artistContract.price();

        const tx = await artistContract.mint(admin.address, { value: price });
        await tx.wait();

        const newBaseURI = "https://test-domain.com/api/";
        // Change
        await configContract.setBaseURI(newBaseURI);
        // Check
        expect(await configContract.baseURI()).to.equal(newBaseURI);
        expect(await artistContract.tokenURI(1)).to.equal(
          newBaseURI + "1/json/1"
        );
        // Change Back
        await configContract.setBaseURI(BASE_URI);
        // Check
        expect(await configContract.baseURI()).to.equal(BASE_URI);
      });
    });

    const getClaimAccountSignedMessage = ({
      account,
      instagram,
      artistId,
      signer,
    }: {
      account: string;
      instagram: string;
      artistId: BigNumber;
      signer: number;
    }) => {
      const types = {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        Message: [
          { name: "signer", type: "uint256" },
          { name: "account", type: "address" },
          { name: "instagram", type: "string" },
          { name: "artistId", type: "uint256" },
        ],
      };

      const data = {
        types,
        primaryType: "Message",
        domain: {
          name: "Supertrue",
          version: "1",
          chainId: 31337,
          verifyingContract: artistContract.address,
        },
        message: {
          signer,
          account,
          instagram,
          artistId: Number(artistId),
        },
      };

      return signTypedData({
        privateKey: signer === 1 ? signer1PrivateKey : signer2PrivateKey,
        // @ts-ignore
        data,
        version: SignTypedDataVersion.V4,
      });
    };

    describe("Claim", () => {
      before(async () => {
        await configContract.setSigners(signer1, signer2);
      });

      it("Signers are correctly set up", async () => {
        expect(await configContract.signer1()).to.equal(signer1);
        expect(await configContract.signer2()).to.equal(signer2);
      });

      it("Should get correct signer address", async () => {
        const artist = await artistContract.getArtist();

        const signature = getClaimAccountSignedMessage({
          signer: 1,
          account: owner.address,
          instagram: artist.instagram,
          artistId: artist.id,
        });

        expect(await artistContract.getSigner(signature, 1)).to.equal(signer1);
      });

      it("Should claim account", async () => {
        const artist = await artistContract.getArtist();
        const artistAccount = owner.address;

        const signature1 = getClaimAccountSignedMessage({
          signer: 1,
          account: artistAccount,
          instagram: artist.instagram,
          artistId: artist.id,
        });
        const signature2 = getClaimAccountSignedMessage({
          signer: 2,
          account: artistAccount,
          instagram: artist.instagram,
          artistId: artist.id,
        });

        const tx = await artistContract.claim(signature1, signature2);

        await expect(tx)
          .to.emit(artistContract, "ArtistClaimed")
          .withArgs(artistAccount);
        expect((await artistContract.getArtist()).account).to.equal(
          artistAccount
        );
      });
    });

    describe("Payments", () => {
      it("Should increase artist pending funds after mint", async () => {
        const startBalance = 0;

        expect(await artistContract.artistPendingFunds()).to.equal(
          startBalance
        );

        const price = await artistContract.price();
        const tx = await artistContract.mint(tester.address, { value: price });
        await tx.wait();

        // @ts-ignore
        const addedBalance = price * 0.8; // 80% for artist

        expect(await artistContract.artistPendingFunds()).to.equal(
          startBalance + addedBalance
        );
      });

      it("Should increase treasury pending funds after mint", async () => {
        const startBalance = 0;

        expect(await artistContract.treasuryPendingFunds()).to.equal(
          startBalance
        );

        const price = await artistContract.price();
        const tx = await artistContract.mint(tester.address, { value: price });
        await tx.wait();

        // @ts-ignore
        const addedBalance = price * 0.2; // 20% for treasury

        expect(await artistContract.treasuryPendingFunds()).to.equal(
          startBalance + addedBalance
        );
      });

      it("Should treasury pending funds equals to 0 after withdraw", async () => {
        const price = await artistContract.price();
        let tx = await artistContract.mint(tester.address, { value: price });
        await tx.wait();

        tx = await artistContract.withdrawTreasury();
        await tx.wait();

        expect(await artistContract.treasuryPendingFunds()).to.equal(0);
      });

      it("Should fail when try to do treasury withdraw with no pending treasury funds", async () => {
        await expect(artistContract.withdrawTreasury()).to.be.revertedWith(
          "No Pending Funds"
        );
      });

      it("Should emit Withdrawal event with withdraw", async () => {
        const price = await artistContract.price();
        let tx = await artistContract.mint(tester.address, { value: price });
        await tx.wait();

        tx = await artistContract.withdrawTreasury();

        await expect(tx)
          .to.emit(artistContract, "Withdrawal")
          .withArgs(
            treasury.address,
            ethers.constants.AddressZero,
            // @ts-ignore
            price * 0.2
          );

        tx = await artistContract.withdrawArtist();

        await expect(tx)
          .to.emit(artistContract, "Withdrawal")
          // @ts-ignore
          .withArgs(owner.address, ethers.constants.AddressZero, price * 0.8);
      });

      it("Should artist pending funds equals to 0 after withdraw", async () => {
        const price = await artistContract.price();
        let tx = await artistContract.mint(tester.address, { value: price });
        await tx.wait();

        tx = await artistContract.withdrawArtist();
        await tx.wait();

        expect(await artistContract.artistPendingFunds()).to.equal(0);
      });

      it("Should receive native currency via transfer", async () => {
        const tx = await tester.sendTransaction({
          to: artistContract.address,
          value: 888,
        });

        await tx.wait();

        expect(
          await waffle.provider.getBalance(artistContract.address)
        ).to.equal(888);
      });

      it("Should increase pending funds after transfer", async () => {
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
});
