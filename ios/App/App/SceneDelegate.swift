import UIKit
import Capacitor
import CoreMIDI
import CoreAudioKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = HugoBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Registers the app's own plugins with the Capacitor bridge.
class HugoBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MidiPlugin())
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
}

/// CoreMIDI for the web app: every connected source (USB cable, or a Bluetooth keyboard
/// paired through the system picker) is read, and notes are forwarded to JavaScript.
@objc(MidiPlugin)
public class MidiPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MidiPlugin"
    public let jsName = "Midi"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showBluetooth", returnType: CAPPluginReturnPromise),
    ]

    private var client = MIDIClientRef()
    private var port = MIDIPortRef()
    private var started = false
    private var connected = Set<MIDIEndpointRef>()

    @objc func start(_ call: CAPPluginCall) {
        if !started {
            started = true
            MIDIClientCreateWithBlock("Hugo's Piano" as CFString, &client) { [weak self] notification in
                if notification.pointee.messageID == .msgSetupChanged {
                    DispatchQueue.main.async { self?.connectSources() }
                }
            }
            MIDIInputPortCreateWithProtocol(client, "Hugo's Piano In" as CFString, ._1_0, &port) { [weak self] list, _ in
                self?.read(list)
            }
        }
        connectSources()
        call.resolve(["devices": deviceNames()])
    }

    /// The system Bluetooth MIDI picker; a paired keyboard then shows up as a normal source.
    @objc func showBluetooth(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController else { call.reject("No view"); return }
            let picker = CABTMIDICentralViewController()
            picker.navigationItem.rightBarButtonItem = UIBarButtonItem(
                systemItem: .done,
                primaryAction: UIAction { _ in host.dismiss(animated: true) })
            let nav = UINavigationController(rootViewController: picker)
            nav.modalPresentationStyle = .formSheet
            host.present(nav, animated: true)
            call.resolve()
        }
    }

    private func connectSources() {
        var now = Set<MIDIEndpointRef>()
        for i in 0..<MIDIGetNumberOfSources() {
            let src = MIDIGetSource(i)
            now.insert(src)
            if !connected.contains(src) { MIDIPortConnectSource(port, src, nil) }
        }
        connected = now
        notifyListeners("devices", data: ["devices": deviceNames()])
    }

    private func deviceNames() -> [String] {
        (0..<MIDIGetNumberOfSources()).compactMap { i in
            var name: Unmanaged<CFString>?
            MIDIObjectGetStringProperty(MIDIGetSource(i), kMIDIPropertyDisplayName, &name)
            return name?.takeRetainedValue() as String?
        }
    }

    /// Universal MIDI Packets: only MIDI 1.0 channel voice (type 2) note on/off matter here.
    private func read(_ list: UnsafePointer<MIDIEventList>) {
        for packet in list.unsafeSequence() {
            let count = Int(packet.pointee.wordCount)
            withUnsafeBytes(of: packet.pointee.words) { raw in
                let words = raw.bindMemory(to: UInt32.self)
                var i = 0
                while i < count {
                    let w = words[i]
                    let type = w >> 28
                    if type == 0x2 {
                        let status = (w >> 16) & 0xF0
                        let note = Int((w >> 8) & 0x7F)
                        let velocity = Int(w & 0x7F)
                        if status == 0x90 && velocity > 0 { emit("on", note, velocity) }
                        else if status == 0x80 || status == 0x90 { emit("off", note, 0) }
                    }
                    switch type {
                    case 0x3, 0x4, 0x8, 0x9, 0xA: i += 2
                    case 0xB, 0xC: i += 3
                    case 0x5, 0xD, 0xE, 0xF: i += 4
                    default: i += 1
                    }
                }
            }
        }
    }

    private func emit(_ type: String, _ midi: Int, _ velocity: Int) {
        DispatchQueue.main.async {
            self.notifyListeners("note", data: ["type": type, "midi": midi, "velocity": velocity])
        }
    }
}
