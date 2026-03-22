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

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  # Exclude the bridging header — bridging headers are UNSUPPORTED in
  # framework targets (CocoaPods with use_frameworks!).  Swift code in
  # this pod accesses Lynx/WebRTC via `import Lynx` / `import WebRTC`,
  # and the pod's own ObjC headers via the auto-generated umbrella header.
  s.exclude_files = "ios/**/LivekitLynx-Bridging-Header.h"

  # Only expose ObjC headers that Swift needs via the umbrella header.
  s.public_header_files = "ios/**/LK*.h", "ios/**/LynxLiveKitSetup.h"

  # Same as livekit-react-native.podspec
  s.framework = "AVFAudio"

  s.pod_target_xcconfig = {
    'DEFINES_MODULE'                                        => 'YES',
    'SWIFT_VERSION'                                         => '5',
    'CLANG_CXX_LANGUAGE_STANDARD'                           => 'gnu++17',
    'CLANG_CXX_LIBRARY'                                     => 'libc++',
    'HEADER_SEARCH_PATHS'                                   => '$(PODS_ROOT)/** $(PODS_TARGET_SRCROOT)/** $(PODS_ROOT)/Lynx/Lynx.framework/Headers $(inherited)',
    'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES' => 'YES',
    'FRAMEWORK_SEARCH_PATHS'                                => '$(inherited) $(PODS_ROOT)/Lynx'
  }

  # Lynx SDK — provided by the host app
  s.dependency "Lynx", "~> 3.6.0"

  # Google WebRTC — same version as Flutter SDK (newest stable)
  s.dependency "WebRTC-SDK", "144.7559.01"
end
