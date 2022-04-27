// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract SupertrueUpgradeableBeacon is UpgradeableBeacon {
    // only for hardhat

    constructor(address implementation_) UpgradeableBeacon(implementation_) {}
}
