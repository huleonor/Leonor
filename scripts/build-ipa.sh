#!/bin/sh
# Builds an unsigned HugosPiano.ipa for SideStore (SideStore signs it with your Apple ID),
# and publishes it with a SideStore source (public/sidestore.json) so updates show up in SideStore.
set -e
cd "$(dirname "$0")/.."

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode not active. Install Xcode, then run:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

VERSION=$(node -p "require('./package.json').ios.version")
BUILD=$(node -p "require('./package.json').ios.build")

# The previous .ipa must not end up inside the new app bundle (public/ is copied into it).
rm -f public/ipa/*.ipa
npm run build:ios

cd ios/App
rm -rf build Payload && mkdir -p build
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD" \
  build > build/xcodebuild.log 2>&1 || true
grep -E "error:" build/xcodebuild.log | sort -u || true
grep -q "BUILD SUCCEEDED" build/xcodebuild.log || { echo "Build failed (see ios/App/build/xcodebuild.log)"; exit 1; }

APP=build/Build/Products/Release-iphoneos/App.app
[ -d "$APP" ] || { echo "Build failed: no App.app"; exit 1; }
mkdir Payload && cp -R "$APP" Payload/
rm -f ../../HugosPiano.ipa && zip -qr ../../HugosPiano.ipa Payload
rm -rf Payload
cd ../..

# Publish next to the site: SideStore reads public/sidestore.json and offers the update.
mkdir -p public/ipa
FILE="HugosPiano-$VERSION-$BUILD.ipa"
cp HugosPiano.ipa "public/ipa/$FILE"
SIZE=$(stat -f%z HugosPiano.ipa 2>/dev/null || stat -c%s HugosPiano.ipa)
node scripts/sidestore-source.mjs "$VERSION" "$BUILD" "$FILE" "$SIZE"

echo "Done: $(pwd)/HugosPiano.ipa (version $VERSION, build $BUILD)"
echo "Deploy (npm run deploy) to publish it to SideStore."
