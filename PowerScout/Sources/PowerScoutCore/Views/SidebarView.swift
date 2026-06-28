import SwiftUI

struct SidebarView: View {
    @Bindable var store: PowerScoutStore

    var body: some View {
        List(PowerScoutSection.allCases, selection: $store.selection) { section in
            Label(section.rawValue, systemImage: section.symbolName)
                .tag(section)
        }
        .listStyle(.sidebar)
        .navigationTitle("PowerScout")
        .safeAreaInset(edge: .bottom) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Powerhouse")
                    .font(.caption.weight(.bold))
                Text("Scouting command center")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
        }
    }
}
