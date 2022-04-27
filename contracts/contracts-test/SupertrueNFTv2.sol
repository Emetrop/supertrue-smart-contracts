// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../SupertrueNFT.sol";

/**
 * SupertrueNFT for Testing Purposes
 */
contract SupertrueNFTv2 is SupertrueNFT {
    function hasChanged() external pure returns (bool) {
        return true;
    }
}
