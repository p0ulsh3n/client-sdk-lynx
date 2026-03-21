require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name          = 'livekit-lynx'
  s.version       = package['version']
  s.summary       = package['description']
  s.homepage      = 'https://github.com/p0ulsh3n/client-sdk-lynx'
  s.license       = { :type => 'Apache-2.0', :file => 'LICENSE' }
  s.authors       = 'LiveKit contributors'

  s.platforms     = { ios: '14.0' }
  s.source        = {
    git: 'https://github.com/p0ulsh3n/client-sdk-lynx.git',
    tag: "v#{s.version}"
  }

  s.source_files        = 'ios/**/*.{h,m,mm,swift}'
  s.public_header_files = 'ios/**/*.h'

  s.swift_version = '6.0'
  s.framework = 'AVFAudio'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }

  s.dependency 'Lynx'
  s.dependency 'WebRTC-SDK', '~> 125.0'
end