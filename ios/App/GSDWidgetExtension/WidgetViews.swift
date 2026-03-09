import SwiftUI
import WidgetKit

// MARK: - Color theme (matching GSD dark mode)

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

// MARK: - Notification type helpers

struct NotificationStyle {
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

// MARK: - Small Widget (Inbox Count + Quick Add)

struct SmallWidgetView: View {
    let data: WidgetData

    var body: some View {
        if !data.isLoggedIn {
            signInPrompt
        } else {
            VStack(spacing: 12) {
                // Inbox button
                Link(destination: URL(string: "\(GSDShared.urlScheme)://inbox")!) {
                    HStack(spacing: 8) {
                        Image(systemName: "bell.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.gsdBlue)
                        Text("Inbox")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.gsdTextPrimary)
                        Spacer()
                        if data.unreadCount > 0 {
                            Text("\(data.unreadCount)")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(Color.gsdRed))
                        }
                    }
                    .padding(12)
                    .background(Color.gsdSurface)
                    .cornerRadius(12)
                }

                // Quick Add button
                Link(destination: URL(string: "\(GSDShared.urlScheme)://add-card")!) {
                    HStack(spacing: 8) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.gsdGreen)
                        Text("Add Card")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.gsdTextPrimary)
                        Spacer()
                    }
                    .padding(12)
                    .background(Color.gsdSurface)
                    .cornerRadius(12)
                }
            }
            .padding(8)
        }
    }

    private var signInPrompt: some View {
        Link(destination: URL(string: "\(GSDShared.urlScheme)://auth")!) {
            VStack(spacing: 8) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 28))
                    .foregroundColor(.gsdBlue)
                Text("Sign in to")
                    .font(.system(size: 13))
                    .foregroundColor(.gsdTextSecondary)
                Text("GSD Boards")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.gsdTextPrimary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

// MARK: - Medium Widget (Inbox + Notifications + Quick Add)

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
        return Link(destination: notificationURL(notif)) {
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

    private var signInPrompt: some View {
        Link(destination: URL(string: "\(GSDShared.urlScheme)://auth")!) {
            HStack(spacing: 12) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 28))
                    .foregroundColor(.gsdBlue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Sign in to GSD Boards")
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

// MARK: - Large Widget (Due Cards + Inbox + Actions + Boards)

struct LargeWidgetView: View {
    let data: WidgetData

    var body: some View {
        if !data.isLoggedIn {
            MediumWidgetView(data: data)
        } else {
            VStack(spacing: 8) {
                // Top row: Inbox header + action buttons
                HStack(spacing: 8) {
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
                        }
                    }
                    Spacer()
                    Link(destination: URL(string: "\(GSDShared.urlScheme)://add-card")!) {
                        HStack(spacing: 4) {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 12))
                                .foregroundColor(.gsdGreen)
                            Text("Add Card")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.gsdGreen)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.gsdGreen.opacity(0.15))
                        .cornerRadius(8)
                    }
                }

                // Notifications
                if data.notifications.isEmpty {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.gsdGreen)
                        Text("All caught up — no unread notifications")
                            .font(.system(size: 12))
                            .foregroundColor(.gsdTextSecondary)
                        Spacer()
                    }
                    .padding(.vertical, 4)
                } else {
                    ForEach(data.notifications.prefix(3)) { notif in
                        largeNotificationRow(notif)
                    }
                }

                Divider().background(Color.gsdBorder)

                // Due Today / Overdue
                HStack {
                    Image(systemName: "calendar")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.gsdOrange)
                    Text("Due & Overdue")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.gsdTextPrimary)
                    Spacer()
                }

                if data.dueCards.isEmpty {
                    Text("No cards due today")
                        .font(.system(size: 12))
                        .foregroundColor(.gsdTextSecondary)
                        .padding(.vertical, 2)
                } else {
                    ForEach(data.dueCards.prefix(4)) { card in
                        dueCardRow(card)
                    }
                }

                Spacer(minLength: 0)

                // Board shortcuts
                if !data.boards.isEmpty {
                    Divider().background(Color.gsdBorder)
                    HStack(spacing: 8) {
                        ForEach(data.boards.prefix(4)) { board in
                            Link(destination: URL(string: "\(GSDShared.urlScheme)://board/\(board.id)")!) {
                                VStack(spacing: 3) {
                                    Image(systemName: boardIcon(board.icon))
                                        .font(.system(size: 16))
                                        .foregroundColor(.gsdBlue)
                                    Text(board.title)
                                        .font(.system(size: 9, weight: .medium))
                                        .foregroundColor(.gsdTextSecondary)
                                        .lineLimit(1)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 6)
                                .background(Color.gsdSurface)
                                .cornerRadius(8)
                            }
                        }
                    }
                }
            }
            .padding(12)
        }
    }

    private func largeNotificationRow(_ notif: WidgetNotification) -> some View {
        let style = NotificationStyle.forType(notif.type)
        return Link(destination: notificationURL(notif)) {
            HStack(spacing: 8) {
                Image(systemName: style.icon)
                    .font(.system(size: 11))
                    .foregroundColor(style.color)
                    .frame(width: 20, height: 20)
                    .background(style.color.opacity(0.15))
                    .cornerRadius(5)
                VStack(alignment: .leading, spacing: 1) {
                    Text(notif.title)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.gsdTextPrimary)
                        .lineLimit(1)
                    if let body = notif.body {
                        Text(body)
                            .font(.system(size: 10))
                            .foregroundColor(.gsdTextSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                Text(notif.timeAgo)
                    .font(.system(size: 10))
                    .foregroundColor(.gsdTextSecondary)
            }
        }
    }

    private func dueCardRow(_ card: WidgetCard) -> some View {
        Link(destination: URL(string: "\(GSDShared.urlScheme)://board/\(card.board_id ?? "")?card=\(card.id)")!) {
            HStack(spacing: 8) {
                Circle()
                    .fill(priorityColor(card.priority))
                    .frame(width: 8, height: 8)
                Text(card.title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.gsdTextPrimary)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if card.isOverdue {
                    Text("Overdue")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.gsdRed)
                } else if card.isDueToday {
                    Text("Today")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.gsdOrange)
                }
            }
        }
    }
}

