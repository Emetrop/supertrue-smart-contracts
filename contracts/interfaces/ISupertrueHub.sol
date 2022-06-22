// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface ISupertrueHub {
    function getConfig() external view returns (address);
    function getTokenPrice() external view returns (uint256);
}
