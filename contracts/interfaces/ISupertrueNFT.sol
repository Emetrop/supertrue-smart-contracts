// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface ISupertrueNFT {
    struct Artist {
        uint256 id; // immutable
        string username; // immutable
        address account;
        string instagramId; // immutable
        string name;
        string instagram;
    }

    function initialize(
        address diamond_,
        uint256 artistId_,
        string memory artistUsername_,
        string memory artistName_,
        string memory artistInstagram_,
        string memory artistInstagramId_,
        address artistAccount_,
        string memory name_,
        string memory symbol_
    ) external;

    function getArtist() external view returns (Artist memory);

    function updateArtist(string memory name, string memory instagram) external;
}
