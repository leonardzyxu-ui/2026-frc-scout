import SwiftUI

struct ReportsView: View {
    let store: PowerScoutStore
    let openURL: OpenURLAction

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "Evidence",
                title: "Reports and proof",
                subtitle: "Open the artifacts that sell the scouting system and preserve model evidence."
            )

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 14)], spacing: 14) {
                reportCard(
                    title: "HTML Morning Report",
                    detail: "Business-style progress report from the overnight scouting work.",
                    systemImage: "doc.richtext",
                    url: PowerScoutPaths.reportURL(repoRoot: store.repositoryRoot)
                )
                reportCard(
                    title: "Matchday Operator Card",
                    detail: "Compact field-side instructions for practice, qualifications, judges, and alliance selection.",
                    systemImage: "checklist",
                    url: PowerScoutPaths.operatorCardURL(repoRoot: store.repositoryRoot)
                )
                reportCard(
                    title: "Relay Engine Plan",
                    detail: "The Button primary, DirectChat mainland backup, Cloudflare global/VPN fallback, and safety limits.",
                    systemImage: "antenna.radiowaves.left.and.right",
                    url: PowerScoutPaths.relayPlanURL(repoRoot: store.repositoryRoot)
                )
                reportCard(
                    title: "PPT Background Screenshot",
                    detail: "Scouting website image intended for presentation background use.",
                    systemImage: "photo",
                    url: PowerScoutPaths.pptScreenshotURL(repoRoot: store.repositoryRoot)
                )
            }
        }
    }

    private func reportCard(title: String, detail: String, systemImage: String, url: URL) -> some View {
        PSCard {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: systemImage)
                    .font(.title2)
                    .foregroundStyle(.blue)
                Text(title)
                    .font(.headline)
                Text(detail)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Button {
                    openURL(url)
                } label: {
                    Label("Open", systemImage: "arrow.up.right.square")
                }
                .buttonStyle(.bordered)
            }
        }
    }
}
