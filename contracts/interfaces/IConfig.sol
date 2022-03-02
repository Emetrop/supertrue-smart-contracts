// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IConfig {
    function getTreasuryData() external view returns (address, uint256);
}
