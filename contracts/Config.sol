//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

/* Expirementing with Generic Configurations 
mapping(bytes16 => string) private _strings;
mapping(bytes16 => uint265) private _uints;
mapping(bytes16 => address) private _addresss;
mapping(bytes16 => bool) private _bools;
*/

/**
 * Global Configuration Contract
 * TODO: Add Security & Modifiers
 * TODO: Add Events
 */
contract Config {
    
    /* Expirementing with Generic Configurations 
 
    //-- Setters
    setString(bytes16 key, string value) public { _strings[key] = value; }
    setAddress(bytes16 key, address value) public { _addresss[key] = value; }
    setUint(bytes16 key, uint256 value) public { _uints[key] = value; }
    setBool(bytes16 key, bool value) public { _bools[key] = value; }

    //-- Getters
    getString(bytes16 key) public view returns (string){ return _strings[key]; }
    getAddress(bytes16 key) public view returns (address){ return _addresses[key]; }    
    getUint(bytes16 key) public view returns (unit265){ return _units[key]; }
    getBool(bytes16 key) public view returns (bool){ return _bools[key]; }

    //Could Also Use UINT as Key & Enum Slot Names (Like https://github.com/goldfinch-eng/goldfinch-contracts/blob/main/v1.1/protocol/core/ConfigOptions.sol)
    // enum Addresses {
    //     Treasury,
    // }
    // enum Uints {
    //     TreasuryFee,
    // }
    //   function setTreasuryReserve(address newTreasuryReserve) public onlyAdmin {
    //     uint256 key = uint256(ConfigOptions.Addresses.TreasuryReserve);
    //     emit AddressUpdated(msg.sender, key, addresses[key], newTreasuryReserve);
    //     addresses[key] = newTreasuryReserve;
    //   }

    */

    //-- Treasury --//
    uint256 private _treasuryFee;
    address _treasury;

    /**
     * @dev Fetch Treasury Data
     */
    function getTreasuryData() public view returns (address, uint256) {
        return (_treasury, _treasuryFee);
    }

    /**
     * @dev Set Treasury Address
     */
    function setTreasury(address newTreasury) public onlyGov {
        // if (newTreasury == address(0)) revert Errors.InitParamsInvalid();
        address prevTreasury = _treasury;
        _treasury = newTreasury;
        emit Events.ModuleGlobalsTreasurySet(prevTreasury, newTreasury, block.timestamp);
    }

    /**
     * @dev Set Treasury Fee
     */
    function setTreasuryFee(uint16 newTreasuryFee) public onlyGov {
        // if (newTreasuryFee >= BPS_MAX / 2) revert Errors.InitParamsInvalid();
        uint16 prevTreasuryFee = _treasuryFee;
        _treasuryFee = newTreasuryFee;
        emit Events.ModuleGlobalsTreasuryFeeSet(prevTreasuryFee, newTreasuryFee, block.timestamp);
    }
    

}