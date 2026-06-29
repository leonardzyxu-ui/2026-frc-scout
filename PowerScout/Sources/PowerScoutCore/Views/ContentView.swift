import SwiftUI

public struct PowerScoutContentView: View {
    @State private var store = PowerScoutStore()
    @Environment(\.openURL) private var openURL

    public init() {}

    public var body: some View {
        NavigationSplitView {
            SidebarView(store: store)
        } detail: {
            detailView
                .frame(minWidth: 760, minHeight: 620)
                .toolbar {
                    ToolbarItemGroup {
                        Button {
                            openURL(PowerScoutPaths.adminV4URL)
                        } label: {
                            Label("Admin V4", systemImage: "safari")
                        }
                        Button {
                            openURL(PowerScoutPaths.adminV2PredictionURL)
                        } label: {
                            Label("Prediction Graph", systemImage: "chart.xyaxis.line")
                        }
                    }
                }
        }
    }

    @ViewBuilder
    private var detailView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                switch store.selection {
                case .dashboard:
                    DashboardView(store: store, openURL: openURL)
                case .liveOps:
                    LiveOpsView(store: store)
                case .systemAudit:
                    SystemAuditView()
                case .preScout:
                    ScoutLaneView(lane: .preScout)
                case .pitScout:
                    ScoutLaneView(lane: .pitScout)
                case .matchScout:
                    ScoutLaneView(lane: .matchScout)
                case .allianceSelection:
                    AllianceSelectionView()
                case .historyRewards:
                    HistoryRewardsView(openURL: openURL)
                case .reports:
                    ReportsView(store: store, openURL: openURL)
                case .relay:
                    RelayView(openURL: openURL)
                case .commands:
                    CommandsView(store: store)
                }
            }
            .padding(24)
            .frame(maxWidth: 1180, alignment: .leading)
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
}
