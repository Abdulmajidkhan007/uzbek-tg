#!/usr/bin/env bash
# "TDLib Android" workflow yig'gan libtdjsonjava.so'larni GitHub Release'dan
# android/app/src/main/jniLibs/ ga yuklaydi. gh CLI (login qilingan) kerak.
#
#   scripts/fetch-tdlib.sh            # release mavjud bo'lmasa 1 bilan chiqadi
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
source "$ROOT/android/tdlib.env"
TAG="tdlib-${TDLIB_VERSION}-${TDLIB_COMMIT:0:7}"
REPO=${GITHUB_REPOSITORY:-Abdulmajidkhan007/uzbek-tg}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
if ! gh release download "$TAG" --repo "$REPO" --pattern 'tdlib-android.zip' --dir "$TMP" 2>/dev/null; then
  echo "TDLib release $TAG topilmadi"
  exit 1
fi
rm -rf "$ROOT/android/app/src/main/jniLibs"
mkdir -p "$ROOT/android/app/src/main/jniLibs"
unzip -q "$TMP/tdlib-android.zip" -d "$TMP/x"
cp -r "$TMP/x/libs/." "$ROOT/android/app/src/main/jniLibs/"
find "$ROOT/android/app/src/main/jniLibs" -name '*.so' | sort
