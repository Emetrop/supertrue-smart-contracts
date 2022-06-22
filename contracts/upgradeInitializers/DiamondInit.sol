// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IDiamondLoupe.sol";
import "../interfaces/IDiamondCut.sol";
import "../interfaces/IERC173.sol";
import "../interfaces/IERC165.sol";

import "../libraries/LibDiamond.sol";
import "../libraries/EIP712.sol";

import "../facets/SupertrueConfigStorage.sol";

contract DiamondInit {
    function init(address nftBeacon) external {
        // adding ERC165 data
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;

        // add your own state variables
        // EIP-2535 specifies that the `diamondCut` function takes two optional
        // arguments: address _init and bytes calldata _calldata
        // These arguments are used to execute an arbitrary function using delegatecall
        // in order to set state variables in the diamond during deployment or an upgrade
        // More info here: https://eips.ethereum.org/EIPS/eip-2535#diamond-interface

        EIP712.init("Supertrue", "1");

        SupertrueConfigStorage.Layout storage cs = SupertrueConfigStorage.layout();

        cs.paused = false;
        cs.treasuryFee = 2000; //20%
        cs.nftBeacon = nftBeacon;
        cs.baseURI = "https://us-central1-supertrue-5bc93.cloudfunctions.net/api/artist/";

        // TODO update
        cs.creationFee = 0.002 ether;
        cs.tokenPrice = 100000;
        cs.relays[0x75E1E9b6d287ddf76043C24251ed79B87040bc79] = true;
        cs.treasury = 0x8eC13C4982a5Fb8b914F0927C358E14f8d657133;
        cs.signer1 = 0x8eC13C4982a5Fb8b914F0927C358E14f8d657133;
        cs.signer2 = 0xb9fAfb1De9083eAa09Fd7D058784a0316a2960B1;
    }
}
