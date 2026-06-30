import SwiftUI

struct PowerScoutNotesPad: View {
    @Bindable var store: PowerScoutStore
    let section: PowerScoutSection
    var expandedWidth: CGFloat = 340
    @State private var isCollapsed = false
    @State private var draftText = ""
    @State private var pendingSaveTask: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "square.and.pencil")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.cyan)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Section Notes")
                        .font(.caption.weight(.heavy))
                        .tracking(1.5)
                        .foregroundStyle(.secondary)
                    Text(section.rawValue)
                        .font(.headline.weight(.black))
                        .lineLimit(1)
                }
                Spacer()
                Button {
                    withAnimation(.snappy(duration: 0.18)) {
                        isCollapsed.toggle()
                    }
                } label: {
                    Image(systemName: isCollapsed ? "chevron.up" : "chevron.down")
                }
                .buttonStyle(.plain)
                .help(isCollapsed ? "Expand notes" : "Collapse notes")
            }

            if !isCollapsed {
                TextEditor(text: $draftText)
                    .font(.callout.monospaced())
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .frame(height: 116)
                    .background(Color.black.opacity(0.24), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(.separator.opacity(0.32), lineWidth: 1)
                    )

                HStack(spacing: 8) {
                    Button {
                        flushDraft()
                        _ = store.exportAllNotes()
                    } label: {
                        Label("Export JSON", systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(.borderedProminent)

                    if let url = store.lastNotesExportURL {
                        Text(url.path)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    } else {
                        Text("\(store.notesBySection.count) saved section\(store.notesBySection.count == 1 ? "" : "s")")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }

                if let saveError = store.lastNotesSaveError {
                    Label(saveError, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.yellow)
                        .lineLimit(2)
                }
            }
        }
        .padding(14)
        .frame(width: panelWidth, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(.separator.opacity(0.5), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.22), radius: 24, x: 0, y: 12)
        .onAppear {
            draftText = store.noteText(for: section)
        }
        .onChange(of: section) { _, newSection in
            pendingSaveTask?.cancel()
            draftText = store.noteText(for: newSection)
        }
        .onChange(of: draftText) { _, newValue in
            scheduleSave(newValue, for: section)
        }
    }

    private var panelWidth: CGFloat {
        isCollapsed ? min(260, expandedWidth) : expandedWidth
    }

    private func scheduleSave(_ text: String, for section: PowerScoutSection) {
        pendingSaveTask?.cancel()
        pendingSaveTask = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            store.updateNoteText(text, for: section)
        }
    }

    private func flushDraft() {
        pendingSaveTask?.cancel()
        store.updateNoteText(draftText, for: section)
    }
}
