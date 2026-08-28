Pod::Spec.new do |s|
  s.name           = 'RoutineAlarms'
  s.version        = '1.0.0'
  s.summary        = 'AlarmKit alarms for habit routines.'
  s.description    = 'Schedules one AlarmKit alarm per routine start time.'
  s.author         = ''
  s.homepage       = 'https://github.com/devincimaker/habitron'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
