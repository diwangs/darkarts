pragma solidity ^0.8.0;

contract DummyGreeter {

    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function getOwner() external view returns (address) {
        return owner;
    }

    function greet() external pure returns (string memory) {
        return "hello!";
    }
}