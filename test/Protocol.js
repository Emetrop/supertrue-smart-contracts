const { ethers, waffle } = require("hardhat");
const { expect } = require("chai");
const {
  signTypedData,
  SignTypedDataVersion,
} = require("@metamask/eth-sig-util");

const utils = ethers.utils;

/**
 * TODO: Test fund transfer / minting payments
 * TODO: Test Tips (with mint)
 */
describe("EntireProtocol", () => {
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  const PRICE_BASE = "5000000000000000";
  const CREATION_FEE = 2000000000000000;
  const BASE_URI =
    "https://us-central1-supertrue-5bc93.cloudfunctions.net/api/artist/"; //Default Base URI
  const ARTISTS = [
    { name: "name1", ig: "ig_name1", igId: "123" },
    { name: "name2", ig: "ig_name2", igId: "234" },
  ];
  const tokenPriceInCents = 100000; // $1k to avoid comparing BigNums
  let configContract;
  let factoryContract;
  let artistContract;

  // accounts
  let owner;
  let artist;
  let admin;
  let tester;
  let treasury;

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

  const getArtistUpdateSignedMessage = ({ signer, account, instagramId, instagram }) => {
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
      data,
      version: SignTypedDataVersion.V4,
    });
  };

  beforeEach(async () => {
    [owner, admin, tester, artist, treasury] = await ethers.getSigners();

    //Config
    const ConfigContract = await ethers.getContractFactory("SupertrueConfig");
    configContract = await ConfigContract.deploy(treasury.address);

    //Deploy Factory
    const SupertrueHub = await ethers.getContractFactory(
      "SupertrueHub"
    );
    const SupertrueNFTImplementation = await ethers.getContractFactory(
      "SupertrueNFT"
    );
    const supertrueNFTImplementation =
      await SupertrueNFTImplementation.deploy();

    //Deploying new proxy
    factoryContract = await upgrades.deployProxy(
      SupertrueHub,
      [configContract.address, supertrueNFTImplementation.address, tokenPriceInCents],
      { kind: "uups" }
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

    //Deploy New Artist
    let tx = await factoryContract.createArtist(
      ARTISTS[0].name,
      ARTISTS[0].igId,
      ARTISTS[0].ig,
      signature1,
      signature2,
      { value: price }
    );
    await tx.wait();

    //Fetch New Artist Contract Address
    const artistContractAddr = await factoryContract.getArtistContract(1);

    //Attach
    const SupertrueNFT = await ethers.getContractFactory("SupertrueNFT");
    artistContract = await SupertrueNFT.attach(artistContractAddr);
  });

  describe("Config Contract", () => {
    it("Should be a SupertrueConfig", async () => {
      expect(await configContract.isSupertrueConfig()).to.equal(true);
    });

    describe("Permissions", () => {
      it("Should be owned by deployer", async () => {
        expect(await configContract.owner()).to.equal(owner.address);
      });

      it("Should be pausable", async () => {
        expect(await configContract.paused()).to.equal(false);
        //Pause
        await configContract.pause();
        expect(await configContract.paused()).to.equal(true);
        //Unpause
        await configContract.unpause();
        expect(await configContract.paused()).to.equal(false);
      });

      it("Should prevent unauthorized access", async () => {
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

      it("Should change creation fee", async () => {
        expect(await configContract.getCreationFee()).to.equal(CREATION_FEE);

        const newCreationFee = 999;

        const tx = await configContract
          .connect(owner)
          .setCreationFee(newCreationFee);
        await expect(tx)
          .to.emit(configContract, "CreationFeeSet")
          .withArgs(newCreationFee);

        expect(await configContract.getCreationFee()).to.equal(newCreationFee);
      });
    });

    describe("Data", () => {
      it("Should remeber admins", async () => {
        //Not Admin
        expect(await configContract.isAdmin(admin.address)).to.equal(false);
        //Set Admin
        await configContract.addAdmin(admin.address);
        expect(await configContract.isAdmin(admin.address)).to.equal(true);
        //Remove Admin
        await configContract.removeAdmin(admin.address);
        expect(await configContract.isAdmin(admin.address)).to.equal(false);
      });

      it("Should hold treasury data", async () => {
        //Defaults
        let treasuryData = await configContract.getTreasuryData();
        expect(treasuryData[0]).to.equal(treasury.address);
        expect(treasuryData[1]).to.equal(2000);
        //New Values
        let newTreasury = await ethers.getSigner(2);
        let newTreasuryAmount = 1000;
        //Set
        let tx = await configContract.setTreasury(newTreasury.address);
        await expect(tx)
          .to.emit(configContract, "TreasurySet")
          .withArgs(newTreasury.address);

        tx = await configContract.setTreasuryFee(newTreasuryAmount);
        await expect(tx)
          .to.emit(configContract, "TreasuryFeeSet")
          .withArgs(newTreasuryAmount);

        //Check
        treasuryData = await configContract.getTreasuryData();
        expect(treasuryData[0]).to.equal(newTreasury.address);
        expect(treasuryData[1]).to.equal(newTreasuryAmount);
      });
    });
  });

  describe("Factory", () => {
    it("Should be upgradable", async () => {
      //Fetch New Implementation Contract
      let NewImplementation = await ethers.getContractFactory(
        "contracts/contracts-test/SupertrueHubv2.sol:SupertrueHubv2"
      );
      await upgrades.upgradeProxy(factoryContract, NewImplementation);

      //Update Interface
      const newFactoryContract = await NewImplementation.attach(
        factoryContract.address
      );
      // console.log("Upgraded Facroty (Hub) at: "+ factoryContract.address, newFactoryContract);

      //Validate Upgrade
      let hasChanged = await newFactoryContract.hasChanged();
      //Verify Upgrade
      expect(hasChanged).to.equal(true);
    });

    it("Should have Config", async () => {
      expect(await factoryContract.getConfig()).not.to.equal(ZERO_ADDR); //Starts With Defaults
    });

    it("Should secure Config", async () => {
      //Secure
      await expect(
        factoryContract.connect(tester).setConfig(configContract.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should change Config", async () => {
      //Set Config
      await factoryContract.setConfig(configContract.address);
      //Check Config
      expect(await factoryContract.getConfig()).to.equal(
        configContract.address
      );
    });

    it("Should inherit Owner", async () => {
      expect(await factoryContract.owner()).to.equal(owner.address);
    });

    it("Should inherit Admin", async () => {
      //Set Admin
      await configContract.addAdmin(admin.address);
      //Check Admin
      expect(await factoryContract.isAdmin(admin.address)).to.equal(true);
    });

    it("Should return 0 address for not existing artist id", async () => {
      await expect(await factoryContract.getArtistContract(99)).to.be.equal(
        ethers.constants.AddressZero
      );
    });

    it("Should return 0 address for not existing instagram id", async () => {
      await expect(await factoryContract.getArtistContractByInstagramId("99")).to.be.equal(
        ethers.constants.AddressZero
      );
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
          "artistName",
          ARTISTS[0].igId,
          ARTISTS[0].ig,
          signature1,
          signature2
        )
      ).to.be.revertedWith("Insufficient payment'");
    });

    it("Should deploy child: SupertrueNFT Contract", async () => {
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

      //Deploy New Artist
      //TODO: How to get the id & address from that??
      let tx = await factoryContract.createArtist(
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

      //Fetch New Artist Contract Address
      const artistContractAddr = await factoryContract.getArtistContract(1);

      // let t1 = await newArtistContract.owner();
      // console.log("Deployed Artist Contract to:"+artistContractAddr, newArtistContract, t1);
      // console.log("Deployed Artist Contract:", artistContracts[0]);
      // console.log("Deployed Artist Contract Addr", artistContracts[0].hash);

      // expect(artistContractAddr).to.equal(artistContracts[0].hash);

      expect(artistContractAddr).not.to.equal(ZERO_ADDR);
    });

    it("Should update artist", async () => {
      const artistName = ARTISTS[1].name;
      const artistIG = ARTISTS[1].ig;
      const artistGUID = ARTISTS[1].igId;
      const price = await factoryContract.getCreationPrice();

      let signature1 = getArtistUpdateSignedMessage({
        signer: 1,
        account: owner.address,
        instagramId: artistGUID,
        instagram: artistIG,
      });
      let signature2 = getArtistUpdateSignedMessage({
        signer: 2,
        account: owner.address,
        instagramId: artistGUID,
        instagram: artistIG,
      });

      //Deploy New Artist
      //TODO: How to get the id & address from that??
      let tx = await factoryContract.createArtist(
        artistName,
        artistGUID,
        artistIG,
        signature1,
        signature2,
        { value: price }
      );

      await tx.wait();

      const artistId = 2;

      const newName = "Artist New Name";
      const newInstagram = "Artist New Instagram";

      signature1 = getArtistUpdateSignedMessage({
        signer: 1,
        account: ethers.constants.AddressZero,
        instagramId: artistGUID,
        instagram: newInstagram,
      });
      signature2 = getArtistUpdateSignedMessage({
        signer: 2,
        account: ethers.constants.AddressZero,
        instagramId: artistGUID,
        instagram: newInstagram,
      });

      tx = await factoryContract.updateArtist(
        artistId,
        newName,
        newInstagram,
        signature1,
        signature2
      );

      await expect(tx)
        .to.emit(factoryContract, "ArtistUpdated")
        .withArgs(artistId, newName, newInstagram);
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
          ARTISTS[1].name,
          ARTISTS[0].igId,
          ARTISTS[1].ig,
          signature1,
          signature2,
          { value: price }
        )
      ).to.be.revertedWith("Instagram ID exists");
    });
  });

  describe("Artist NFT", () => {
    it("Should inherit Owner", async () => {
      //Not Admin
      expect(await artistContract.owner()).to.equal(owner.address);
    });

    it("Should have price", async () => {
      let result = await artistContract.price();
      expect(result).to.equal(PRICE_BASE);
    });

    it("Should have Contract URI", async () => {
      let result = await artistContract.contractURI();
      expect(result).to.equal(BASE_URI + "1/storefront");
    });

    it("Can Change Contract URI", async () => {
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
      expect(await artistContract.contractURI()).to.equal(
        newBaseURI + "1/storefront"
      );

      //Change Back
      await configContract.setBaseURI(BASE_URI);
      //Check
      expect(await configContract.getBaseURI()).to.equal(BASE_URI);
    });

    it("Can Override Contract URI", async () => {
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

    it("Could be pausable", async () => {
      expect(await artistContract.paused()).to.equal(false);
      //Pause
      await artistContract.pause();
      expect(await artistContract.paused()).to.equal(true);
      //Should fail to mint
      await expect(artistContract.mint(tester.address)).to.be.revertedWith(
        "Pausable: paused"
      );
      //Unpause
      await artistContract.unpause();
      expect(await artistContract.paused()).to.equal(false);
    });

    it("Could be blocked", async () => {
      //Block
      let tx = await artistContract.blockContract(true);
      await expect(tx).to.emit(artistContract, "Blocked");
      //Should fail to mint
      await expect(artistContract.mint(tester.address)).to.be.revertedWith(
        "Pausable: paused"
      );
      //Unblock
      tx = await artistContract.blockContract(false);
      await expect(tx).to.emit(artistContract, "Blocked");
    });

    it("Should obey protocol pause", async () => {
      //Pause
      await configContract.pause();
      expect(await artistContract.paused()).to.equal(true);
      //Should fail to mint
      await expect(artistContract.mint(tester.address)).to.be.revertedWith(
        "Pausable: paused"
      );
      //Unpause
      await configContract.unpause();
      expect(await artistContract.paused()).to.equal(false);
    });

    it("Beacon should be upgradable", async () => {
      //Current Implementation
      const OldImplementation = await ethers.getContractFactory("SupertrueNFT");
      //New Implementation
      const NewImplementation = await ethers.getContractFactory(
        "contracts/contracts-test/SupertrueNFTv2.sol:SupertrueNFTv2"
      );
      let newImplementation = await NewImplementation.deploy();

      //-- Prep
      //Fetch Beacon
      let BeaconAddress = await factoryContract.getBeacon();
      //Register Beacon
      await upgrades.forceImport(BeaconAddress, OldImplementation);
      //Validate Upgrade
      await upgrades.prepareUpgrade(BeaconAddress, NewImplementation);

      //Upgrade
      factoryContract.upgradeBeacon(newImplementation.address);

      //Update Interface
      const newArtistContract = await NewImplementation.attach(
        artistContract.address
      );
      // console.log("Upgraded Artist at: "+ artistContract.address, newArtistContract);

      //Validate Upgrade
      // let hasChanged = await artistContract.hasChanged();
      let hasChanged = await newArtistContract.hasChanged();

      //Verify Upgrade
      expect(hasChanged).to.equal(true);
    });

    describe("Pricing", () => {
      it("Should return correct price per tokenId", async () => {
        const startPrice = 5000000000000000; // == 0.05
        const endPrice = 50000000000000000; // == 0.5

        await expect(await artistContract.priceTokenId(1)).to.be.equal(startPrice);
        await expect((await artistContract.priceTokenId(1000)).eq(endPrice.toString())).to.be.true;
        await expect((await artistContract.priceTokenId(10000)).eq(endPrice.toString())).to.be.true;

        await expect((await artistContract.priceTokenId(2)).eq("5129712883990460")).to.be.true;
        await expect((await artistContract.priceTokenId(100)).eq("11187658568747070")).to.be.true;
        await expect((await artistContract.priceTokenId(500)).eq("31323312532452027")).to.be.true;
        await expect((await artistContract.priceTokenId(900)).eq("46669973835030041")).to.be.true;
        await expect((await artistContract.priceTokenId(999)).eq("49967531243714324")).to.be.true;
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

        let tx = await artistContract.mint(admin.address, { value: price });
        await tx.wait();

        //Fetch Token
        let result = await artistContract.ownerOf(1);
        expect(result).to.equal(admin.address);
      });
      it("Should Have Token URI", async () => {
        const price = await artistContract.price();

        let tx = await artistContract.mint(admin.address, { value: price });
        await tx.wait();

        let tokenURI = BASE_URI + "1/json/1";
        let result = await artistContract.tokenURI(1);
        expect(result).to.equal(tokenURI);
      });
      it("Can Change Token URI", async () => {
        const price = await artistContract.price();

        let tx = await artistContract.mint(admin.address, { value: price });
        await tx.wait();

        let newBaseURI = "https://test-domain.com/api/";
        //Change
        await configContract.setBaseURI(newBaseURI);
        //Check
        expect(await configContract.getBaseURI()).to.equal(newBaseURI);
        expect(await artistContract.tokenURI(1)).to.equal(
          newBaseURI + "1/json/1"
        );
        //Change Back
        await configContract.setBaseURI(BASE_URI);
        //Check
        expect(await configContract.getBaseURI()).to.equal(BASE_URI);
      });
    });

    const getClaimAccountSignedMessage = ({
      account,
      instagram,
      artistId,
      signer,
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
        let tx = await artistContract.mint(tester.address, { value: price });
        await tx.wait();

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
        let tx = await artistContract.mint(tester.address, { value: price });
        await tx.wait();

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
            price * 0.2
          );

        tx = await artistContract.withdrawArtist();

        await expect(tx)
          .to.emit(artistContract, "Withdrawal")
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
