import SwiftUI
import WidgetKit

// MARK: - Main Home Screen Widget

struct GSDWidget: Widget {
    let kind = "GSDWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GSDTimelineProvider()) { entry in
            GSDWidgetEntryView(entry: entry)
                .containerBackground(Color.gsdBackground, for: .widget)
        }
        .configurationDisplayName("GSD Boards")
        .description("Inbox, due cards, and quick actions at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct GSDWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: GSDEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(data: entry.data)
        case .systemMedium:
            MediumWidgetView(data: entry.data)
        case .systemLarge:
            LargeWidgetView(data: entry.data)
        default:
            SmallWidgetView(data: entry.data)
        }
    }
}

// MARK: - Lock Screen Accessory Widgets (iOS 16+)

struct GSDInboxAccessoryWidget: Widget {
    let kind = "GSDInboxAccessory"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GSDTimelineProvider()) { entry in
            InboxAccessoryWidget(data: entry.data)
        }
        .configurationDisplayName("GSD Inbox")
        .description("Unread notification count.")
        .supportedFamilies([.accessoryInline, .accessoryRectangular])
    }
}

struct GSDDueAccessoryWidget: Widget {
    let kind = "GSDDueAccessory"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GSDTimelineProvider()) { entry in
            DueAccessoryWidget(data: entry.data)
        }
        .configurationDisplayName("GSD Due Cards")
        .description("Cards due today count.")
        .supportedFamilies([.accessoryInline, .accessoryRectangular])
    }
}

// MARK: - Widget Bundle

@main
struct GSDWidgetBundle: WidgetBundle {
    var body: some Widget {
        GSDWidget()
        GSDInboxAccessoryWidget()
        GSDDueAccessoryWidget()
    }
}

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    GSDWidget()
} timeline: {
    GSDEntry(date: Date(), data: .placeholder)
}

#Preview("Medium", as: .systemMedium) {
    GSDWidget()
} timeline: {
    GSDEntry(date: Date(), data: .placeholder)
}

#Preview("Large", as: .systemLarge) {
    GSDWidget()
} timeline: {
    GSDEntry(date: Date(), data: .placeholder)
}
