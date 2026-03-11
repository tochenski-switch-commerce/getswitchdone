import UIKit
import Capacitor
import WebKit

/// Custom WKWebView that hides the keyboard input accessory toolbar
/// (the prev/next/done bar that appears above the keyboard during web content load).
class NoAccessoryWebView: WKWebView {
    override var inputAccessoryView: UIView? { nil }
}

/// Custom bridge view controller that injects NoAccessoryWebView.
@objc(ViewController)
class ViewController: CAPBridgeViewController {
    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        return NoAccessoryWebView(frame: frame, configuration: configuration)
    }
}
