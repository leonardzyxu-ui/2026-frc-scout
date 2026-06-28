// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "PowerScout",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "PowerScout", targets: ["PowerScout"]),
        .library(name: "PowerScoutCore", targets: ["PowerScoutCore"])
    ],
    targets: [
        .executableTarget(
            name: "PowerScout",
            dependencies: ["PowerScoutCore"]
        ),
        .target(
            name: "PowerScoutCore"
        ),
        .testTarget(
            name: "PowerScoutCoreTests",
            dependencies: ["PowerScoutCore"]
        )
    ]
)
