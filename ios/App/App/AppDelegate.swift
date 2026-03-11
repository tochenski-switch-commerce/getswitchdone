import UIKit
import Capacitor
import LocalAuthentication
import Security
import UserNotifications
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    // window is now owned by SceneDelegate (UIScene lifecycle)
    private var pluginsRegistered = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    private var activeWindow: UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        if !pluginsRegistered, let bridge = (activeWindow?.rootViewController as? CAPBridgeViewController)?.bridge {
            bridge.registerPluginInstance(NativeBiometric())
            bridge.registerPluginInstance(BadgeManager())
            bridge.registerPluginInstance(WidgetBridge())
            pluginsRegistered = true
            NSLog("[WidgetBridge] plugins registered")
        }
        // After bridge is ready, ask the web layer to re-sync the session.
        // This covers the case where the initial syncSessionToWidget call was
        // dropped by a page navigation ("Connection invalidated" on S:1).
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.recoverWidgetSessionFromJS()
        }
    }

    /// Reads the Supabase session from WKWebView localStorage and writes it
    /// directly to App Group UserDefaults — bypassing the Capacitor bridge.
    private func recoverWidgetSessionFromJS() {
        guard let webView = (activeWindow?.rootViewController as? CAPBridgeViewController)?.webView else { return }
        let js = """
        (function() {
            try {
                // Supabase v2 stores sessions under "sb-<project>-auth-token"
                const key = Object.keys(localStorage).find(k => k.endsWith('-auth-token'));
                if (!key) return null;
                const raw = localStorage.getItem(key);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                const at = parsed?.access_token || parsed?.session?.access_token;
                const rt = parsed?.refresh_token || parsed?.session?.refresh_token;
                const uid = parsed?.user?.id || parsed?.session?.user?.id;
                if (at && uid) return JSON.stringify({ at, rt, uid });
            } catch(e) {}
            return null;
        })()
        """
        webView.evaluateJavaScript(js) { [weak self] result, _ in
            guard let json = result as? String,
                  let data = json.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String],
                  let at = obj["at"], let uid = obj["uid"] else {
                NSLog("[WidgetBridge] recoverSession: no session in localStorage")
                return
            }
            let rt = obj["rt"]
            let appGroupID = "group.com.getswitchdone.boards"
            if let defaults = UserDefaults(suiteName: appGroupID) {
                defaults.set(at, forKey: "supabase_access_token")
                defaults.set(uid, forKey: "supabase_user_id")
                if let rt = rt { defaults.set(rt, forKey: "supabase_refresh_token") }
                defaults.synchronize()
                NSLog("[WidgetBridge] session recovered from localStorage for user %@", uid)
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Handle gsdboards:// deep links from widget
        if url.scheme == "gsdboards" {
            handleWidgetDeepLink(url)
            return true
        }
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    private func handleWidgetDeepLink(_ url: URL) {
        guard let bridge = (activeWindow?.rootViewController as? CAPBridgeViewController)?.bridge else { return }

        let host = url.host ?? ""
        let query = url.query ?? ""
        var route: String

        switch host {
        case "inbox":
            route = "/boards?inbox=1"
        case "add-card":
            route = "/boards?addCard=1"
        case "boards":
            route = "/boards"
        case "board":
            let boardId = url.pathComponents.count > 1 ? url.pathComponents[1] : ""
            route = "/boards/\(boardId)"
            if !query.isEmpty {
                route += "?\(query)"
            }
        case "auth":
            route = "/auth"
        default:
            route = "/boards"
        }

        let js = "window.dispatchEvent(new CustomEvent('widgetDeepLink', { detail: { route: '\(route)' } }))"
        bridge.webView?.evaluateJavaScript(js)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Handle Universal Links — navigate the webview to the incoming URL path
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
           let url = userActivity.webpageURL,
           let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
           let path = components.path.isEmpty ? nil : components.path {
            let route = components.query != nil ? "\(path)?\(components.query!)" : path
            let js = "window.dispatchEvent(new CustomEvent('widgetDeepLink', { detail: { route: '\(route)' } }))"
            if let bridge = (activeWindow?.rootViewController as? CAPBridgeViewController)?.bridge {
                bridge.webView?.evaluateJavaScript(js)
                return true
            }
        }
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // Handle Home Screen Quick Actions
    func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        let action = shortcutItem.type
        guard let bridge = (activeWindow?.rootViewController as? CAPBridgeViewController)?.bridge else {
            completionHandler(false)
            return
        }
        bridge.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('quickAction', { detail: { type: '\(action)' } }))")
        completionHandler(true)
    }

    // Forward APNs token to Capacitor push plugin
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    // Triggered by content-available:1 in APNs payload (background + foreground)
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        // Refresh widget timelines so they show the latest data
        WidgetCenter.shared.reloadAllTimelines()
        completionHandler(.newData)
    }

}

// MARK: - Native Biometric Plugin (Face ID / Touch ID)

