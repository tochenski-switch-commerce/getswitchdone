import SwiftUI
import WidgetKit

// MARK: - Main Home Screen Widget

struct GSDWidget: Widget {
    let kind = "GSDWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GSDTimelineProvider()) { entry in
            MediumWidgetView(data: entry.data)
                .containerBackground(Color.gsdBackground, for: .widget)
        }
        .configurationDisplayName("Lumio")
        .description("Inbox, due cards, and quick actions at a glance.")
        .supportedFamilies([.systemMedium])
    }
}

// MARK: - Widget Bundle

@main
struct GSDWidgetBundle: WidgetBundle {
    var body: some Widget {
        GSDWidget()
    }
}

// MARK: - Previews

#Preview("Medium", as: .systemMedium) {
    GSDWidget()
} timeline: {
    GSDEntry(date: Date(), data: .placeholder)
}
