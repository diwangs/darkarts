const MERKLE_TREE_HEIGHT = 20

const fs = require('fs')
const merkleTree = require('fixed-merkle-tree')
const { initialize } = require('zokrates-js/node')
const truffleAssert = require('truffle-assertions')

// not really needed?
const circomlib = require('circomlib')
const snarkjs = require('snarkjs')
const BigNumber = require('bignumber.js')

const Token = artifacts.require("UserInfo")
const Vault = artifacts.require("Vault")

contract("Vault", accounts => {
    let vault;
    let token;
    
    let sendArtifact;
    let sendProvingKey;

    let withdrawArtifact;
    let withdrawProvingKey;

    before(async () => {
        sendArtifact = readArtifact(
            __dirname + "/../build/circuits/send/program.bin", 
            __dirname + "/../build/circuits/send/abi.json"
        )
        sendProvingKey = readProvingKey(__dirname + "/../build/circuits/send/proving_key.bin")
        
        withdrawArtifact = readArtifact(
            __dirname + "/../build/circuits/withdraw/program.bin", 
            __dirname + "/../build/circuits/withdraw/abi.json"
        )
        withdrawProvingKey = readProvingKey(__dirname + "/../build/circuits/withdraw/proving_key.bin")
    })

    beforeEach(async () => {
        token = await Token.deployed()
        vault = await Vault.deployed()
    })
    
    it("e2e test", async () => {
        // mint token
        const result = await token.awardItem.call(accounts[0], "Some URI")
        await token.awardItem(accounts[0], "Some URI")

        // String fixtures (for ZoKrates)
        const secretId1 = "254080219567091772673909445246567392088208036796494585251815984474602972369"
        const secretId2 = "381081628386906533194738143309184053498881367127906410807449526152710014129"
        const nullifier1 = "272418632970930087013102078582984595767243027035861303396446195359448020486"
        const nullifier2 = "218278570709644582400354933544764600979629809596418196314625408049795099009"
        const tokenAddressHex = token.address.toLowerCase()
        const vaultAddressHex = vault.address.toLowerCase()
        const tokenAddressBN = new BigNumber(tokenAddressHex.slice(2), 16)
        const tokenUidContract = tokenAddressBN.toString(10)
        const tokenUidId = result.toString()

        // Create deposit object
        const deposit1 = createDeposit(secretId1, nullifier1, tokenUidContract, tokenUidId)
        const deposit2 = createDeposit(secretId2, nullifier2, tokenUidContract, tokenUidId)

        // Approve
        const tokenIdHex = toHex(tokenUidId)
        await token.approve(vaultAddressHex, tokenIdHex, {from: accounts[0]})

        // Deposit
        console.log("Deposit") 
        let tx = await vault.deposit(toHex(deposit1.commitment), toHex(tokenUidId), tokenAddressHex, {from: accounts[0]})

        truffleAssert.eventEmitted(tx, 'Deposit', (e) => {
            return e.commitment == toHex(deposit1.commitment)
        })

        // Send
        console.log("Send") 
        const r1 = await generateSendProof(vault, deposit1, deposit2, sendArtifact, sendProvingKey)
        tx = await vault.send(r1.proof, ...r1.args, {from: accounts[0]})

        truffleAssert.eventEmitted(tx, 'Withdrawal', (e) => {
            return e.nullifierHash == toHex(deposit1.nullifierHash)
        })
        truffleAssert.eventEmitted(tx, 'Deposit', (e) => {
            return e.commitment == toHex(deposit2.commitment)
        })

        // Withdraw
        console.log("Withdraw") 
        const r2 = await generateWithdrawProof(vault, deposit2, withdrawArtifact, withdrawProvingKey)
        tx = await vault.withdraw(r2.proof, ...r2.args, {from: accounts[1]})
        
        truffleAssert.eventEmitted(tx, 'Withdrawal', (e) => {
            return e.nullifierHash == toHex(deposit2.nullifierHash)
        })
    })
})

// ---
// Util functions
// ---
const mimcSponge = input => circomlib.mimcsponge.multiHash(input, undefined, 1).toString()
function toHex(number, length = 32) {
    const str = number instanceof Buffer ? number.toString('hex') : snarkjs.bigInt(number).toString(16)
    return '0x' + str.padStart(length * 2, '0')
}

function readArtifact(programPath, abiPath) {
    const program = Uint8Array.from(fs.readFileSync(programPath))
    const abi = fs.readFileSync(abiPath, "utf-8")
    return { program, abi }
}

