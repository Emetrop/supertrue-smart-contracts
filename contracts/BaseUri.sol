//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./IBaseUri.sol";

contract BaseUri is IBaseUri, OwnableUpgradeable {
    string private _uri;

    function baseUri() public view override returns(string memory) {
        return _uri;
    }

    function setBaseUri(string memory uri) public onlyOwner {
        _uri = uri;
    }
}
