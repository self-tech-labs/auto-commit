// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract CommitmentEscrow is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TOKEN_ADMIN_ROLE = keccak256("TOKEN_ADMIN_ROLE");
    bytes32 public constant EMERGENCY_REFUNDER_ROLE = keccak256("EMERGENCY_REFUNDER_ROLE");

    enum Status {
        None,
        Funded,
        SuccessSettled,
        FailureSettled,
        EmergencyRefunded
    }

    struct Commitment {
        address creator;
        address successRecipient;
        address failureRecipient;
        IERC20 token;
        uint256 amount;
        bytes32 goalHash;
        uint64 startsAt;
        uint64 endsAt;
        uint64 proofDueAt;
        Status status;
    }

    mapping(address token => bool allowed) public allowedTokens;
    mapping(bytes32 commitmentId => Commitment commitment) public commitments;

    event TokenAllowed(address indexed token, bool allowed);
    event CommitmentFunded(
        bytes32 indexed commitmentId,
        address indexed creator,
        address indexed token,
        uint256 amount,
        address successRecipient,
        address failureRecipient,
        bytes32 goalHash,
        uint64 startsAt,
        uint64 endsAt,
        uint64 proofDueAt
    );
    event CommitmentSettled(bytes32 indexed commitmentId, Status status, address recipient);
    event EmergencyRefunded(bytes32 indexed commitmentId, address indexed recipient);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidToken();
    error InvalidWindow();
    error CommitmentAlreadyExists();
    error CommitmentNotFunded();

    constructor(address admin, address oracle, address emergencyRefunder) {
        if (admin == address(0) || oracle == address(0) || emergencyRefunder == address(0)) {
            revert InvalidAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, oracle);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(TOKEN_ADMIN_ROLE, admin);
        _grantRole(EMERGENCY_REFUNDER_ROLE, emergencyRefunder);
    }

    function setTokenAllowed(address token, bool allowed) external onlyRole(TOKEN_ADMIN_ROLE) {
        if (token == address(0)) revert InvalidAddress();
        allowedTokens[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    function fund(
        bytes32 commitmentId,
        address token,
        uint256 amount,
        address successRecipient,
        address failureRecipient,
        bytes32 goalHash,
        uint64 startsAt,
        uint64 endsAt,
        uint64 proofDueAt
    ) external nonReentrant whenNotPaused {
        if (commitmentId == bytes32(0)) revert InvalidAmount();
        if (!allowedTokens[token]) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        if (successRecipient == address(0) || failureRecipient == address(0)) revert InvalidAddress();
        if (startsAt == 0 || endsAt <= startsAt || proofDueAt < endsAt) revert InvalidWindow();
        if (commitments[commitmentId].status != Status.None) revert CommitmentAlreadyExists();

        IERC20 erc20 = IERC20(token);
        commitments[commitmentId] = Commitment({
            creator: msg.sender,
            successRecipient: successRecipient,
            failureRecipient: failureRecipient,
            token: erc20,
            amount: amount,
            goalHash: goalHash,
            startsAt: startsAt,
            endsAt: endsAt,
            proofDueAt: proofDueAt,
            status: Status.Funded
        });

        erc20.safeTransferFrom(msg.sender, address(this), amount);

        emit CommitmentFunded(
            commitmentId,
            msg.sender,
            token,
            amount,
            successRecipient,
            failureRecipient,
            goalHash,
            startsAt,
            endsAt,
            proofDueAt
        );
    }

    function settleSuccess(bytes32 commitmentId)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
        whenNotPaused
    {
        _settle(commitmentId, Status.SuccessSettled);
    }

    function settleFailure(bytes32 commitmentId)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
        whenNotPaused
    {
        _settle(commitmentId, Status.FailureSettled);
    }

    function emergencyRefund(bytes32 commitmentId, address recipient)
        external
        onlyRole(EMERGENCY_REFUNDER_ROLE)
        nonReentrant
        whenPaused
    {
        if (recipient == address(0)) revert InvalidAddress();

        Commitment storage commitment = commitments[commitmentId];
        if (commitment.status != Status.Funded) revert CommitmentNotFunded();

        commitment.status = Status.EmergencyRefunded;
        commitment.token.safeTransfer(recipient, commitment.amount);

        emit EmergencyRefunded(commitmentId, recipient);
        emit CommitmentSettled(commitmentId, Status.EmergencyRefunded, recipient);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _settle(bytes32 commitmentId, Status settlementStatus) private {
        Commitment storage commitment = commitments[commitmentId];
        if (commitment.status != Status.Funded) revert CommitmentNotFunded();

        address recipient = settlementStatus == Status.SuccessSettled
            ? commitment.successRecipient
            : commitment.failureRecipient;

        commitment.status = settlementStatus;
        commitment.token.safeTransfer(recipient, commitment.amount);

        emit CommitmentSettled(commitmentId, settlementStatus, recipient);
    }
}
