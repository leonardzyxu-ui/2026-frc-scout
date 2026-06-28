import PowerScoutCore
import SwiftUI

@main
struct PowerScoutApp: App {
    var body: some Scene {
        WindowGroup {
            PowerScoutContentView()
        }
        .defaultSize(width: 1280, height: 820)
        .commands {
            SidebarCommands()
        }
    }
}
