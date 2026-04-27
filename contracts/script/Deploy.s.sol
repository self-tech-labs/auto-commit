// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {CommitmentEscrow} from "../src/CommitmentEscrow.sol";

contract Deploy is Script {
    function run() external returns (CommitmentEscrow escrow) {
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        address emergencyRefunder = vm.envAddress("EMERGENCY_REFUNDER_ADDRESS");

        vm.startBroadcast();
        escrow = new CommitmentEscrow(admin, oracle, emergencyRefunder);
        vm.stopBroadcast();
    }
}
