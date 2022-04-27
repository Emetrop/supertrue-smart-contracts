// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * Global Configuration Contract
 */
contract Config is Ownable, Pausable {
    //-- Storage --//
    //Treasury
    uint256 private _treasuryFee;
    address private _treasury;
    //Admin
    mapping(address => bool) private _admins; //Admins of this contract
    //URI
    string private _baseURI;
    //Signers addresses
    address private _signer1;
    address private _signer2;
    //NFT Contract
    uint256 private _creationFee;

    //-- Events --//
    event TreasurySet(address treasury);
    event TreasuryFeeSet(uint256 treasuryFee);
    event CreationFeeSet(uint256 creationFee);
    event AdminAdded(address admin);
    event AdminRemoved(address admin);
    event SignersSet(address signer1, address signer2);

    //-- Modifiers --//

    /**
     * @dev Throws if called by any account other than the owner or admins.
     */
    modifier onlyOwnerOrAdmin() {
        require(
            owner() == _msgSender() || isAdmin(_msgSender()),
            "Only admin or owner"
        );
        _;
    }

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

    function isSuperTrueConfig() public pure returns (bool) {
        return true;
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

    /// Pause Protocol
    function pause() external whenNotPaused onlyOwnerOrAdmin {
        _pause();
    }

    /// Unpause Protocol
    function unpause() external whenPaused onlyOwnerOrAdmin {
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
        // if (newTreasury == address(0)) revert Errors.InitParamsInvalid();
        // address prevTreasury = _treasury;
        _treasury = newTreasury;
        emit TreasurySet(newTreasury);
    }

    /**
     * @dev Set Treasury Fee
     */
    function setTreasuryFee(uint256 newTreasuryFee) public onlyOwner {
        // if (newTreasuryFee >= BPS_MAX / 2) revert Errors.InitParamsInvalid();
        // uint256 prevTreasuryFee = _treasuryFee;
        _treasuryFee = newTreasuryFee;
        emit TreasuryFeeSet(newTreasuryFee);
    }

    //-- NFT contract
    function getCreationFee() public view returns (uint256) {
        return _creationFee;
    }

    function setCreationFee(uint256 newCreationFee) public onlyOwnerOrAdmin {
        _creationFee = newCreationFee;
        emit CreationFeeSet(newCreationFee);
    }

    //-- Admin Management

    /**
     * @dev enables an address for only admin functions
     * @param admin the address to enable
     */
    function addAdmin(address admin) external onlyOwner {
        _admins[admin] = true;
        emit AdminAdded(admin);
    }

    /**
     * @dev disables an address for only admin functions
     * @param admin the address to disbale
     */
    function removeAdmin(address admin) external onlyOwner {
        _admins[admin] = false;
        emit AdminRemoved(admin);
    }

    /**
     * @dev Function to check if address is admin
     */
    function isAdmin(address account) public view returns (bool) {
        return _admins[account];
    }

    /**
     * @dev Set Protocol's Base URI
     */
    function setBaseURI(string memory baseURI_) external onlyOwnerOrAdmin {
        _baseURI = baseURI_;
    }

    /**
     * @dev Fetch Base URI
     */
    function getBaseURI() external view returns (string memory) {
        return _baseURI;
    }
}
