// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol';

contract SuperTrueUpgradeableBeacon is UpgradeableBeacon {
    // only for hardhat

    constructor(address implementation_) UpgradeableBeacon(implementation_) {}
}
