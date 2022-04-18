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
    
    describe("Tx", function() {
        it("Should return something", async function () {
            await nft.awardItem(addr1.address, "Some URL")
            const addr1Balance = await nft.balanceOf(addr1.address) 
            // Why doesn't ownerOf work?
            // https://github.com/TrueFiEng/Waffle/issues/339
            expect(addr1Balance).to.equal(1)
        })    
    })
})