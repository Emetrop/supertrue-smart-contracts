//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Global Configuration Contract
 */
contract Config is Ownable {

    // Arbitrary contract designation signature
    string public constant role = "SupertrueConfig";

    //-- Storage --//
    //Treasury
    uint256 private _treasuryFee = 2000;   //Default to 20%
    address private _treasury;
    //Admin
    mapping(address => bool) private _admins;   //Admins of this contract
    //Base URI
    string private _BaseURI;


    //-- Events --//
    event TreasurySet(address treasury);
    event TreasuryFeeSet(uint256 treasuryFee);
    event AdminAdded(address admin);
    event AdminRemoved(address admin);
    

    //-- Methods --//
    
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


}