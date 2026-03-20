import Foundation
import os

private let logger = Logger(subsystem: "com.getswitchdone.boards.widget", category: "SupabaseClient")

/// Lightweight Supabase REST client for the widget extension.
/// Uses URLSession directly — no third-party dependencies.
actor SupabaseClient {
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
            logger.info("Token loaded: \(hasAccess ? "yes" : "no"), refresh: \(hasRefresh ? "yes" : "no")")
        } else {
            logger.error("Cannot access App Group UserDefaults")
        }
    }

    var isAuthenticated: Bool {
        accessToken != nil
    }

    // MARK: - Token refresh

    /// Try to refresh the Supabase session using the stored refresh token.
    private func refreshSession() async -> Bool {
        guard let rt = refreshToken else {
            logger.warning("No refresh token available")
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
            logger.info("Refresh token response: \(http.statusCode)")
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
            logger.info("Token refreshed successfully")
            return true
        } catch {
            logger.error("Token refresh failed: \(error.localizedDescription)")
            return false
        }
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
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        // If 401, try refreshing the token and retry once
        if http.statusCode == 401 {
            logger.warning("Got 401 for \(table), attempting token refresh")
            if await refreshSession() {
                // Retry with new token
                req.setValue("Bearer \(self.accessToken!)", forHTTPHeaderField: "Authorization")
                let (retryData, retryResponse) = try await URLSession.shared.data(for: req)
                guard let retryHttp = retryResponse as? HTTPURLResponse, (200...299).contains(retryHttp.statusCode) else {
                    logger.error("Retry after refresh failed for \(table)")
                    throw URLError(.userAuthenticationRequired)
                }
                return retryData
            }
            throw URLError(.userAuthenticationRequired)
        }

        guard (200...299).contains(http.statusCode) else {
            logger.error("\(table) returned \(http.statusCode)")
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
            logger.warning("Not authenticated — no access token in App Group")
            return WidgetData(
                unreadCount: 0, notifications: [], dueCards: [], boards: [],
                isLoggedIn: false, debugError: "No token in App Group"
            )
        }

        logger.info("Fetching widget data...")

        do {
            // Fetch sequentially to isolate failures
            let (unread, notifications) = try await fetchNotifications()
            logger.info("Notifications: \(unread) unread, \(notifications.count) items")

            let dueCards = try await fetchDueCards()
            logger.info("Due cards: \(dueCards.count)")

            let boards = try await fetchBoards()
            logger.info("Boards: \(boards.count)")

            return WidgetData(
                unreadCount: unread,
                notifications: notifications,
                dueCards: dueCards,
                boards: boards,
                isLoggedIn: true,
                debugError: nil
            )
        } catch {
            logger.error("fetchWidgetData failed: \(error.localizedDescription)")
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
