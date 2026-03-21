require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name          = 'livekit-lynx'
  s.version       = package['version']
  s.summary       = package['description']
  s.homepage      = 'https://github.com/livekit/client-sdk-lynx'
  s.license       = { :type => 'Apache-2.0', :file => 'LICENSE' }
  s.authors       = 'LiveKit contributors'

  s.platforms     = { ios: '14.0' }
  s.source        = {
    git: 'https://github.com/livekit/client-sdk-lynx.git',
    tag: "v#{s.version}"
  }

  # All native source in ios/
  s.source_files        = 'ios/**/*.{h,m,mm,swift}'
  s.public_header_files = 'ios/**/*.h'

  # Swift 6
  s.swift_version = '6.0'

  # AVFAudio required (same as livekit-react-native.podspec)
  s.framework = 'AVFAudio'

  # Swift/ObjC interop
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }

  # Lynx SDK
  s.dependency 'Lynx'

  # Google WebRTC (same pinning as livekit-react-native-webrtc)
  s.dependency 'WebRTC-SDK', '~> 125.0'

  # NOTE: AudioSwitch is Android-only. iOS uses AVFoundation/AVAudioSession directly.
end
