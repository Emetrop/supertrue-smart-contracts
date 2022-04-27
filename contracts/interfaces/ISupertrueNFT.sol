// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ISupertrueNFT {
    struct Artist {
        uint256 id; // immutable
        string instagramId; // immutable
        string name;
        string instagram;
        address account;
        bool blocked;
    }

    function getArtist() external view returns (Artist memory);

    function updateArtist(string memory name, string memory instagram) external;
}
