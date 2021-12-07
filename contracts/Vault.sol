// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IVerifier4 {
  function verifyProof(bytes memory _proof, uint256[4] memory _input) external returns (bool);
}

interface IVerifier3 {
  function verifyProof(bytes memory _proof, uint256[3] memory _input) external returns (bool);
}

contract Vault is MerkleTreeWithHistory, ReentrancyGuard {
  IVerifier4 public immutable withdrawVerifier;
  IVerifier3 public immutable sendVerifier;

  mapping(bytes32 => bool) public nullifierHashes;
  mapping(bytes32 => bool) public commitments;

  event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
  event Withdrawal(bytes32 nullifierHash);

  /**
    @dev The constructor
    @param _withdrawVerifier the address of withdraw SNARK verifier for this contract
    @param _sendVerifier the address of send SNARK verifier for this contract
    @param _hasher the address of MiMC hash contract
    @param _merkleTreeHeight the height of deposits' Merkle Tree
  */
  constructor(
    IVerifier4 _withdrawVerifier,
    IVerifier3 _sendVerifier,
    IHasher _hasher,
    uint32 _merkleTreeHeight
  ) MerkleTreeWithHistory(_merkleTreeHeight, _hasher) {
    withdrawVerifier = _withdrawVerifier;
    sendVerifier = _sendVerifier;
  }

  /**
    @dev Deposit funds into the contract. The caller must send (for ETH) or approve (for ERC20) value equal to or `denomination` of this instance.
    @param _commitment the note commitment, which is PedersenHash(nullifier + publicId + tokenId + tokenContract)
    @param _tokenUidId the tokenId of the submitted NFT
    @param _tokenUidContract the contract address of the submitted NFT
  */
  function deposit(
    bytes32 _commitment,
    uint256 _tokenUidId,
    IERC721 _tokenUidContract
  ) external payable nonReentrant {
    require(!commitments[_commitment], "The commitment has been submitted");
    IERC721 tokenContract = _tokenUidContract;
    require(tokenContract.getApproved(_tokenUidId) == address(this), "You haven't approved us");

    uint32 insertedIndex = _insert(_commitment);
    commitments[_commitment] = true;
    
    tokenContract.transferFrom(msg.sender, address(this), _tokenUidId);

    emit Deposit(_commitment, insertedIndex, block.timestamp);
  }

  /**
    @dev Withdraw a deposit from the contract. `proof` is a zkSNARK proof data, and input is an array of circuit public inputs
    `input` array consists of:
      - merkle root of all deposits in the contract
      - hash of unique deposit nullifier to prevent double spends
      - the tokenId
      - the tokenContract address
  */
  function withdraw(
    bytes calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    bytes32 _tokenUidId,
    bytes32 _tokenUidContract
  ) external payable nonReentrant {
    require(!isSpent(_nullifierHash), "The note has been already spent");
    require(isKnownRoot(_root), "Cannot find your merkle root"); // Make sure to use a recent one
    require(
      withdrawVerifier.verifyProof(
        _proof,
        [uint256(_root), uint256(_nullifierHash), uint256(_tokenUidId), uint256(_tokenUidContract)]
      ),
      "Invalid withdraw proof"
    );

    nullifierHashes[_nullifierHash] = true;

    IERC721 tokenContract = IERC721(address(uint160(uint256(_tokenUidContract))));
    tokenContract.transferFrom(address(this), msg.sender, uint256(_tokenUidId));

    emit Withdrawal(_nullifierHash);
  }

  /**
    @dev Send an NFT to a publicId while keeping the actual token in the contract
    `proof` is a zkSNARK proof data, and input is an array of circuit public inputs
    `input` array consists of:
      - merkle root of all deposits in the contract
      - hash of unique deposit nullifier to prevent double spends
      - the new commitment of the token
  */
  function send(
    bytes calldata _proof,
    bytes32 _oldRoot,
    bytes32 _oldNullifierHash,
    bytes32 _newCommitment
  ) external nonReentrant {
    require(!isSpent(_oldNullifierHash), "The note has been already spent");
    require(isKnownRoot(_oldRoot), "Cannot find your merkle root"); // Make sure to use a recent one
    require(
      sendVerifier.verifyProof(
        _proof,
        [uint256(_oldRoot), uint256(_oldNullifierHash), uint256(_newCommitment)]
      ),
      "Invalid send proof"
    );

    nullifierHashes[_oldNullifierHash] = true;
    emit Withdrawal(_oldNullifierHash);

    uint32 insertedIndex = _insert(_newCommitment);
    commitments[_newCommitment] = true;
    emit Deposit(_newCommitment, insertedIndex, block.timestamp);
  }

  /** @dev whether a note is already spent */
  function isSpent(bytes32 _nullifierHash) public view returns (bool) {
    return nullifierHashes[_nullifierHash];
  }

  /** @dev whether an array of notes is already spent */
  function isSpentArray(bytes32[] calldata _nullifierHashes) external view returns (bool[] memory spent) {
    spent = new bool[](_nullifierHashes.length);
    for (uint256 i = 0; i < _nullifierHashes.length; i++) {
      if (isSpent(_nullifierHashes[i])) {
        spent[i] = true;
      }
    }
  }
}
