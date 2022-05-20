// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

interface ISupertrueConfig {
    /// Arbitrary contract designation signature
    function isSupertrueConfig() external view returns (bool);

    /// Check if contract is paused
    function paused() external view returns (bool);

    /// Contract role signature
    function getTreasuryData() external view returns (address, uint256);

    /// Check if address is whitelisted as admin
    function isAdmin(address admin) external view returns (bool);

    /// Check if address is whitelisted as relay
    function isRelay(address relay) external view returns (bool);

    /// Get owner
    function owner() external view returns (address);

    /// Fetch BaseURI
    function getBaseURI() external view returns (string memory);

    /// Fetch BaseURI
    function getCreationFee() external view returns (uint256);

    /// Get signer 1 address
    function signer1() external view returns (address);

    /// Get signer 2 address
    function signer2() external view returns (address);
}
