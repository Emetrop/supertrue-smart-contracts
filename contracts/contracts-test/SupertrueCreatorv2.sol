// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../SupertrueCreator.sol";

/**
 * SupertrueCreator for Testing Purposes
 */
contract SupertrueCreatorv2 is SupertrueCreator {
    function hasChanged() external pure returns (bool) {
        return true;
    }
}
