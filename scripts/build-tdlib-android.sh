#!/usr/bin/env bash
# TDLib (JSON + Java wrapper, ya'ni org.drinkless.tdlib.JsonClient) ni Android
# uchun yig'adi. TDLib'ning o'z example/android skriptlaridan foydalanadi.
#
#   scripts/build-tdlib-android.sh <td-manba-papkasi> <android-sdk> <chiqish-papkasi> [ABI'lar]
#
# Natija: <chiqish>/libs/<ABI>/libtdjsonjava.so va <chiqish>/java/.../JsonClient.java
set -euo pipefail

TD_DIR=$(cd "$1" && pwd)
SDK=$(cd "$2" && pwd)
OUT=$(mkdir -p "$3" && cd "$3" && pwd)
ABIS=${4:-"arm64-v8a armeabi-v7a"}
NDK_VERSION=${NDK_VERSION:-27.1.12297006}
API_LEVEL=24

cd "$TD_DIR/example/android"
if [ ! -d third-party/openssl ]; then
  ./build-openssl.sh "$SDK" "$NDK_VERSION" third-party/openssl
fi
./build-tdlib.sh "$SDK" "$NDK_VERSION" third-party/openssl c++_static JSONJava "$API_LEVEL" "$ABIS"

rm -rf "$OUT/libs" "$OUT/java"
cp -r tdlib/libs "$OUT/libs"
cp -r tdlib/java "$OUT/java"
rm -f "$OUT"/libs/*/*.debug
find "$OUT" -type f | sort
