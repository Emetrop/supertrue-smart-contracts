// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../interfaces/ISupertrueConfig.sol";
import "../interfaces/IERC173.sol";

import "../libraries/LibDiamond.sol";

import "./SupertrueConfigStorage.sol";

/**
 * Supertrue config facet
 */
contract SupertrueConfigFacet is ISupertrueConfig, IERC173 {
    //-- Events --//

    event TreasurySet(address treasury);
    event TreasuryFeeSet(uint256 treasuryFee);
    event CreationFeeSet(uint256 creationFee);
    event RelayAdded(address relay);
    event RelayRemoved(address relay);
    event SignersSet(address signer1, address signer2);
    event TokenPriceSet(uint256 tokenPrice);
    event NftBeaconSet(address nftBeacon);
    event BaseUriSet(string baseUri);
    event Paused(address account);
    event Unpaused(address account);

    //-- Modifiers --//

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    modifier whenNotPaused() {
        require(!SupertrueConfigStorage.layout().paused, "Pausable: paused");
        _;
    }

    modifier whenPaused() {
        require(SupertrueConfigStorage.layout().paused, "Pausable: not paused");
        _;
    }

    //-- Methods --//

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view override(IERC173, ISupertrueConfig) returns (address) {
        return LibDiamond.contractOwner();
    }

    function transferOwnership(address _newOwner) public {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_newOwner);
    }

    /**
     * @dev Get Signers Storage Contract Address
     */
    function signer1() public view returns (address) {
        return SupertrueConfigStorage.layout().signer1;
    }

    /**
     * @dev Get Signers Storage Contract Address
     */
    function signer2() public view returns (address) {
        return SupertrueConfigStorage.layout().signer2;
    }

    /**
     * @dev Set Signers Storage Contract Address
     */
    function setSigners(address signer1_, address signer2_) public onlyOwner {
        SupertrueConfigStorage.Layout storage cs = SupertrueConfigStorage.layout();
        cs.signer1 = signer1_;
        cs.signer2 = signer2_;
        emit SignersSet(signer1_, signer2_);
    }

    //-- Pausability

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view returns (bool) {
        return SupertrueConfigStorage.layout().paused;
    }

    /// Pause contract
    function pause() public whenNotPaused onlyOwner {
        SupertrueConfigStorage.layout().paused = true;
        emit Paused(msg.sender);
    }

    /// Unpause contract
    function unpause() public whenPaused onlyOwner {
        SupertrueConfigStorage.layout().paused = false;
        emit Unpaused(msg.sender);
    }

    //-- Treasury
    /**
     * @dev Get treasury data
     */
    function treasuryData() public view returns (address, uint256) {
        SupertrueConfigStorage.Layout storage cs = SupertrueConfigStorage.layout();
        return (cs.treasury, cs.treasuryFee);
    }

    /**
     * @dev Set Treasury Address
     */
    function setTreasury(address newTreasury) public onlyOwner {
        SupertrueConfigStorage.layout().treasury = newTreasury;
        emit TreasurySet(newTreasury);
    }

    /**
     * @dev Set treasury fee
     */
    function setTreasuryFee(uint256 newTreasuryFee) public onlyOwner {
        SupertrueConfigStorage.layout().treasuryFee = newTreasuryFee;
        emit TreasuryFeeSet(newTreasuryFee);
    }

    /**
     * @dev Get collection creation fee in native token with 18 decimals
     */
    function creationFee() public view returns (uint256) {
        return SupertrueConfigStorage.layout().creationFee;
    }

    /**
     * @dev Set collection creation fee in native token with 18 decimals
     */
    function setCreationFee(uint256 newCreationFee) public onlyOwner {
        SupertrueConfigStorage.layout().creationFee = newCreationFee;
        emit CreationFeeSet(newCreationFee);
    }

    //-- Relay Management

    /**
     * @dev Enables an address as relay
     * @param relay the address to enable
     */
    function addRelay(address relay) public onlyOwner {
        SupertrueConfigStorage.layout().relays[relay] = true;
        emit RelayAdded(relay);
    }

    /**
     * @dev Disables an address as relay
     * @param relay the address to disable
     */
    function removeRelay(address relay) public onlyOwner {
        SupertrueConfigStorage.layout().relays[relay] = false;
        emit RelayRemoved(relay);
    }

    /**
     * @dev Check if address is relay
     */
    function isRelay(address relay) public view returns (bool) {
        return SupertrueConfigStorage.layout().relays[relay];
    }

    /**
     * @dev Set base URI
     */
    function setBaseURI(string memory baseURI_) public onlyOwner {
        SupertrueConfigStorage.layout().baseURI = baseURI_;
        emit BaseUriSet(baseURI_);
    }

    /**
     * @dev Get base URI
     */
    function baseURI() public view returns (string memory) {
        return SupertrueConfigStorage.layout().baseURI;
    }

    /**
     * @dev Set NFT beacon implementation address
     */
    function setNftBeacon(address nftBeacon_) public onlyOwner {
        SupertrueConfigStorage.layout().nftBeacon = nftBeacon_;
        emit NftBeaconSet(nftBeacon_);
    }

    /**
     * @dev Get NFT beacon implementation address
     */
    function nftBeacon() public view returns (address) {
        return SupertrueConfigStorage.layout().nftBeacon;
    }

    /**
     * @dev Set native token price in USD cents
     */
    function setTokenPrice(uint256 tokenPrice_) public onlyOwner {
        SupertrueConfigStorage.layout().tokenPrice = tokenPrice_;
        emit TokenPriceSet(tokenPrice_);
    }

    /**
     * @dev Get native token price in USD cents
     */
    function tokenPrice() public view returns (uint256) {
        return SupertrueConfigStorage.layout().tokenPrice;
    }
}
