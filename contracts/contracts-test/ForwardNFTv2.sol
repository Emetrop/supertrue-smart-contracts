//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

//import "hardhat/console.sol";
// import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

// import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";

//Interfaces
// import "./interfaces/IForwardCreator.sol";
// import "./interfaces/IConfig.sol";
// import "./interfaces/IERC20.sol";

import "../ForwardNFT.sol";

/**
 * ForwardNFT for Testing Purposes
 */
contract ForwardNFTv2 is ForwardNFT {

    // string private yoyo = 'to';  //TESTING: Not Upgrade Safe

    function hasChanged() external pure returns (bool){
        return true;
    }
}
