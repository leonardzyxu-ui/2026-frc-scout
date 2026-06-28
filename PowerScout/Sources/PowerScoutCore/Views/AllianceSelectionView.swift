import SwiftUI

struct AllianceSelectionView: View {
    private let steps = [
        ("Before selection", "Export the latest Forecast Ledger, freeze the current pick list, and mark teams with reliability, role, and compatibility concerns."),
        ("During selection", "Enter Taken, Declined, Unavailable, or Our Pick immediately after every public pick so the next recommendation is honest."),
        ("When deciding", "Prefer role fit plus trust over raw ceiling. Use blocker choices only when denying an opponent clearly outweighs our own fit."),
        ("After each change", "Re-check expected range, defense impact, tail risk, and whether the remaining teams match our alliance’s missing job.")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "Last-day speed",
                title: "Alliance Selection Prep",
                subtitle: "PowerScout treats alliance selection as a live decision room: fast status updates, role fit, trust, and opponent-denial logic."
            )

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 14)], spacing: 14) {
                ForEach(steps, id: \.0) { title, detail in
                    PSCard {
                        VStack(alignment: .leading, spacing: 10) {
                            PSTag(text: title, color: .blue)
                            Text(detail)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Dynamic strategy logic")
                        .font(.title3.weight(.bold))
                    labeled("Primary choice", "Best current role-combination gain after contribution, defense, deviation, and RP paths are considered.")
                    labeled("Backup choice", "Next best option if the primary is taken or declines, recalculated from the remaining team pool.")
                    labeled("Swing choice", "Higher-deviation plan when we are behind and need a smart gamble.")
                    labeled("Blocker choice", "A denial pick only when the opponent’s gain is worse than our fit sacrifice.")
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Strategy safeties")
                        .font(.title3.weight(.bold))
                    ForEach(PowerScoutKnowledgeBase.strategySafeties) { safety in
                        labeled(safety.title, safety.detail)
                    }
                }
            }
        }
    }

    private func labeled(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "target")
                .foregroundStyle(.blue)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(label)
                    .font(.headline)
                Text(value)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
