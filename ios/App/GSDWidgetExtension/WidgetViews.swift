import SwiftUI
import WidgetKit

// MARK: - Color theme (matching Lumio dark mode)

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

// MARK: - Helpers

private func notificationURL(_ notif: WidgetNotification) -> URL {
    if let boardId = notif.board_id, let cardId = notif.card_id {
        return URL(string: "\(GSDShared.urlScheme)://board/\(boardId)?card=\(cardId)")!
    } else if let boardId = notif.board_id {
        return URL(string: "\(GSDShared.urlScheme)://board/\(boardId)")!
    }
    return URL(string: "\(GSDShared.urlScheme)://inbox")!
}
