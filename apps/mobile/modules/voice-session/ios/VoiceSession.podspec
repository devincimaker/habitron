Pod::Spec.new do |s|
  s.name           = 'VoiceSession'
  s.version        = '1.0.0'
  s.summary        = 'Full-duplex voice for interactive coaching.'
  s.description    = 'One AVAudioEngine with voice processing: mic levels and utterance capture in, streamed PCM out, echo cancelled between them.'
  s.author         = ''
  s.homepage       = 'https://github.com/devincimaker/habitron'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'Accelerate'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
