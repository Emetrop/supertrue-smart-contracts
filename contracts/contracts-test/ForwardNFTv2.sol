//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

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
