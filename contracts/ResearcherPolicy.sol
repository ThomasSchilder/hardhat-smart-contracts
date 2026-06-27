// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IAMContract {
    function getAttribute(address subject, string calldata key) external view returns (string memory);
}

contract ResearcherPolicy {

    address public owner;
    address public amContract;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can modify policy");
        _;
    }

    constructor(address _amContract) {
        owner = msg.sender;
        amContract = _amContract;
    }

    function evaluate(address subject) external view returns (bool) {
        string memory role = IAMContract(amContract).getAttribute(subject, "role");
        return isEqual(role, "researcher");
    }

    function isEqual(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
