// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IConfig {
    /// Arbitrary contract designation signature
    function role() external view returns (string memory);
    /// Contract Role Signature
    function getTreasuryData() external view returns (address, uint256);
    /// Check if Address Has Admin Privileges
    function isAdmin(address account) external view returns (bool);
}
