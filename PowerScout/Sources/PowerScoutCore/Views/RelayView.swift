import SwiftUI

struct RelayView: View {
    let openURL: OpenURLAction

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "Low-latency alerts",
                title: "Relay strategy",
                subtitle: "Relay is useful for urgent scouting nudges, but it must not become the only record of predictions or evidence."
            )

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 14)], spacing: 14) {
                ForEach(PowerScoutKnowledgeBase.relayDispatchCandidates.sorted { $0.mainlandOrder < $1.mainlandOrder }) { candidate in
                    PSCard {
                        relayBlock(candidate)
                    }
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Relay dispatch rule")
                        .font(.title3.weight(.bold))
                    Text("For Sanya or mainland China, try The Button, then DirectChat, then Cloudflare only with VPN/global access. Relays are for speed; Firebase, local exports, and the Forecast Ledger remain the durable record.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                    Text("Global/VPN order: The Button -> Cloudflare DirectChat -> DirectChat.")
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

    private func relayBlock(_ candidate: RelayDispatchCandidateSpec) -> some View {
        let color = color(for: candidate.label)
        return VStack(alignment: .leading, spacing: 10) {
            PSTag(text: "Mainland order \(candidate.mainlandOrder)", color: color)
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
