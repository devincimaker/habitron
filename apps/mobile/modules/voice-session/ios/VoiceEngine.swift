import AVFoundation
import Accelerate

/// The one audio graph of interactive mode. The input node runs Apple's
/// voice processing (echo cancellation, noise suppression), which only works
/// when the same engine also plays what needs cancelling — so playback goes
/// through a player node on this engine and nowhere else.
///
/// Every public method is serialised on `queue`; the input tap joins the same
/// queue, so capture state is never touched from two threads at once.
final class VoiceEngine {
  /// What /api/speak streams, and what the player node is wired for.
  private static let playbackSampleRate = 24_000.0
  /// What /api/transcribe likes: Whisper resamples to 16 kHz anyway.
  private static let captureSampleRate = 16_000.0
  /// Kept before an utterance opens, so the first syllable survives the endpointer's onset delay.
  private static let preRollSeconds = 0.5
  private static let levelIntervalSeconds = 0.08

  private let onLevel: (Double) -> Void
  private let onPlaybackDone: () -> Void
  private let onError: (String) -> Void

  private let queue = DispatchQueue(label: "com.capybarastudios.habitscoach.voice-session")
  private let audio = AVAudioEngine()
  private let player = AVAudioPlayerNode()
  private let playbackFormat = AVAudioFormat(
    commonFormat: .pcmFormatFloat32, sampleRate: playbackSampleRate, channels: 1, interleaved: false
  )!
  private let captureFormat = AVAudioFormat(
    commonFormat: .pcmFormatInt16, sampleRate: captureSampleRate, channels: 1, interleaved: true
  )!

  private var running = false
  private var muted = false
  private var observers: [NSObjectProtocol] = []

  // Capture
  private var converter: AVAudioConverter?
  private var file: AVAudioFile?
  private var preRoll: [AVAudioPCMBuffer] = []
  private var preRollFrames: AVAudioFrameCount = 0
  private var preRollCapacity: AVAudioFrameCount = 0

  // Level
  private var levelPeak = 0.0
  private var levelSentAt: TimeInterval = 0

  // Playback
  private var scheduled = 0
  private var played = 0
  private var drainRequested = false
  /// Bumped by stopPlayback so completions of dropped buffers are ignored.
  private var playbackGeneration = 0
  private var oddByte: UInt8?

  init(
    onLevel: @escaping (Double) -> Void,
    onPlaybackDone: @escaping () -> Void,
    onError: @escaping (String) -> Void
  ) {
    self.onLevel = onLevel
    self.onPlaybackDone = onPlaybackDone
    self.onError = onError
  }

  // MARK: Lifecycle

