import FamilyControls
import SwiftUI

struct ContentView: View {
    @StateObject private var screenTimeController = ScreenTimeGoalController()
    @StateObject private var walletService = WalletService()
    @State private var isActivityPickerPresented = false
    @State private var draftWalletAddress = ""

    var body: some View {
        CommitmentRootView(
            screenTimeController: screenTimeController,
            walletService: walletService,
            isActivityPickerPresented: $isActivityPickerPresented,
            draftWalletAddress: $draftWalletAddress
        )
        .familyActivityPicker(
            isPresented: $isActivityPickerPresented,
            selection: $screenTimeController.selection
        )
    }
}

private struct CommitmentRootView: View {
    @ObservedObject var screenTimeController: ScreenTimeGoalController
    @ObservedObject var walletService: WalletService
    @Binding var isActivityPickerPresented: Bool
    @Binding var draftWalletAddress: String
    @StateObject private var viewModel: CommitmentViewModel

    init(
        screenTimeController: ScreenTimeGoalController,
        walletService: WalletService,
        isActivityPickerPresented: Binding<Bool>,
        draftWalletAddress: Binding<String>
    ) {
        self.screenTimeController = screenTimeController
        self.walletService = walletService
        self._isActivityPickerPresented = isActivityPickerPresented
        self._draftWalletAddress = draftWalletAddress
        self._viewModel = StateObject(
            wrappedValue: CommitmentViewModel(screenTimeController: screenTimeController)
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                walletSection
                goalSection
                fundingSection
                proofSection
                statusSection
            }
            .navigationTitle("AutoCommit")
            .task {
                if let session = walletService.session {
                    viewModel.walletAddress = session.address
                }
            }
        }
    }

    private var walletSection: some View {
        Section("Wallet") {
            TextField("0x wallet address", text: $draftWalletAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button("Use wallet address") {
                walletService.configureManualWallet(address: draftWalletAddress)
                viewModel.walletAddress = draftWalletAddress
            }
            if let session = walletService.session {
                Text(session.address)
                    .font(.footnote.monospaced())
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var goalSection: some View {
        Section("One-day goal") {
            Picker("Goal", selection: $viewModel.goalKind) {
                ForEach(GoalKind.allCases) { kind in
                    Text(kind.title).tag(kind)
                }
            }
            .pickerStyle(.segmented)

            if viewModel.goalKind == .screenTime {
                Stepper("Limit: \(viewModel.screenTimeLimitMinutes) min", value: $viewModel.screenTimeLimitMinutes, in: 5...480, step: 5)
                Button("Choose apps") {
                    isActivityPickerPresented = true
                }
                Button("Authorize Screen Time") {
                    Task { try? await screenTimeController.requestAuthorization() }
                }
            } else {
                Stepper("Target: \(viewModel.stepTarget) steps", value: $viewModel.stepTarget, in: 1000...40000, step: 500)
            }

            TextField("Failure recipient wallet", text: $viewModel.failureRecipient)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            TextField("Token address", text: $viewModel.tokenAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            TextField("Amount in token units", text: $viewModel.amount)
                .keyboardType(.numberPad)

            Button("Create commitment draft") {
                Task { await viewModel.createDraft() }
            }
            .disabled(viewModel.isWorking)
        }
    }

    private var fundingSection: some View {
        Section("Funding") {
            if let commitment = viewModel.activeCommitment {
                Text(commitment.id)
                    .font(.caption.monospaced())
                    .textSelection(.enabled)
                TextField("Funding transaction hash", text: $viewModel.fundingTxHash)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Button("Verify funding") {
                    Task { await viewModel.verifyFunding() }
                }
            } else {
                Text("Create a draft before funding.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var proofSection: some View {
        Section("Proof") {
            Button("Submit goal proof") {
                Task { await viewModel.submitProof() }
            }
            .disabled(viewModel.activeCommitment == nil || viewModel.isWorking)
        }
    }

    private var statusSection: some View {
        Section("Status") {
            if let commitment = viewModel.activeCommitment {
                LabeledContent("State", value: commitment.status)
                LabeledContent("Target", value: "\(commitment.targetValue)")
                LabeledContent("Proof due", value: commitment.proofDueAt.formatted())
            }

            if !viewModel.message.isEmpty {
                Text(viewModel.message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

#Preview {
    ContentView()
}
