import Foundation

/// Lightweight Supabase REST client for the widget extension.
/// Uses URLSession directly — no third-party dependencies.
actor SupabaseClient {
    private let baseURL: String
    private let anonKey: String
    private var accessToken: String?

    init() {
        self.baseURL = GSDShared.supabaseURL
        self.anonKey = GSDShared.supabaseAnonKey

        // Read the current access token from App Group storage
        if let defaults = UserDefaults(suiteName: GSDShared.appGroupID) {
            self.accessToken = defaults.string(forKey: GSDShared.accessTokenKey)
        }
    }

    var isAuthenticated: Bool {
        accessToken != nil
    }

    // MARK: - Generic query

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
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    // MARK: - Fetch unread notification count + recent notifications

    func fetchNotifications(limit: Int = 5) async throws -> (unread: Int, items: [WidgetNotification]) {
        guard isAuthenticated else { return (0, []) }

        // Fetch recent unread notifications (PostgREST)
        let data = try await request(
            table: "notifications",
            query: [
                "select": "id,type,title,body,is_read,board_id,card_id,created_at",
                "order": "created_at.desc",
                "limit": "\(limit)",
                "is_read": "eq.false",
            ]
        )
        let items = try JSONDecoder().decode([WidgetNotification].self, from: data)

        // Also get total unread count
        let countData = try await request(
            table: "notifications",
            query: [
                "select": "id",
                "is_read": "eq.false",
            ],
            headers: ["Prefer": "count=exact"]
        )
        // The count header approach: parse the array length
        let allUnread = try JSONDecoder().decode([WidgetNotification].self, from: countData)
        return (allUnread.count, items)
    }

    // MARK: - Fetch cards due today or overdue (assigned to current user)

    func fetchDueCards() async throws -> [WidgetCard] {
        guard isAuthenticated else { return [] }
        guard let defaults = UserDefaults(suiteName: GSDShared.appGroupID),
              let userId = defaults.string(forKey: GSDShared.userIdKey) else { return [] }

        let today = Self.dateString(for: Date())

        // Cards due today or earlier, assigned to current user, not archived
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

    // MARK: - Fetch recent boards

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

    // MARK: - Fetch all widget data at once

    func fetchWidgetData() async -> WidgetData {
        guard isAuthenticated else {
            return WidgetData.empty
        }

        async let notificationsTask = fetchNotifications()
        async let dueCardsTask = fetchDueCards()
        async let boardsTask = fetchBoards()

        do {
            let (unread, notifications) = try await notificationsTask
            let dueCards = try await dueCardsTask
            let boards = try await boardsTask

            return WidgetData(
                unreadCount: unread,
                notifications: notifications,
                dueCards: dueCards,
                boards: boards,
                isLoggedIn: true
            )
        } catch {
            // Return partial data if some queries fail
            return WidgetData(
                unreadCount: 0,
                notifications: [],
                dueCards: [],
                boards: [],
                isLoggedIn: true
            )
        }
    }

    private static func dateString(for date: Date) -> String {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        return df.string(from: date)
    }
}
