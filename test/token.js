const { expect } = require("chai");
const { ethers } = require("hardhat")

describe("Dummy Token", function() {
    let nft;
    let owner, addr1, addr2;

    beforeEach(async function() {
        const DummyNFT = await ethers.getContractFactory("UserInfo")
        nft = await DummyNFT.deploy();
        await nft.deployed();
        [owner, addr1, addr2] = await ethers.getSigners()
    })
    
    it("Should award token correctly", async function () {
        // Dual awardItem call: https://docs.ethers.io/v5/single-page/#/v5/api/contract/contract/-%23-contract-callStatic
        const tokenId = await nft.callStatic.awardItem(addr1.address, "Some URL")
        await nft.awardItem(addr1.address, "Some URL")
        expect(await nft.ownerOf(tokenId)).to.equal(addr1.address)
    })

    it("Should send token correctly", async function () {
        const tokenId = await nft.callStatic.awardItem(addr1.address, "Some URL")
        await nft.awardItem(addr1.address, "Some URL")
        await nft.connect(addr1).transferFrom(addr1.address, addr2.address, tokenId)
        expect(await nft.ownerOf(tokenId)).to.equal(addr2.address)

    })
})