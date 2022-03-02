//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Global Configuration Contract
 */
contract Config is Ownable {

    //-- State --//
    //Treasury
    uint256 private _treasuryFee;
    address _treasury;

    //-- Events --//
    event TreasurySet(address treasury);
    event TreasuryFeeSet(uint256 treasuryFee);
    
    //-- Methods --//
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
    
}