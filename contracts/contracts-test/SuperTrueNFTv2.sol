// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../SuperTrueNFT.sol";

/**
 * SuperTrueNFT for Testing Purposes
 */
contract SuperTrueNFTv2 is SuperTrueNFT {
    // string private yoyo = 'to';  //TESTING: Not Upgrade Safe

    function hasChanged() external pure returns (bool) {
        return true;
    }
}
