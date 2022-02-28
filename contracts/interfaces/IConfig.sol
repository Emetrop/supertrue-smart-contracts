// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IConfig {
    function getTreasuryData() public view returns (address, uint256);
}
