import WidgetKit
import SwiftUI

struct GSDEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct GSDTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> GSDEntry {
        GSDEntry(date: Date(), data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (GSDEntry) -> Void) {
        if context.isPreview {
            completion(GSDEntry(date: Date(), data: .placeholder))
            return
        }
        Task {
            let client = SupabaseClient()
            let data = await client.fetchWidgetData()
            completion(GSDEntry(date: Date(), data: data))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GSDEntry>) -> Void) {
        Task {
            let client = SupabaseClient()
            let data = await client.fetchWidgetData()
            let entry = GSDEntry(date: Date(), data: data)
            // Refresh every 15 minutes
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}
