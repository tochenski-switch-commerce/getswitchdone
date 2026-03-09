import Foundation

struct WidgetNotification: Codable, Identifiable {
    let id: String
    let type: String
    let title: String
    let body: String?
    let is_read: Bool
    let board_id: String?
    let card_id: String?
    let created_at: String

    var timeAgo: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: created_at) else {
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: created_at) else { return "" }
            return Self.relativeTime(from: date)
        }
        return Self.relativeTime(from: date)
    }

    private static func relativeTime(from date: Date) -> String {
        let seconds = Int(Date().timeIntervalSince(date))
        if seconds < 60 { return "\(seconds)s" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h" }
        let days = hours / 24
        if days < 7 { return "\(days)d" }
        let df = DateFormatter()
        df.dateFormat = "MMM d"
        return df.string(from: date)
    }
}

struct WidgetCard: Codable, Identifiable {
    let id: String
    let title: String
    let priority: String?
    let due_date: String?
    let board_id: String?

    var isDueToday: Bool {
        guard let due = due_date else { return false }
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        guard let dueDate = df.date(from: due) else { return false }
        return Calendar.current.isDateInToday(dueDate)
    }

    var isOverdue: Bool {
        guard let due = due_date else { return false }
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        guard let dueDate = df.date(from: due) else { return false }
        return dueDate < Calendar.current.startOfDay(for: Date())
    }
}

struct WidgetBoard: Codable, Identifiable {
    let id: String
    let title: String
    let icon: String?
}

struct WidgetData {
    var unreadCount: Int
    var notifications: [WidgetNotification]
    var dueCards: [WidgetCard]
    var boards: [WidgetBoard]
    var isLoggedIn: Bool
    var debugError: String?

    static let empty = WidgetData(
        unreadCount: 0,
        notifications: [],
        dueCards: [],
        boards: [],
        isLoggedIn: false,
        debugError: nil
    )

    static let placeholder = WidgetData(
        unreadCount: 3,
        notifications: [
            WidgetNotification(id: "1", type: "comment", title: "New comment on Homepage Redesign", body: "Looks great!", is_read: false, board_id: nil, card_id: nil, created_at: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-300))),
            WidgetNotification(id: "2", type: "due_soon", title: "Due soon: API Integration", body: nil, is_read: false, board_id: nil, card_id: nil, created_at: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-3600))),
            WidgetNotification(id: "3", type: "assignment", title: "You were assigned to Bug Fix", body: nil, is_read: false, board_id: nil, card_id: nil, created_at: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-7200))),
        ],
        dueCards: [
            WidgetCard(id: "1", title: "Homepage Redesign", priority: "high", due_date: "2026-03-08", board_id: nil),
            WidgetCard(id: "2", title: "API Integration", priority: "medium", due_date: "2026-03-08", board_id: nil),
        ],
        boards: [
            WidgetBoard(id: "1", title: "Product Launch", icon: "rocket"),
            WidgetBoard(id: "2", title: "Bug Tracker", icon: "target"),
        ],
        isLoggedIn: true,
        debugError: nil
    )
}
