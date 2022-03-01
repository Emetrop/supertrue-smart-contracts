//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

address public CONFIG_ADDR;

/**
 * Generic Configurations Forward Abstract Contract 
 * @dev to be implemented by a HUB Contract
 */
abstract contract Config {

    // getConfig(bytes32 key_, bytes8 type) public view returns (bytes32){
    //     if(type=="string") return IConfig(CONFIG_ADDR).getString(key_);
    //     if(type=="address") return IConfig(CONFIG_ADDR).getAddress(key_);
    //     if(type=="uint") return IConfig(CONFIG_ADDR).getUint(key_);
    //     if(type=="bool") return IConfig(CONFIG_ADDR).getBool(key_);
    // }
    
}