#!/bin/sh
# Builds an unsigned HugosPiano.ipa for SideStore (SideStore signs it with your Apple ID).
set -e
cd "$(dirname "$0")/.."

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode not active. Install Xcode, then run:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

npm run build:ios

cd ios/App
rm -rf build Payload
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  build | grep -E "error|warning: .*Swift|BUILD" || true

APP=build/Build/Products/Release-iphoneos/App.app
[ -d "$APP" ] || { echo "Build failed: no App.app"; exit 1; }
mkdir Payload && cp -R "$APP" Payload/
rm -f ../../HugosPiano.ipa && zip -qr ../../HugosPiano.ipa Payload
rm -rf Payload
echo "Done: $(cd ../.. && pwd)/HugosPiano.ipa"
