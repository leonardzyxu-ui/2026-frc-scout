import SwiftUI

struct DashboardView: View {
    let store: PowerScoutStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "Powerhouse scouting",
                title: "PowerScout",
                subtitle: "A native command center for match-day readiness, prediction evidence, and the uncomfortable but important question: are our scouting lanes actually prepared?"
            )

            NextMatchDashboardView(loadResult: store.nextMatchDashboardLoadResult) {
                store.refreshNextMatchDashboardSnapshot()
            }
        }
    }
}
