import SwiftUI

struct RelayView: View {
    let openURL: OpenURLAction
    @State private var selectedRegion: RelayDispatchRegion = .mainlandSanya

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "Low-latency alerts",
                title: "Relay strategy",
                subtitle: "Relay is useful for urgent scouting nudges, but it must not become the only record of predictions or evidence."
            )

            PSCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Relay region")
                        .font(.title3.weight(.bold))
                    Picker("Relay region", selection: $selectedRegion) {
                        ForEach(RelayDispatchRegion.allCases) { region in
                            Text(region.rawValue).tag(region)
                        }
                    }
                    .pickerStyle(.segmented)
                    Text(selectedRegion.dispatchRule)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 14)], spacing: 14) {
                ForEach(sortedCandidates) { candidate in
                    PSCard {
                        relayBlock(candidate)
                    }
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Relay dispatch rule")
                        .font(.title3.weight(.bold))
                    Text("\(selectedRegion.dispatchRule) Relays are for speed; Firebase, local exports, and the Forecast Ledger remain the durable record.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                    Text("Current \(selectedRegion.shortLabel) order: \(sortedCandidates.map(\.label).joined(separator: " -> ")).")
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Button {
                        openURL(URL(string: "https://directchat-relay.onrender.com/health")!)
                    } label: {
                        Label("Check DirectChat Health", systemImage: "heart.text.square")
                    }
                    .buttonStyle(.bordered)
                    Button {
                        openURL(URL(string: "https://directchat-relay.leonard-zy-xu.workers.dev/health")!)
                    } label: {
                        Label("Check Cloudflare Health", systemImage: "network")
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    private var sortedCandidates: [RelayDispatchCandidateSpec] {
        PowerScoutKnowledgeBase.relayDispatchCandidates.sorted {
            $0.order(in: selectedRegion) < $1.order(in: selectedRegion)
        }
    }

    private func relayBlock(_ candidate: RelayDispatchCandidateSpec) -> some View {
        let color = color(for: candidate.label)
        return VStack(alignment: .leading, spacing: 10) {
            PSTag(text: "\(selectedRegion.shortLabel) order \(candidate.order(in: selectedRegion))", color: color)
            Text(candidate.label)
                .font(.title3.weight(.bold))
            Text(candidate.role)
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
            Text(candidate.caveat)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Text(candidate.endpoint)
                .font(.caption)
                .foregroundStyle(.tertiary)
                .textSelection(.enabled)
        }
    }

    private func color(for label: String) -> Color {
        if label.contains("Cloudflare") { return .blue }
        if label.contains("DirectChat") { return .green }
        return .orange
    }
}
