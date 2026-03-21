require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name          = 'livekit-lynx'
  s.version       = package['version']
  s.summary       = package['description']
  s.homepage      = package['homepage']
  s.license       = package['license']
  s.authors       = package['author']

  s.platforms     = { ios: '14.0' }
  s.source        = {
    git: 'https://github.com/livekit/client-sdk-lynx.git',
    tag: "v#{s.version}"
  }

  # All native source files live in ios/
  s.source_files  = 'ios/**/*.{h,m,mm,swift}'
  s.public_header_files = 'ios/**/*.h'

  # Swift 6 strict concurrency
  s.swift_version = '6.0'

  # Required system frameworks
  s.frameworks = 'AVFoundation', 'Accelerate', 'CoreMotion',
                 'CoreImage', 'CoreVideo', 'CoreMedia',
                 'VideoToolbox', 'AudioToolbox', 'AVFAudio'

  # Required for Swift/ObjC interop
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }

  # Lynx framework
  s.dependency 'Lynx'

  # Google WebRTC (same version as livekit-client-sdk-swift)
  s.dependency 'WebRTC-SDK', '~> 125.0'

  # Twilio AudioSwitch for audio routing
  s.dependency 'AudioSwitch', '~> 1.0'
end
