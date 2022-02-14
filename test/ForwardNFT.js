const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

const utils = ethers.utils;

use(solidity);

describe("ForwardNFT", function () {
  let myContract;

  // quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before((done) => {
    setTimeout(done, 2000);
  });

  describe("ForwardNFT", function () {
    it("Should deploy ForwardNFT", async function () {
      const ForwardNFT = await ethers.getContractFactory("ForwardNFT");

      myContract = await ForwardNFT.deploy();
    });

    describe("initialize()",  function () {
      const name = "Test";
      const symbol = "T";
      const url = "www.example.com/";

      it("Should be able to initialize contract", async function () {
        const [owner] = await ethers.getSigners();
        const artistId = 1;
        const instagram = "ig";
        const artistName = "name";

        await myContract.initialize(owner.address, artistId, artistName, instagram, name, symbol, url);
        expect(await myContract.name()).to.equal(name);
        expect(await myContract.symbol()).to.equal(symbol);

        expect(await myContract.totalSupply()).to.equal(0);
        expect(await myContract.getCurrentPrice()).to.equal(2000000000000000);

        const artist = await myContract.artist();
        expect(artist.name).to.equal(artistName);
        expect(artist.instagram).to.equal(instagram);

        expect(await myContract.contractURI()).to.equal(url + "storefront");
      });

      it("Should set up ownership to sender", async function () {
        const [owner] = await ethers.getSigners();

        expect(await myContract.owner()).to.equal(owner.address);
      });
    });

    describe("setArtist()",  function () {
      it("Should change artist", async function () {
        const instagram = "ig2";
        const artistName = "name2";

        await myContract.setArtist(artistName, instagram);

        const artist = await myContract.artist();
        expect(artist.name).to.equal(artistName);
        expect(artist.instagram).to.equal(instagram);
      });
    });

    // describe("reserve()", function () {
    //   it("Should reserve NFT", async function () {
    //     const from = "0x0000000000000000000000000000000000000000";
    //
    //     expect(await myContract.reserve())
    //       .to.emit(myContract, "Transfer")
    //       .withArgs(from, myContract.address, 1);
    //
    //     expect(await myContract.ownerOf(1)).to.equal(myContract.address);
    //   });
    //
    //   it("Should transfer reserved NFT", async function () {
    //     const to = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    //     const tokenId = 1;
    //
    //     expect(await myContract.transferReserved(to, tokenId))
    //       .to.emit(myContract, "Transfer")
    //       .withArgs(myContract.address, to, tokenId);
    //
    //     expect(await myContract.ownerOf(1)).to.equal(to);
    //   });
    // });
    //
    // describe("getCurrentPrice()", function () {
    //   it("Should return correct price", async function () {
    //     const basePrice = 0.002;
    //     const increment = 0.0001;
    //     const minted = await myContract.totalSupply();
    //     let price;
    //
    //     price = basePrice + minted * increment;
    //     expect(await myContract.getCurrentPrice()).to.equal(
    //       utils.parseEther(price.toString())
    //     );
    //
    //     await myContract.reserve();
    //
    //     price = basePrice + (minted + 1) * increment;
    //     expect(await myContract.getCurrentPrice()).to.equal(
    //       utils.parseEther(price.toString())
    //     );
    //   });
    // });
  });
});