// MARK: - Lock Screen Widgets (iOS 16+)

struct InboxAccessoryWidget: View {
    let data: WidgetData

    var body: some View {
        if data.unreadCount > 0 {
            Label("\(data.unreadCount) unread", systemImage: "bell.fill")
                .font(.system(size: 12))
        } else {
            Label("Inbox clear", systemImage: "bell")
                .font(.system(size: 12))
        }
    }
}

struct DueAccessoryWidget: View {
    let data: WidgetData

    var body: some View {
        let count = data.dueCards.count
        if count > 0 {
            Label("\(count) due", systemImage: "calendar")
                .font(.system(size: 12))
        } else {
            Label("Nothing due", systemImage: "calendar")
                .font(.system(size: 12))
        }
    }
}

// MARK: - Helpers

private func notificationURL(_ notif: WidgetNotification) -> URL {
    if let boardId = notif.board_id, let cardId = notif.card_id {
        return URL(string: "\(GSDShared.urlScheme)://board/\(boardId)?card=\(cardId)")!
    } else if let boardId = notif.board_id {
        return URL(string: "\(GSDShared.urlScheme)://board/\(boardId)")!
    }
    return URL(string: "\(GSDShared.urlScheme)://inbox")!
}

private func priorityColor(_ priority: String?) -> Color {
    switch priority {
    case "urgent": return .gsdRed
    case "high":   return .gsdOrange
    case "medium": return .gsdBlue
    case "low":    return .gsdGreen
    default:       return .gsdTextSecondary
    }
}

private func boardIcon(_ icon: String?) -> String {
    // Map GSD board icon names to SF Symbols
    switch icon {
    case "rocket":     return "paperplane.fill"
    case "target":     return "target"
    case "star":       return "star.fill"
    case "heart":      return "heart.fill"
    case "code":       return "chevron.left.forwardslash.chevron.right"
    case "book":       return "book.fill"
    case "puzzle":     return "puzzlepiece.fill"
    case "lightning":  return "bolt.fill"
    case "globe":      return "globe"
    case "chat":       return "bubble.left.fill"
    case "shield":     return "shield.fill"
    case "flag":       return "flag.fill"
    case "megaphone":  return "megaphone.fill"
    case "gift":       return "gift.fill"
    case "camera":     return "camera.fill"
    case "music":      return "music.note"
    case "users":      return "person.2.fill"
    case "tool":       return "wrench.fill"
    case "calendar":   return "calendar"
    case "mail":       return "envelope.fill"
    default:           return "square.grid.2x2.fill"
    }
}
