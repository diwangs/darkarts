const DummyNFT = artifacts.require("UserInfo");

contract("DummyNFT", accounts => {
    let nft;
    let userAccount;

    beforeEach(async () => {
        nft = await DummyNFT.deployed();
        userAccount = accounts[0];
    })

    it("Test ERC721 implementation", async () => {
        let result = await nft.awardItem(userAccount, "Some URL", { from: accounts[0] });
        let tokenId = result.logs[0].args.tokenId;
        
        let owner = await nft.ownerOf(tokenId);
        assert.equal(owner, userAccount, "User account doesn't have a token");

        let tokenURI = await nft.tokenURI(tokenId);
        assert.equal(
            "Some URL",
            tokenURI,
            "Token metadata is wrong"
        );

        let operator = await nft.getApproved(tokenId);
        assert.notEqual(
            operator,
            userAccount,
            "User account doesn't get approved"
        );

        let name = await nft.name()
        assert.equal(
            "UserInfo",
            name,
            "Incorrect token collection name"
        );

        let symbol = await nft.symbol()
        assert.equal(
            "ITM",
            symbol,
            "Incorrect token collection symbol"
        );
    });
});
