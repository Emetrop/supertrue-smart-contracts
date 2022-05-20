// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./interfaces/ISupertrueConfig.sol";

/**
 * Global Configuration Contract
 */
contract SupertrueConfig is ISupertrueConfig, Ownable, Pausable {
    //-- Storage START --//

    // Treasury
    uint256 private _treasuryFee;
    address private _treasury;
    // Whitelisted admins
    mapping(address => bool) private _admins;
    // Whitelisted relays
    mapping(address => bool) private _relays;
    // URI
    string private _baseURI;
    // Signers addresses
    address private _signer1;
    address private _signer2;
    // NFT Contract
    uint256 private _creationFee;

    //-- Storage END --//

    //-- Events --//
    event TreasurySet(address treasury);
    event TreasuryFeeSet(uint256 treasuryFee);
    event CreationFeeSet(uint256 creationFee);
    event AdminAdded(address admin);
    event AdminRemoved(address admin);
    event RelayAdded(address relay);
    event RelayRemoved(address relay);
    event SignersSet(address signer1, address signer2);

    //-- Methods --//

    constructor(address treasury) Ownable() Pausable() {
        _treasury = treasury;
        //Default Base URI
        _baseURI = "https://us-central1-supertrue-5bc93.cloudfunctions.net/api/artist/";
        //Default Treasury Fee
        _treasuryFee = 2000; //20%
        //Init Signers
        _signer1 = 0x8eC13C4982a5Fb8b914F0927C358E14f8d657133;
        _signer2 = 0xb9fAfb1De9083eAa09Fd7D058784a0316a2960B1;
        //Creation Fee
        _creationFee = 0.002 ether;
    }

    function isSupertrueConfig() public pure returns (bool) {
        return true;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view override(ISupertrueConfig, Ownable) returns (address) {
        return Ownable.owner();
    }

    /**
     * @dev Get Signers Storage Contract Address
     */
    function signer1() public view returns (address) {
        return _signer1;
    }

    /**
     * @dev Get Signers Storage Contract Address
     */
    function signer2() public view returns (address) {
        return _signer2;
    }

    /**
     * @dev Set Signers Storage Contract Address
     */
    function setSigners(address signer1_, address signer2_) public onlyOwner {
        _signer1 = signer1_;
        _signer2 = signer2_;
        emit SignersSet(signer1_, signer2_);
    }

    //-- Pausability

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual override(ISupertrueConfig, Pausable) returns (bool) {
        return Pausable.paused();
    }

    /// Pause Protocol
    function pause() external whenNotPaused onlyOwner {
        _pause();
    }

    /// Unpause Protocol
    function unpause() external whenPaused onlyOwner {
        _unpause();
    }

    //-- Treasury
    /**
     * @dev Fetch Treasury Data
     */
    function getTreasuryData() public view returns (address, uint256) {
        return (_treasury, _treasuryFee);
    }

    /**
     * @dev Set Treasury Address
     */
    function setTreasury(address newTreasury) public onlyOwner {
        _treasury = newTreasury;
        emit TreasurySet(newTreasury);
    }

    /**
     * @dev Set Treasury Fee
     */
    function setTreasuryFee(uint256 newTreasuryFee) public onlyOwner {
        _treasuryFee = newTreasuryFee;
        emit TreasuryFeeSet(newTreasuryFee);
    }

    function getCreationFee() public view returns (uint256) {
        return _creationFee;
    }

    function setCreationFee(uint256 newCreationFee) public onlyOwner {
        _creationFee = newCreationFee;
        emit CreationFeeSet(newCreationFee);
    }

    //-- Relay Management

    /**
     * @dev Enables an address as relay
     * @param relay the address to enable
     */
    function addRelay(address relay) external onlyOwner {
        _relays[relay] = true;
        emit RelayAdded(relay);
    }

    /**
     * @dev Disables an address as relay
     * @param relay the address to disable
     */
    function removeRelay(address relay) external onlyOwner {
        _relays[relay] = false;
        emit RelayRemoved(relay);
    }

    /**
     * @dev Check if address is relay
     */
    function isRelay(address relay) public view returns (bool) {
        return _relays[relay];
    }

    //-- Admin Management

    /**
     * @dev Enables an address for only admin functions
     * @param admin the address to enable
     */
    function addAdmin(address admin) external onlyOwner {
        _admins[admin] = true;
        emit AdminAdded(admin);
    }

    /**
     * @dev Disables an address for only admin functions
     * @param admin the address to disable
     */
    function removeAdmin(address admin) external onlyOwner {
        _admins[admin] = false;
        emit AdminRemoved(admin);
    }

    /**
     * @dev Check if address is admin
     */
    function isAdmin(address admin) public view returns (bool) {
        return _admins[admin];
    }

    /**
     * @dev Set Protocol's Base URI
     */
    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseURI = baseURI_;
    }

    /**
     * @dev Fetch Base URI
     */
    function getBaseURI() external view returns (string memory) {
        return _baseURI;
    }
}
