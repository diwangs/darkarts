const fs = require('fs')
const path = require('path')
const { initialize } = require('zokrates-js/node');

// config
const circuitsDir = __dirname + "/../circuits/"
const fileSystemResolver = (from, to) => {
    const location = path.resolve(path.dirname(path.resolve(circuitsDir + from)), to + ".zok");
    const source = fs.readFileSync(location).toString();
    return { source, location };
};
const options = {
    resolveCallback: fileSystemResolver
}

// TODO: make all of these async?
initialize().then((zokratesProvider) => {
    // read source
    const sendSource = fs.readFileSync(circuitsDir + "send.zok", "utf-8");
    const withdrawSource = fs.readFileSync(circuitsDir + "withdraw.zok", "utf-8");
    
    // compilation (artifacts = {binary, abi})
    const sendArtifacts = zokratesProvider.compile(sendSource, options);
    const withdrawArtifacts = zokratesProvider.compile(withdrawSource, options);

    // run setup (keypair = {pk, vk})
    const sendKeypair = zokratesProvider.setup(sendArtifacts.program);
    const withdrawKeypair = zokratesProvider.setup(withdrawArtifacts.program);

    // export solidity verifier
    const sendSolVerifier = zokratesProvider.exportSolidityVerifier(sendKeypair.vk, "v1").replace("Verifier", "SendVerifier");
    const withdrawSolVerifier = zokratesProvider.exportSolidityVerifier(withdrawKeypair.vk, "v1").replace("Verifier", "WithdrawVerifier");
    // TODO: find more elegant solution for the contract name

    // Writes artifacts, keypair.pk, solVerifier
    fs.writeFileSync(__dirname + "/../build/circuits/send/program.bin", sendArtifacts.program)
    fs.writeFileSync(__dirname + "/../build/circuits/send/abi.json", sendArtifacts.abi)
    fs.writeFileSync(__dirname + "/../build/circuits/withdraw/program.bin", withdrawArtifacts.program)
    fs.writeFileSync(__dirname + "/../build/circuits/withdraw/abi.json", withdrawArtifacts.abi)

    fs.writeFileSync(__dirname + "/../build/circuits/send/proving_key.bin", sendKeypair.pk)
    fs.writeFileSync(__dirname + "/../build/circuits/withdraw/proving_key.bin", withdrawKeypair.pk)

    fs.writeFileSync(__dirname + "/../contracts/SendVerifier.sol", sendSolVerifier)
    fs.writeFileSync(__dirname + "/../contracts/WithdrawVerifier.sol", withdrawSolVerifier)
})