  func start() throws {
    try queue.sync {
      if running { return }

      let session = AVAudioSession.sharedInstance()
      try session.setCategory(
        .playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth]
      )
      try session.setActive(true)

      let input = audio.inputNode
      // Echo cancellation is the point of this engine. The simulator has no
      // voice-processing unit and refuses it; there is nothing to cancel there.
      #if !targetEnvironment(simulator)
        try input.setVoiceProcessingEnabled(true)
      #endif
      let inputFormat = input.outputFormat(forBus: 0)
      guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0 else {
        throw VoiceEngineError("No microphone input is available.")
      }
      guard let converter = AVAudioConverter(from: inputFormat, to: captureFormat) else {
        throw VoiceEngineError("The microphone format cannot be captured.")
      }
      self.converter = converter
      preRollCapacity = AVAudioFrameCount(inputFormat.sampleRate * Self.preRollSeconds)

      if player.engine == nil {
        audio.attach(player)
      }
      audio.connect(player, to: audio.mainMixerNode, format: playbackFormat)

      input.installTap(onBus: 0, bufferSize: 2048, format: inputFormat) { [weak self] buffer, _ in
        self?.handleInput(buffer)
      }

      audio.prepare()
      do {
        try audio.start()
      } catch {
        input.removeTap(onBus: 0)
        throw error
      }
      player.play()
      running = true
      observeSession()
    }
  }

  func stop() {
    queue.sync {
      guard running else { return }
      running = false
      observers.forEach(NotificationCenter.default.removeObserver)
      observers.removeAll()

      audio.inputNode.removeTap(onBus: 0)
      player.stop()
      audio.stop()
      #if !targetEnvironment(simulator)
        try? audio.inputNode.setVoiceProcessingEnabled(false)
      #endif

      discardCapture()
      resetPlaybackState()
      try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
  }

  func setMuted(_ value: Bool) {
    queue.sync {
      muted = value
      if value { preRoll.removeAll(); preRollFrames = 0 }
    }
  }

  // MARK: Capture

  func beginUtterance() throws {
    try queue.sync {
      guard running, file == nil else { return }
      let directory = FileManager.default.temporaryDirectory.appendingPathComponent("voice-session", isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let url = directory.appendingPathComponent("\(UUID().uuidString).wav")
      let file = try AVAudioFile(
        forWriting: url, settings: captureFormat.settings, commonFormat: .pcmFormatInt16, interleaved: true
      )
      self.file = file
      for buffer in preRoll { write(buffer, to: file) }
      preRoll.removeAll()
      preRollFrames = 0
    }
  }

  func endUtterance() -> URL? {
    queue.sync {
      guard let file else { return nil }
      self.file = nil
      return file.url
    }
  }

  func cancelUtterance() {
    queue.sync { discardCapture() }
  }

  private func discardCapture() {
    if let file {
      self.file = nil
      try? FileManager.default.removeItem(at: file.url)
    }
    preRoll.removeAll()
    preRollFrames = 0
  }

  /// On the tap's thread. It never waits on `queue`: `stop()` removes the tap
  /// from inside the queue, and a tap blocked on that queue would deadlock it.
  private func handleInput(_ buffer: AVAudioPCMBuffer) {
    let level = Self.level(of: buffer)
    guard let copy = buffer.copied() else { return }
    queue.async { self.process(copy, level: level) }
  }

  private func process(_ buffer: AVAudioPCMBuffer, level: Double) {
    guard running else { return }
    report(level: muted ? 0 : level)
    if muted { return }

    if let file {
      write(buffer, to: file)
    } else {
      preRoll.append(buffer)
      preRollFrames += buffer.frameLength
      while preRollFrames > preRollCapacity, let oldest = preRoll.first {
        preRoll.removeFirst()
        preRollFrames -= oldest.frameLength
      }
    }
  }

  private func write(_ buffer: AVAudioPCMBuffer, to file: AVAudioFile) {
    guard let converter else { return }
    let ratio = captureFormat.sampleRate / buffer.format.sampleRate
    let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 32
    guard let converted = AVAudioPCMBuffer(pcmFormat: captureFormat, frameCapacity: capacity) else { return }

    var handedOver = false
    var error: NSError?
    converter.convert(to: converted, error: &error) { _, status in
      if handedOver {
        status.pointee = .noDataNow
        return nil
      }
      handedOver = true
      status.pointee = .haveData
      return buffer
    }
    if let error {
      onError("Could not capture audio: \(error.localizedDescription)")
      return
    }
    if converted.frameLength > 0 {
      try? file.write(from: converted)
    }
  }

  // MARK: Level

  private func report(level: Double) {
    levelPeak = max(levelPeak, level)
    let now = ProcessInfo.processInfo.systemUptime
    guard now - levelSentAt >= Self.levelIntervalSeconds else { return }
    levelSentAt = now
    let peak = levelPeak
    levelPeak = 0
    onLevel(peak)
  }

  /// RMS → dBFS → the recorder's 0–1 scale, (dB + 60) / 60.
  private static func level(of buffer: AVAudioPCMBuffer) -> Double {
    guard let channels = buffer.floatChannelData, buffer.frameLength > 0 else { return 0 }
    var rms: Float = 0
    vDSP_rmsqv(channels[0], 1, &rms, vDSP_Length(buffer.frameLength))
    let decibels = 20 * log10(max(Double(rms), 1e-7))
    return min(1, max(0, (decibels + 60) / 60))
  }

  // MARK: Playback

  func enqueue(pcm16 data: Data) {
    queue.sync {
      guard running else { return }
      var bytes = data
      if let oddByte {
        bytes.insert(oddByte, at: 0)
        self.oddByte = nil
      }
      if bytes.count % 2 == 1 {
        oddByte = bytes.removeLast()
      }
      let frames = bytes.count / 2
      guard frames > 0,
        let buffer = AVAudioPCMBuffer(pcmFormat: playbackFormat, frameCapacity: AVAudioFrameCount(frames)),
        let samples = buffer.floatChannelData?[0]
      else { return }
      buffer.frameLength = AVAudioFrameCount(frames)
      bytes.withUnsafeBytes { raw in
        for index in 0..<frames {
          let value = Int16(bitPattern: UInt16(raw[2 * index]) | (UInt16(raw[2 * index + 1]) << 8))
          samples[index] = Float(value) / 32768
        }
      }

      scheduled += 1
      let generation = playbackGeneration
      player.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack) { [weak self] _ in
        self?.bufferPlayed(in: generation)
      }
      if !player.isPlaying { player.play() }
    }
  }

  func finishPlayback() {
    queue.sync {
      drainRequested = true
      notifyIfDrained()
    }
  }

  func stopPlayback() {
    queue.sync {
      resetPlaybackState()
      guard running else { return }
      player.stop()
      player.play()
    }
  }

  private func bufferPlayed(in generation: Int) {
    queue.async {
      guard generation == self.playbackGeneration else { return }
      self.played += 1
      self.notifyIfDrained()
    }
  }

  private func notifyIfDrained() {
    guard drainRequested, played >= scheduled else { return }
    drainRequested = false
    scheduled = 0
    played = 0
    onPlaybackDone()
  }

  private func resetPlaybackState() {
    playbackGeneration += 1
    scheduled = 0
    played = 0
    drainRequested = false
    oddByte = nil
  }

  // MARK: Session events

  private func observeSession() {
    let center = NotificationCenter.default
    observers.append(center.addObserver(
      forName: AVAudioSession.interruptionNotification, object: nil, queue: nil
    ) { [weak self] notification in
      guard let self,
        let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        AVAudioSession.InterruptionType(rawValue: raw) == .began
      else { return }
      self.fail("The call was interrupted by another app.")
    })
    observers.append(center.addObserver(
      forName: .AVAudioEngineConfigurationChange, object: audio, queue: nil
    ) { [weak self] _ in
      self?.recoverFromConfigurationChange()
    })
  }

  private func recoverFromConfigurationChange() {
    queue.async {
      guard self.running, !self.audio.isRunning else { return }
      do {
        try self.audio.start()
        self.player.play()
      } catch {
        self.fail("The audio route changed and the session could not follow it.")
      }
    }
  }

  /// Ends the session from inside: the engine is torn down and JS is told once.
  private func fail(_ message: String) {
    DispatchQueue.global().async {
      self.stop()
      self.onError(message)
    }
  }
}

struct VoiceEngineError: LocalizedError {
  let errorDescription: String?
  init(_ message: String) { errorDescription = message }
}

private extension AVAudioPCMBuffer {
  /// The tap's buffer is the engine's; anything kept past the callback is copied.
  func copied() -> AVAudioPCMBuffer? {
    guard let copy = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameLength) else { return nil }
    copy.frameLength = frameLength
    let source = UnsafeMutableAudioBufferListPointer(mutableAudioBufferList)
    let target = UnsafeMutableAudioBufferListPointer(copy.mutableAudioBufferList)
    for (from, to) in zip(source, target) {
      guard let fromData = from.mData, let toData = to.mData else { continue }
      memcpy(toData, fromData, Int(min(from.mDataByteSize, to.mDataByteSize)))
    }
    return copy
  }
}
