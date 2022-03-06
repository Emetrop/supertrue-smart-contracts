//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "../ForwardCreator.sol";

/**
 * ForwardCreator for Testing Purposes
 */
contract ForwardCreatorv2 is ForwardCreator {

    // string private yoyo = 'to';  //TESTING: Not Upgrade Safe

    function hasChanged() external pure returns (bool){
        return true;
    }
}
