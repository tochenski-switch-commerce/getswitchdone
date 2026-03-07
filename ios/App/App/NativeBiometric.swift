import Foundation
import LocalAuthentication
import Capacitor

@objc(NativeBiometric)
public class NativeBiometric: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeBiometric"
    public let jsName = "NativeBiometric"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "verifyIdentity", returnType: CAPPluginReturnPromise),
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
}
