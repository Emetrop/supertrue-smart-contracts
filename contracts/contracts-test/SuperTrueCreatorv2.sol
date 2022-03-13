// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../SuperTrueCreator.sol";

/**
 * SuperTrueCreator for Testing Purposes
 */
contract SuperTrueCreatorv2 is SuperTrueCreator {

    // string private yoyo = 'to';  //TESTING: Not Upgrade Safe

    function hasChanged() external pure returns (bool){
        return true;
    }
}
