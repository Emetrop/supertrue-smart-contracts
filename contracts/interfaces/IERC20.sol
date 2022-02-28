// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev ERC20 Intreface for transfer
 */
interface IERC20 {
    function transfer(address _to, uint256 _amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256 balance);
}