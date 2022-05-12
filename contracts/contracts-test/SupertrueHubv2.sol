// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../SupertrueHub.sol";

/**
 * SupertrueHub for Testing Purposes
 */
contract SupertrueHubv2 is SupertrueHub {
    function hasChanged() external pure returns (bool) {
        return true;
    }
}
