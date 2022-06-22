// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library SupertrueConfigStorage {
    struct Layout {
        // Whitelisted relays
        mapping(address => bool) relays;
        // NFT Contract
        string baseURI;
        uint256 creationFee;
        address nftBeacon;
        uint256 tokenPrice;
        // Treasury
        uint256 treasuryFee;
        address treasury;
        // Signers addresses
        address signer1;
        address signer2;
        // Pausable
        bool paused;
    }

    bytes32 internal constant STORAGE_SLOT = keccak256('supertrue.storage.config');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

