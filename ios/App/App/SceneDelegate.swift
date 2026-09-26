import UIKit
import Capacitor
import CoreMIDI
import CoreAudioKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    // Main.storyboard builds the window with HugoBridgeViewController as its root.
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
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
}

/// CoreMIDI for the web app: every connected source (USB cable, or a Bluetooth keyboard
/// paired through the system picker) is read, and notes are forwarded to JavaScript.
@objc(MidiPlugin)
public class MidiPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MidiPlugin"
    public let jsName = "Midi"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showBluetooth", returnType: CAPPluginReturnPromise),
    ]

    private var client = MIDIClientRef()
    private var port = MIDIPortRef()
    private var started = false
    private var clientStatus: OSStatus = noErr
    private var portStatus: OSStatus = noErr
    private var connected = Set<MIDIEndpointRef>()
    private var lastNames: [String] = []
    private var events = 0
    private var timer: Timer?

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.setUp()
            self.connectSources()
            call.resolve(self.statusData())
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(self.statusData()) }
    }

    /// Creates the CoreMIDI client and input port. If CoreMIDI refuses (it can while the MIDI
    /// server is still starting), this runs again on the next start call or timer tick.
    private func setUp() {
        if timer == nil {
            // A cable plugged in while the app was in the background, or a missed notification.
            NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                self?.setUp()
                self?.connectSources()
            }
            timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
                self?.setUp()
                self?.connectSources()
            }
        }
        guard !started else { return }
        clientStatus = MIDIClientCreateWithBlock("Hugo's Piano" as CFString, &client) { [weak self] notification in
            switch notification.pointee.messageID {
            case .msgSetupChanged, .msgObjectAdded, .msgObjectRemoved, .msgPropertyChanged:
                DispatchQueue.main.async { self?.connectSources() }
            default: break
            }
        }
        guard clientStatus == noErr else {
            NSLog("HugoMIDI client failed %d, will retry", clientStatus)
            client = 0
            return
        }
        portStatus = MIDIInputPortCreateWithProtocol(client, "Hugo's Piano In" as CFString, ._1_0, &port) { [weak self] list, _ in
            self?.read(list)
        }
        guard portStatus == noErr else {
            NSLog("HugoMIDI port failed %d, will retry", portStatus)
            MIDIClientDispose(client)
            client = 0
            return
        }
        started = true
        NSLog("HugoMIDI ready")
    }

    /// The system Bluetooth MIDI picker; a paired keyboard then shows up as a normal source.
    @objc func showBluetooth(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.setUp()
            guard let host = self.bridge?.viewController else { call.reject("No view"); return }
            let picker = CABTMIDICentralViewController()
            picker.navigationItem.rightBarButtonItem = UIBarButtonItem(
                systemItem: .done,
                primaryAction: UIAction { [weak self] _ in
                    host.dismiss(animated: true)
                    self?.connectSources()
                })
            let nav = UINavigationController(rootViewController: picker)
            nav.modalPresentationStyle = .formSheet
            host.present(nav, animated: true)
            call.resolve()
        }
    }

    private func connectSources() {
        guard started else { return }
        var now = Set<MIDIEndpointRef>()
        for i in 0..<MIDIGetNumberOfSources() {
            let src = MIDIGetSource(i)
            guard src != 0 else { continue }
            now.insert(src)
            if !connected.contains(src) {
                let st = MIDIPortConnectSource(port, src, nil)
                NSLog("HugoMIDI connect %@ -> %d", name(of: src), st)
            }
        }
        for gone in connected.subtracting(now) { MIDIPortDisconnectSource(port, gone) }
        connected = now
        let names = deviceNames()
        if names != lastNames {
            lastNames = names
            NSLog("HugoMIDI devices %@", names.joined(separator: ", "))
            notifyListeners("devices", data: ["devices": names])
        }
    }

    private func name(of endpoint: MIDIEndpointRef) -> String {
        var name: Unmanaged<CFString>?
        MIDIObjectGetStringProperty(endpoint, kMIDIPropertyDisplayName, &name)
        return (name?.takeRetainedValue() as String?) ?? "MIDI device"
    }

    private func deviceNames() -> [String] {
        (0..<MIDIGetNumberOfSources()).map { name(of: MIDIGetSource($0)) }
    }

    private func statusData() -> [String: Any] {
        [
            "devices": deviceNames(), "client": Int(clientStatus), "port": Int(portStatus), "events": events,
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?",
            "appBuild": Int(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0") ?? 0,
        ]
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
            self.events += 1
            self.notifyListeners("note", data: ["type": type, "midi": midi, "velocity": velocity])
        }
    }
}
