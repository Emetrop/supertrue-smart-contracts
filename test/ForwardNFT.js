const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

const utils = ethers.utils;
const addressZero = '0x0000000000000000000000000000000000000000';

use(solidity);

describe("ForwardNFT", function () {
  let ArtistContract;

  // quick fix to let gas reporter fetch data from gas station & coinmarketcap
  // before((done) => { setTimeout(done, 2000); });
  
  before(async function () {
      //Deploy
      const ForwardNFT = await ethers.getContractFactory("ForwardNFT");
      ArtistContract = await ForwardNFT.deploy();
  })

  describe("initialize()",  function () {
    const name = "Test";
    const symbol = "T";
    const url = "https://us-central1-supertrue-5bc93.cloudfunctions.net/api/artist/1/";

    it("Should be able to initialize contract", async function () {
      const [owner] = await ethers.getSigners();
      const hub = owner.address;
      const artistId = 1;
      const instagram = "ig";
      const artistName = "name";

      await ArtistContract.initialize(owner.address, hub, artistId, artistName, instagram, name, symbol, url);

      expect(await ArtistContract.name()).to.equal(name);
      expect(await ArtistContract.symbol()).to.equal(symbol);

      let sup = await ArtistContract.totalSupply();
      // console.log("Total Supply", sup);
      
      expect(await ArtistContract.totalSupply()).to.equal(0);
      expect(await ArtistContract.price()).to.equal(
          utils.parseEther((0.002).toString())
        );

      const artist = await ArtistContract.artist();
      expect(artist.name).to.equal(artistName);
      expect(artist.instagram).to.equal(instagram);
      
      expect(await ArtistContract.contractURI()).to.equal(url + "storefront");
    });

    it("Should set up ownership to sender", async function () {
      const [owner] = await ethers.getSigners();

      expect(await ArtistContract.owner()).to.equal(owner.address);
    });

  });


  describe("setArtist()",  function () {

    it("Should change artist data", async function () {
      const instagram = "ig2";
      const artistName = "name2";
      await ArtistContract.setArtist(artistName, instagram);
      const artist = await ArtistContract.artist();
      
      // console.log("Artist:", artist);

      expect(artist.name).to.equal(artistName);
      expect(artist.instagram).to.equal(instagram);
    });

    it("Should expect artist account", async function () {
      // const artistAddress = await ArtistContract.artistAddress();
      const artist = await ArtistContract.artist();
      expect(artist.account).to.equal(addressZero);
    });

    it("Artist can Claim", async function () {
      const artistAccount = '0xE1a71E7cCCCc9D06f8bf1CcA3f236C0D04Da741B'; //Random Account
      //Claim
      expect(await ArtistContract.setArtistAccount(artistAccount))
        .to.emit(ArtistContract, "ArtistClaimed")
        .withArgs(artistAccount);
      //Verify
      const artist = await ArtistContract.artist();
      expect(artist.account).to.equal(artistAccount);
    });

  });


  //Has Royalty Info

  //Can Change Royalties

  //


  // describe("reserve()", function () {
  //   it("Should reserve NFT", async function () {
  //     const from = "0x0000000000000000000000000000000000000000";
  //
  //
  //     expect(await ArtistContract.ownerOf(1)).to.equal(ArtistContract.address);
  //   });
  //
  //   it("Should transfer reserved NFT", async function () {
  //     const to = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  //     const tokenId = 1;
  //
  //     expect(await ArtistContract.transferReserved(to, tokenId))
  //       .to.emit(ArtistContract, "Transfer")
  //       .withArgs(ArtistContract.address, to, tokenId);
  //
  //     expect(await ArtistContract.ownerOf(1)).to.equal(to);
  //   });
  // });
    
  //Mint First
  // it("Should have a Token URI", async function () {  
  //   expect(await ArtistContract.tokenURI(1)).to.equal("www.example.com/json/1");
  // });

});
