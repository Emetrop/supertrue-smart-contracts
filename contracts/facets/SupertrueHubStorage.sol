// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library SupertrueHubStorage {
    struct Layout {
        uint256 artistCounter; // starts from 1
        // registry of created contracts
        // values can be only added but not changed or deleted
        mapping(uint256 => address) artistIdToContractAddress;
        // values can be only added but not changed or deleted
        mapping(string => uint256) usernameToArtistId;
        // values can be only added but not changed or deleted
        mapping(string => uint256) instagramIdToArtistId;
    }

    bytes32 internal constant STORAGE_SLOT = keccak256('supertrue.storage.hub');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

