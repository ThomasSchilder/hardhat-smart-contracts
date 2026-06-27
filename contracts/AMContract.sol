// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract AMContract {

    address public issuer;

    mapping(address => mapping(string => string)) public attributes;
    mapping(address => string[]) public attributeKeys;
    mapping(address => mapping(string => bool)) public hasKey;

    event AttributeSet(address indexed subject, string key, string value);

    modifier onlyIssuer() {
        require(msg.sender == issuer, "Only issuer can set attributes");
        _;
    }

    constructor() {
        issuer = msg.sender;
    }

    function setAttribute(address subject, string calldata key, string calldata value) external onlyIssuer {
        if (!hasKey[subject][key]) {
            attributeKeys[subject].push(key);
            hasKey[subject][key] = true;
        }
        attributes[subject][key] = value;
        emit AttributeSet(subject, key, value);
    }

    function getAttribute(address subject, string calldata key) external view returns (string memory) {
        return attributes[subject][key];
    }

    function getAttributeKeys(address subject) external view returns (string[] memory) {
        return attributeKeys[subject];
    }
}
