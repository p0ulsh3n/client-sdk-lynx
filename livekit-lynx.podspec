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

  # IMPORTANT: Exclude the bridging header from public headers.
  # CocoaPods pods with use_frameworks! use auto-generated umbrella headers,
  # NOT bridging headers. Including the bridging header (which imports
  # <Lynx/Lynx.h> containing C++) in the umbrella header breaks the module.
  # Only expose the ObjC headers that Swift actually needs.
  s.public_header_files = "ios/**/LK*.h", "ios/**/LynxLiveKitSetup.h"

  # Same as livekit-react-native.podspec
  s.framework = "AVFAudio"

  # Swift/Objective-C compatibility + C++ flags for Lynx/PrimJS headers
  s.pod_target_xcconfig = {
    'DEFINES_MODULE'                                   => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD'                      => 'gnu++17',
    'CLANG_CXX_LIBRARY'                                => 'libc++',
    'HEADER_SEARCH_PATHS'                              => '$(PODS_ROOT)/** $(PODS_TARGET_SRCROOT)/** $(inherited)',
    'SWIFT_OBJC_INTEROP_MODE'                          => 'objcxx',
    'OTHER_SWIFT_FLAGS'                                => '$(inherited) -cxx-interoperability-mode=default',
    'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES' => 'YES',
    # Bridging header for Swift in the pod to access Lynx/WebRTC ObjC headers
    'SWIFT_OBJC_BRIDGING_HEADER'                       => '$(PODS_TARGET_SRCROOT)/ios/LivekitLynx-Bridging-Header.h'
  }

  # Lynx SDK — provided by the host app
  s.dependency "Lynx", "~> 3.6.0"

  # Google WebRTC — same version as Flutter SDK (newest stable)
  s.dependency "WebRTC-SDK", "144.7559.01"
end
