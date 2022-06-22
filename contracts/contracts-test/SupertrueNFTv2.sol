// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../SupertrueNFT.sol";

/**
 * SupertrueNFT for Testing Purposes
 */
contract SupertrueNFTv2 is SupertrueNFT {
    function hasChanged() external pure returns (bool) {
        return true;
    }
}
