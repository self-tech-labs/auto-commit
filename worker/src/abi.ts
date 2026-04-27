export const commitmentEscrowAbi = [
  {
    type: "event",
    name: "CommitmentFunded",
    inputs: [
      { name: "commitmentId", type: "bytes32", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "successRecipient", type: "address", indexed: false },
      { name: "failureRecipient", type: "address", indexed: false },
      { name: "goalHash", type: "bytes32", indexed: false },
      { name: "startsAt", type: "uint64", indexed: false },
      { name: "endsAt", type: "uint64", indexed: false },
      { name: "proofDueAt", type: "uint64", indexed: false }
    ]
  },
  {
    type: "function",
    name: "settleSuccess",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitmentId", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "settleFailure",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitmentId", type: "bytes32" }],
    outputs: []
  }
] as const;
