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
        .navigationSplitViewColumnWidth(min: 235, ideal: 250, max: 300)
    }
}