function readProvingKey(path) {
    return Uint8Array.from(fs.readFileSync(path))
}

function createDeposit(secretId, nullifier, tokenUidContract, tokenUidId) {
    const deposit = { secretId, nullifier, tokenUidContract, tokenUidId }
    
    deposit.publicId = mimcSponge([secretId])
    deposit.nullifierHash = mimcSponge([nullifier])
    deposit.commitment = mimcSponge([nullifier, deposit.publicId, tokenUidId, tokenUidContract])

    return deposit
}

async function generateSendProof(vault, oldDeposit, newDeposit, artifact, provingKey) {
    // Compute merkle proof of our commitment
    const { root, pathElements, pathIndices } = await generateMerkleProof(vault, oldDeposit)

    // Prepare circuit input
    const input = [
        // Public snark inputs
        root,
        oldDeposit.nullifierHash,
        newDeposit.commitment,
    
        // Private snark inputs
        oldDeposit.nullifier,
        oldDeposit.secretId,
        oldDeposit.tokenUidId,
        oldDeposit.tokenUidContract,
        pathElements,
        pathIndices.map(Boolean),
        newDeposit.nullifier,
        newDeposit.publicId,
        newDeposit.tokenUidId,
        newDeposit.tokenUidContract,
    ]
    
    // generate witness and prove
    console.log('Generating SNARK proof')
    console.time('Proof time')
    const proof = await generateSnarkProof(artifact, provingKey, input)
    console.timeEnd('Proof time')

    const args = [
        toHex(root),
        toHex(oldDeposit.nullifierHash),
        toHex(newDeposit.commitment),
    ]

    return { proof, args }
}

/**
 * Generate SNARK proof for withdrawal
 * @param deposit Deposit object
 * @param recipient Funds recipient
 * @param relayer Relayer address
 * @param fee Relayer fee
 * @param refund Receive ether for exchanged tokens
 */
async function generateWithdrawProof(vault, deposit, artifact, provingKey) {
    // Compute merkle proof of our commitment
    const { root, pathElements, pathIndices } = await generateMerkleProof(vault, deposit)

    // Prepare circuit input
    const input = [
        // Public snark inputs
        root,
        deposit.nullifierHash,
        deposit.tokenUidId,
        deposit.tokenUidContract,
    
        // Private snark inputs
        deposit.nullifier,
        deposit.secretId,
        pathElements,
        pathIndices.map(Boolean),
    ]
    
    // generate witness and prove
    console.log('Generating SNARK proof')
    console.time('Proof time')
    const proof = await generateSnarkProof(artifact, provingKey, input)
    console.timeEnd('Proof time')

    const args = [
        toHex(root),
        toHex(deposit.nullifierHash),
        toHex(deposit.tokenUidId),
        toHex(deposit.tokenUidContract)
    ]

    return { proof, args }
}

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the tornado, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param deposit Deposit object
 */
 async function generateMerkleProof(tornado, deposit) {
    // Get all deposit events from smart contract and assemble merkle tree from them
    const events = await tornado.getPastEvents('Deposit', { fromBlock: 0, toBlock: 'latest' })
    const leaves = events
      .sort((a, b) => a.returnValues.leafIndex - b.returnValues.leafIndex) // Sort events in chronological order
      .map(e => e.returnValues.commitment)
    const tree = new merkleTree(MERKLE_TREE_HEIGHT, leaves)
  
    // Find current commitment in the tree
    const depositEvent = events.find(e => e.returnValues.commitment === toHex(deposit.commitment))
    const leafIndex = depositEvent ? depositEvent.returnValues.leafIndex : -1
  
    // Validate that our data is correct
    const root = tree.root()
    const isValidRoot = await tornado.isKnownRoot(toHex(root))
    const isSpent = await tornado.isSpent(toHex(deposit.nullifierHash))
    assert(isValidRoot === true, 'Merkle tree is corrupted')
    assert(isSpent === false, 'The note is already spent')
    assert(leafIndex >= 0, 'The deposit is not found in the tree')
  
    // Compute merkle proof of our commitment
    const { pathElements, pathIndices } = tree.path(leafIndex)
    return { pathElements, pathIndices, root: tree.root() }
}

async function generateSnarkProof(artifacts, pk, input) {
    zokratesProvider = await initialize()
    const { witness, output } = zokratesProvider.computeWitness(artifacts, input);
    const proofRaw = zokratesProvider.generateProof(artifacts.program, witness, pk);
    return Object.values(proofRaw.proof)
}