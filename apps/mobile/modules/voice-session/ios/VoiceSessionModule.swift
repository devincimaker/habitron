import ExpoModulesCore
import AVFoundation

public class VoiceSessionModule: Module {
  private lazy var engine = VoiceEngine(
    onLevel: { [weak self] level in self?.sendEvent("onLevel", ["level": level]) },
    onPlaybackDone: { [weak self] in self?.sendEvent("onPlaybackDone", [:]) },
    onError: { [weak self] message in self?.sendEvent("onError", ["message": message]) }
  )

  public func definition() -> ModuleDefinition {
    Name("VoiceSession")

    Events("onLevel", "onPlaybackDone", "onError")

    Function("getPermission") { () -> String in
      switch AVAudioSession.sharedInstance().recordPermission {
      case .granted: return "granted"
      case .denied: return "denied"
      default: return "undetermined"
      }
    }

    AsyncFunction("requestPermission") { (promise: Promise) in
      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        promise.resolve(granted)
      }
    }

    AsyncFunction("start") { () throws in
      try self.engine.start()
    }

    AsyncFunction("stop") {
      self.engine.stop()
    }

    Function("setMuted") { (muted: Bool) in
      self.engine.setMuted(muted)
    }

    Function("beginUtterance") { () throws in
      try self.engine.beginUtterance()
    }

    AsyncFunction("endUtterance") { () -> String? in
      self.engine.endUtterance()?.absoluteString
    }

    Function("cancelUtterance") {
      self.engine.cancelUtterance()
    }

    Function("enqueueAudio") { (bytes: Uint8Array) in
      self.engine.enqueue(pcm16: Data(bytes: bytes.rawPointer, count: bytes.byteLength))
    }

    Function("finishPlayback") {
      self.engine.finishPlayback()
    }

    Function("stopPlayback") {
      self.engine.stopPlayback()
    }

    OnDestroy {
      self.engine.stop()
    }
  }
}
