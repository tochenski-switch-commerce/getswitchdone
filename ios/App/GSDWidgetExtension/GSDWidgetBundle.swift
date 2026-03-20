import Foundation
import SwiftUI
import WidgetKit
import os

// MARK: - Shared Constants

enum GSDShared {
    static let appGroupID = "group.com.getswitchdone.boards"
    static let supabaseURL = "https://iwkwbvkmpetfcgdjqbgh.supabase.co"
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a3didmttcGV0ZmNnZGpxYmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTM2MTQsImV4cCI6MjA4ODM4OTYxNH0.tCMwpfFh1tLlBI0QneIU2brKimpZXxZJeszF5roi0Pk"

    // UserDefaults keys stored in the App Group
    static let accessTokenKey = "supabase_access_token"
    static let refreshTokenKey = "supabase_refresh_token"
    static let userIdKey = "supabase_user_id"

    // Deep link URL scheme
    static let urlScheme = "gsdboards"
}

// MARK: - Widget Models

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

// MARK: - Supabase Client

/// Lightweight Supabase REST client for the widget extension.
/// Uses URLSession directly — no third-party dependencies.
actor SupabaseClient {
    private static let logger = Logger(subsystem: "com.getswitchdone.boards.widget", category: "SupabaseClient")
    private let baseURL: String
    private let anonKey: String
    private var accessToken: String?
    private var refreshToken: String?

    init() {
        self.baseURL = GSDShared.supabaseURL
        self.anonKey = GSDShared.supabaseAnonKey

        // Read the current tokens from App Group storage
        if let defaults = UserDefaults(suiteName: GSDShared.appGroupID) {
            self.accessToken = defaults.string(forKey: GSDShared.accessTokenKey)
            self.refreshToken = defaults.string(forKey: GSDShared.refreshTokenKey)
            let hasAccess = self.accessToken != nil
            let hasRefresh = self.refreshToken != nil
            Self.logger.info("Token loaded: \(hasAccess ? "yes" : "no"), refresh: \(hasRefresh ? "yes" : "no")")
        } else {
            Self.logger.error("Cannot access App Group UserDefaults")
        }
    }

    var isAuthenticated: Bool {
        accessToken != nil
    }

    // MARK: Token refresh

    /// Try to refresh the Supabase session using the stored refresh token.
    private func refreshSession() async -> Bool {
        guard let rt = refreshToken else {
            Self.logger.warning("No refresh token available")
            return false
        }

        guard let url = URL(string: "\(baseURL)/auth/v1/token?grant_type=refresh_token") else { return false }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try? JSONEncoder().encode(["refresh_token": rt])

        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse else { return false }
            Self.logger.info("Refresh token response: \(http.statusCode)")
            guard http.statusCode == 200 else { return false }

            struct TokenResponse: Codable {
                let access_token: String
                let refresh_token: String
            }
            let tokens = try JSONDecoder().decode(TokenResponse.self, from: data)
            self.accessToken = tokens.access_token
            self.refreshToken = tokens.refresh_token

            // Persist the new tokens
            if let defaults = UserDefaults(suiteName: GSDShared.appGroupID) {
                defaults.set(tokens.access_token, forKey: GSDShared.accessTokenKey)
                defaults.set(tokens.refresh_token, forKey: GSDShared.refreshTokenKey)
                defaults.synchronize()
            }
            Self.logger.info("Token refreshed successfully")
            return true
        } catch {
            Self.logger.error("Token refresh failed: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: Generic query

    private func request(
        table: String,
        query: [String: String],
        headers: [String: String] = [:]
    ) async throws -> Data {
        var components = URLComponents(string: "\(baseURL)/rest/v1/\(table)")!
        components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }

        var req = URLRequest(url: components.url!)
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        if let token = accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        for (key, value) in headers {
            req.setValue(value, forHTTPHeaderField: key)
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        // If 401, try refreshing the token and retry once
        if http.statusCode == 401 {
            Self.logger.warning("Got 401 for \(table), attempting token refresh")
            if await refreshSession() {
                // Retry with new token
                req.setValue("Bearer \(self.accessToken!)", forHTTPHeaderField: "Authorization")
                let (retryData, retryResponse) = try await URLSession.shared.data(for: req)
                guard let retryHttp = retryResponse as? HTTPURLResponse, (200...299).contains(retryHttp.statusCode) else {
                    Self.logger.error("Retry after refresh failed for \(table)")
                    throw URLError(.userAuthenticationRequired)
                }
                return retryData
            }
            throw URLError(.userAuthenticationRequired)
        }

        guard (200...299).contains(http.statusCode) else {
            Self.logger.error("\(table) returned \(http.statusCode)")
            throw URLError(.badServerResponse)
        }
        return data
    }

    // MARK: Fetch notifications

    func fetchNotifications(limit: Int = 5) async throws -> (unread: Int, items: [WidgetNotification]) {
        guard isAuthenticated else { return (0, []) }

        let data = try await request(
            table: "notifications",
            query: [
                "select": "id,type,title,body,is_read,board_id,card_id,created_at",
                "order": "created_at.desc",
                "limit": "\(limit)",
                "is_read": "eq.false",
            ]
        )
        let items: [WidgetNotification] = try JSONDecoder().decode([WidgetNotification].self, from: data)

        let countData = try await request(
            table: "notifications",
            query: [
                "select": "id",
                "is_read": "eq.false",
            ],
            headers: ["Prefer": "count=exact"]
        )
        let allUnread: [WidgetNotification] = try JSONDecoder().decode([WidgetNotification].self, from: countData)
        return (allUnread.count, items)
    }

    // MARK: Fetch due cards

    func fetchDueCards() async throws -> [WidgetCard] {
        guard isAuthenticated else { return [] }
        guard let defaults = UserDefaults(suiteName: GSDShared.appGroupID),
              let userId = defaults.string(forKey: GSDShared.userIdKey) else { return [] }

        let today = Self.dateString(for: Date())

        let data = try await request(
            table: "board_cards",
            query: [
                "select": "id,title,priority,due_date,board_id",
                "due_date": "lte.\(today)",
                "is_archived": "eq.false",
                "or": "(assignee.eq.\(userId),assignees.cs.[\"\(userId)\"])",
                "order": "due_date.asc",
                "limit": "10",
            ]
        )
        return try JSONDecoder().decode([WidgetCard].self, from: data)
    }

    // MARK: Fetch boards

    func fetchBoards(limit: Int = 4) async throws -> [WidgetBoard] {
        guard isAuthenticated else { return [] }

        let data = try await request(
            table: "project_boards",
            query: [
                "select": "id,title,icon",
                "is_archived": "eq.false",
                "order": "updated_at.desc.nullsfirst,created_at.desc",
                "limit": "\(limit)",
            ]
        )
        return try JSONDecoder().decode([WidgetBoard].self, from: data)
    }

    // MARK: Fetch all widget data

    func fetchWidgetData() async -> WidgetData {
        guard isAuthenticated else {
            Self.logger.warning("Not authenticated — no access token in App Group")
            return WidgetData(
                unreadCount: 0, notifications: [], dueCards: [], boards: [],
                isLoggedIn: false, debugError: "No token in App Group"
            )
        }

        Self.logger.info("Fetching widget data...")

        do {
            let (unread, notifications) = try await fetchNotifications()
            Self.logger.info("Notifications: \(unread) unread, \(notifications.count) items")

            let dueCards = try await fetchDueCards()
            Self.logger.info("Due cards: \(dueCards.count)")

            let boards = try await fetchBoards()
            Self.logger.info("Boards: \(boards.count)")

            return WidgetData(
                unreadCount: unread,
                notifications: notifications,
                dueCards: dueCards,
                boards: boards,
                isLoggedIn: true,
                debugError: nil
            )
        } catch {
            Self.logger.error("fetchWidgetData failed: \(error.localizedDescription)")
            return WidgetData(
                unreadCount: 0, notifications: [], dueCards: [], boards: [],
                isLoggedIn: true, debugError: error.localizedDescription
            )
        }
    }

    private static func dateString(for date: Date) -> String {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        return df.string(from: date)
    }
}

// MARK: - Timeline Provider

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
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}

// MARK: - Color Theme (matching Lumio dark mode)

extension Color {
    static let gsdBackground = Color(red: 0.059, green: 0.067, blue: 0.090) // #0f1117
    static let gsdSurface = Color(red: 0.078, green: 0.086, blue: 0.125)    // #141620
    static let gsdBorder = Color(red: 0.165, green: 0.176, blue: 0.227)     // #2a2d3a
    static let gsdTextPrimary = Color.white
    static let gsdTextSecondary = Color(white: 0.55)
    static let gsdBlue = Color(red: 0.235, green: 0.478, blue: 0.859)       // #3c7adb
    static let gsdRed = Color(red: 0.886, green: 0.263, blue: 0.263)
    static let gsdOrange = Color(red: 0.949, green: 0.620, blue: 0.173)
    static let gsdPurple = Color(red: 0.627, green: 0.369, blue: 0.878)
    static let gsdTeal = Color(red: 0.173, green: 0.812, blue: 0.737)
    static let gsdGreen = Color(red: 0.322, green: 0.800, blue: 0.478)
}

// MARK: - Notification Styling

private struct NotificationStyle {
    let icon: String  // SF Symbol name
    let color: Color

    static func forType(_ type: String) -> NotificationStyle {
        switch type {
        case "comment":         return NotificationStyle(icon: "bubble.left.fill", color: .gsdBlue)
        case "assignment":      return NotificationStyle(icon: "person.fill", color: .gsdPurple)
        case "due_soon":        return NotificationStyle(icon: "clock.fill", color: .gsdOrange)
        case "overdue":         return NotificationStyle(icon: "exclamationmark.triangle.fill", color: .gsdRed)
        case "email_unrouted":  return NotificationStyle(icon: "envelope.fill", color: .gsdTeal)
        case "mention":         return NotificationStyle(icon: "at", color: .gsdBlue.opacity(0.7))
        default:                return NotificationStyle(icon: "bell.fill", color: .gsdBlue)
        }
    }
}

// MARK: - Medium Widget View

struct MediumWidgetView: View {
    let data: WidgetData

    var body: some View {
        if !data.isLoggedIn {
            signInPrompt
        } else {
            HStack(spacing: 10) {
                // Left: Inbox + recent notifications
                VStack(alignment: .leading, spacing: 6) {
                    Link(destination: URL(string: "\(GSDShared.urlScheme)://inbox")!) {
                        HStack(spacing: 6) {
                            Image(systemName: "bell.fill")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.gsdBlue)
                            Text("Inbox")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.gsdTextPrimary)
                            if data.unreadCount > 0 {
                                Text("\(data.unreadCount)")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 1)
                                    .background(Capsule().fill(Color.gsdRed))
                            }
                            Spacer()
                        }
                    }

                    if data.notifications.isEmpty {
                        Text("All caught up!")
                            .font(.system(size: 12))
                            .foregroundColor(.gsdTextSecondary)
                            .frame(maxHeight: .infinity)
                    } else {
                        ForEach(data.notifications.prefix(3)) { notif in
                            notificationRow(notif)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity)

                // Right: Actions
                VStack(spacing: 8) {
                    Link(destination: URL(string: "\(GSDShared.urlScheme)://add-card")!) {
                        VStack(spacing: 4) {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 22))
                                .foregroundColor(.gsdGreen)
                            Text("Add Card")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.gsdTextSecondary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.gsdSurface)
                        .cornerRadius(10)
                    }

                    Link(destination: URL(string: "\(GSDShared.urlScheme)://boards")!) {
                        VStack(spacing: 4) {
                            Image(systemName: "square.grid.2x2.fill")
                                .font(.system(size: 22))
                                .foregroundColor(.gsdBlue)
                            Text("Boards")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.gsdTextSecondary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.gsdSurface)
                        .cornerRadius(10)
                    }
                }
                .frame(width: 80)
            }
            .padding(10)
        }
    }

    private func notificationRow(_ notif: WidgetNotification) -> some View {
        let style = NotificationStyle.forType(notif.type)
        return Link(destination: Self.notificationURL(notif)) {
            HStack(spacing: 6) {
                Image(systemName: style.icon)
                    .font(.system(size: 10))
                    .foregroundColor(style.color)
                    .frame(width: 16, height: 16)
                VStack(alignment: .leading, spacing: 1) {
                    Text(notif.title)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.gsdTextPrimary)
                        .lineLimit(1)
                    Text(notif.timeAgo)
                        .font(.system(size: 9))
                        .foregroundColor(.gsdTextSecondary)
                }
                Spacer(minLength: 0)
            }
        }
    }

    private static func notificationURL(_ notif: WidgetNotification) -> URL {
        if let boardId = notif.board_id, let cardId = notif.card_id {
            return URL(string: "\(GSDShared.urlScheme)://board/\(boardId)?card=\(cardId)")!
        } else if let boardId = notif.board_id {
            return URL(string: "\(GSDShared.urlScheme)://board/\(boardId)")!
        }
        return URL(string: "\(GSDShared.urlScheme)://inbox")!
    }

    private var signInPrompt: some View {
        Link(destination: URL(string: "\(GSDShared.urlScheme)://auth")!) {
            HStack(spacing: 12) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 28))
                    .foregroundColor(.gsdBlue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Sign in to Lumio")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.gsdTextPrimary)
                    Text("Tap to open the app")
                        .font(.system(size: 12))
                        .foregroundColor(.gsdTextSecondary)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding()
        }
    }
}

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
