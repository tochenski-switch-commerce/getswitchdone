import UIKit

@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // UIScene lifecycle: window is owned here rather than in AppDelegate.
        // The storyboard instantiates ViewController (CAPBridgeViewController subclass)
        // automatically via UISceneStoryboardFile in Info.plist — nothing extra needed.
        guard let _ = scene as? UIWindowScene else { return }
    }
}
