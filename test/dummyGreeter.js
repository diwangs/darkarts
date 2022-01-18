const truffleAssert = require('truffle-assertions')

const DummyGreeter = artifacts.require("DummyGreeter")

contract("DummyGreeter", accounts => {
    it("test", async () => {
        let greeter = await DummyGreeter.deployed();

        console.log(await greeter.getOwner());
    })
})
