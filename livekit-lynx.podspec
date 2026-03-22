require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "livekit-lynx"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "14.0" }
  s.source       = { :git => "https://github.com/livekit/client-sdk-lynx.git", :tag => "#{s.version}" }

  s.source_files        = "ios/**/*.{h,m,mm,swift}"
  s.public_header_files = "ios/**/*.h"

  # Same as livekit-react-native.podspec
  s.framework = "AVFAudio"

  # Swift/Objective-C compatibility + C++ flags for Lynx/PrimJS headers
  s.pod_target_xcconfig = {
    'DEFINES_MODULE'               => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD'  => 'gnu++17',
    'CLANG_CXX_LIBRARY'            => 'libc++',
    'HEADER_SEARCH_PATHS'          => '$(PODS_ROOT)/** $(PODS_TARGET_SRCROOT)/** $(inherited)'
  }

  # Lynx SDK — provided by the host app
  s.dependency "Lynx", "~> 3.2.0"

  # Google WebRTC — same version as Flutter SDK (newest stable)
  s.dependency "WebRTC-SDK", "144.7559.01"
end
