// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface ISupertrueConfig {
    /// Check if contract is paused
    function paused() external view returns (bool);

    /// Treasury data
    function treasuryData() external view returns (address, uint256);

    /// Check if address is whitelisted as relay
    function isRelay(address relay) external view returns (bool);

    /// Get owner
    function owner() external view returns (address);

    /// Get collection base URI
    function baseURI() external view returns (string memory);

    /// Get collection creation fee in native token with 18 decimals
    function creationFee() external view returns (uint256);

    /// Get native token price in USD cents
    function tokenPrice() external view returns (uint256);

    /// Get NFT beacon implementation address
    function nftBeacon() external view returns (address);

    /// Get signer 1 address
    function signer1() external view returns (address);

    /// Get signer 2 address
    function signer2() external view returns (address);
}