@objc(NativeBiometric)
public class NativeBiometric: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeBiometric"
    public let jsName = "NativeBiometric"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "verifyIdentity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setCredentials", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCredentials", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteCredentials", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasCredentials", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        var biometryType = "none"
        if available {
            switch context.biometryType {
            case .faceID: biometryType = "FACE_ID"
            case .touchID: biometryType = "TOUCH_ID"
            case .opticID: biometryType = "OPTIC_ID"
            @unknown default: biometryType = "UNKNOWN"
            }
        }

        call.resolve([
            "isAvailable": available,
            "biometryType": biometryType,
        ])
    }

    @objc func verifyIdentity(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Authenticate"
        let context = LAContext()
        context.localizedFallbackTitle = call.getString("fallbackTitle") ?? "Use Passcode"

        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["verified": true])
                } else {
                    call.reject("Authentication failed", nil, error)
                }
            }
        }
    }

    // MARK: - Keychain Credentials (biometric-protected)

    @objc func setCredentials(_ call: CAPPluginCall) {
        guard let server = call.getString("server"),
              let username = call.getString("username"),
              let password = call.getString("password") else {
            call.reject("Missing required parameters")
            return
        }

        // Remove existing item first
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: server,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        // Create biometric access control
        var accessError: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .biometryCurrentSet,
            &accessError
        ) else {
            call.reject("Failed to create access control")
            return
        }

        guard let passwordData = password.data(using: .utf8) else {
            call.reject("Failed to encode password")
            return
        }

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: server,
            kSecAttrAccount as String: username,
            kSecValueData as String: passwordData,
            kSecAttrAccessControl as String: accessControl,
        ]

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        if status == errSecSuccess {
            call.resolve(["success": true])
        } else {
            call.reject("Failed to store credentials (status: \(status))")
        }
    }

    @objc func getCredentials(_ call: CAPPluginCall) {
        guard let server = call.getString("server") else {
            call.reject("Missing server parameter")
            return
        }

        let reason = call.getString("reason") ?? "Sign in to GSD Boards"

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: server,
            kSecReturnData as String: true,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseOperationPrompt as String: reason,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecSuccess,
           let item = result as? [String: Any],
           let data = item[kSecValueData as String] as? Data,
           let password = String(data: data, encoding: .utf8),
           let username = item[kSecAttrAccount as String] as? String {
            call.resolve([
                "username": username,
                "password": password,
            ])
        } else if status == errSecUserCanceled || status == errSecAuthFailed {
            call.reject("Authentication canceled", "USER_CANCELED")
        } else {
            call.reject("No credentials found", "NOT_FOUND")
        }
    }

    @objc func deleteCredentials(_ call: CAPPluginCall) {
        guard let server = call.getString("server") else {
            call.reject("Missing server parameter")
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: server,
        ]

        SecItemDelete(query as CFDictionary)
        call.resolve(["success": true])
    }

    @objc func hasCredentials(_ call: CAPPluginCall) {
        guard let server = call.getString("server") else {
            call.reject("Missing server parameter")
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: server,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        // errSecInteractionNotAllowed means the item exists but requires biometric
        call.resolve(["hasCredentials": status == errSecSuccess || status == errSecInteractionNotAllowed])
    }
}

// MARK: - Badge Manager Plugin

@objc(BadgeManager)
public class BadgeManager: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BadgeManager"
    public let jsName = "BadgeManager"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setBadgeCount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearBadge", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getBadgeCount", returnType: CAPPluginReturnPromise),
    ]

    @objc func setBadgeCount(_ call: CAPPluginCall) {
        let count = call.getInt("count") ?? 0
        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = count
            call.resolve(["success": true])
        }
    }

    @objc func clearBadge(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = 0
            call.resolve(["success": true])
        }
    }

    @objc func getBadgeCount(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let count = UIApplication.shared.applicationIconBadgeNumber
            call.resolve(["count": count])
        }
    }
}

// MARK: - Show push notifications in foreground
extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Refresh widget when notification arrives in foreground
        WidgetCenter.shared.reloadAllTimelines()
        completionHandler([.banner, .sound, .badge])
    }
}

// MARK: - Widget Bridge Plugin (shares auth token with widget via App Group)

@objc(WidgetBridge)
public class WidgetBridge: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridge"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadWidgets", returnType: CAPPluginReturnPromise),
    ]

    private static let appGroupID = "group.com.getswitchdone.boards"

    @objc func setSession(_ call: CAPPluginCall) {
        NSLog("[WidgetBridge] setSession called")
        guard let accessToken = call.getString("accessToken"),
              let userId = call.getString("userId") else {
            NSLog("[WidgetBridge] setSession missing params")
            call.reject("Missing accessToken or userId")
            return
        }
        let refreshToken = call.getString("refreshToken")

        guard let defaults = UserDefaults(suiteName: WidgetBridge.appGroupID) else {
            NSLog("[WidgetBridge] cannot access App Group")
            call.reject("Cannot access App Group")
            return
        }

        defaults.set(accessToken, forKey: "supabase_access_token")
        defaults.set(userId, forKey: "supabase_user_id")
        if let rt = refreshToken {
            defaults.set(rt, forKey: "supabase_refresh_token")
        }
        defaults.synchronize()

        NSLog("[WidgetBridge] session saved for user %@", userId)

        // Reload all widgets so they pick up the new session
        WidgetCenter.shared.reloadAllTimelines()

        call.resolve(["success": true])
    }

    @objc func clearSession(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: WidgetBridge.appGroupID) else {
            call.reject("Cannot access App Group")
            return
        }

        defaults.removeObject(forKey: "supabase_access_token")
        defaults.removeObject(forKey: "supabase_refresh_token")
        defaults.removeObject(forKey: "supabase_user_id")
        defaults.synchronize()

        WidgetCenter.shared.reloadAllTimelines()

        call.resolve(["success": true])
    }

    @objc func reloadWidgets(_ call: CAPPluginCall) {
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["success": true])
    }
}
