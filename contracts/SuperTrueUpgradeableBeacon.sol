// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.0 <0.9.0;

import '@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol';

contract ForwardUpgradeableBeacon is UpgradeableBeacon {
    // only for hardhat

    constructor(address implementation_) UpgradeableBeacon(implementation_) {}
}
