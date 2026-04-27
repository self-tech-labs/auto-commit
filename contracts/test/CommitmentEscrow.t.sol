// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CommitmentEscrow} from "../src/CommitmentEscrow.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CommitmentEscrowTest is Test {
    CommitmentEscrow private escrow;
    MockERC20 private token;

    address private admin = address(0xA11CE);
    address private oracle = address(0x0A11);
    address private emergencyRefunder = address(0xE);
    address private user = address(0xB0B);
    address private failureRecipient = address(0xCAFE);
    bytes32 private commitmentId = keccak256("commitment-1");
    bytes32 private goalHash = keccak256("screen-time-goal");
    uint256 private amount = 100e18;

    function setUp() public {
        token = new MockERC20();
        escrow = new CommitmentEscrow(admin, oracle, emergencyRefunder);

        vm.prank(admin);
        escrow.setTokenAllowed(address(token), true);

        token.mint(user, amount);
        vm.prank(user);
        token.approve(address(escrow), amount);
    }

    function testFundStoresCommitmentAndMovesTokens() public {
        _fund();

        assertEq(token.balanceOf(address(escrow)), amount);
        (
            address creator,
            address successRecipient,
            address storedFailureRecipient,
            ,
            uint256 storedAmount,
            bytes32 storedGoalHash,
            ,
            ,
            ,
        ) = escrow.commitments(commitmentId);

        assertEq(creator, user);
        assertEq(successRecipient, user);
        assertEq(storedFailureRecipient, failureRecipient);
        assertEq(storedAmount, amount);
        assertEq(storedGoalHash, goalHash);
    }

    function testSettleSuccessReturnsPrincipalToUser() public {
        _fund();

        vm.prank(oracle);
        escrow.settleSuccess(commitmentId);

        assertEq(token.balanceOf(user), amount);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testSettleFailureSendsPrincipalToFailureRecipient() public {
        _fund();

        vm.prank(oracle);
        escrow.settleFailure(commitmentId);

        assertEq(token.balanceOf(failureRecipient), amount);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testCannotSettleTwice() public {
        _fund();

        vm.startPrank(oracle);
        escrow.settleSuccess(commitmentId);
        vm.expectRevert(CommitmentEscrow.CommitmentNotFunded.selector);
        escrow.settleFailure(commitmentId);
        vm.stopPrank();
    }

    function testUnauthorizedOracleCannotSettle() public {
        _fund();

        vm.expectRevert();
        escrow.settleSuccess(commitmentId);
    }

    function testPausedContractBlocksFundingAndAllowsEmergencyRefund() public {
        vm.prank(admin);
        escrow.pause();

        vm.prank(user);
        vm.expectRevert();
        escrow.fund(
            keccak256("paused"),
            address(token),
            amount,
            user,
            failureRecipient,
            goalHash,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 36 hours)
        );

        vm.prank(admin);
        escrow.unpause();
        _fund();

        vm.prank(admin);
        escrow.pause();

        vm.prank(emergencyRefunder);
        escrow.emergencyRefund(commitmentId, user);

        assertEq(token.balanceOf(user), amount);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testRejectsUnallowedToken() public {
        MockERC20 other = new MockERC20();
        other.mint(user, amount);

        vm.startPrank(user);
        other.approve(address(escrow), amount);
        vm.expectRevert(CommitmentEscrow.InvalidToken.selector);
        escrow.fund(
            keccak256("other-token"),
            address(other),
            amount,
            user,
            failureRecipient,
            goalHash,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 36 hours)
        );
        vm.stopPrank();
    }

    function _fund() private {
        vm.prank(user);
        escrow.fund(
            commitmentId,
            address(token),
            amount,
            user,
            failureRecipient,
            goalHash,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 36 hours)
        );
    }
}
