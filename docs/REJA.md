# uzbek-tg — reja

> Oxirgi yangilanish: 2026-10-11 (0-faza kodi yozildi)

## Hozirgi holat (koddan)
- **Bare React Native CLI 0.85.3** (New Architecture, Hermes), Expo olib
  tashlandi. `android/` — KidsWear namunasidan: `org.uzbektg.app`,
  crash ekrani (`CrashActivity`, alohida `:crash` jarayonda).
- Ekranlar (Pulse UI): login → SMS kod → profil → chatlar, guruhlar,
  kanallar, sozlamalar. **Backend yo'q:** hamma ma'lumot `src/data/mock` dan;
  SMS kod doim `12345`.
- CI: `.github/workflows/apk-release.yml` — `main` ga push'da APK yig'ib,
  GitHub Release'ga `uzbek-tg.apk` qo'yadi (versionCode = run raqami).
  Havola: `releases/latest/download/uzbek-tg.apk`.

### 0-faza: Expo → RN CLI almashtirishlar
| Expo | O'rniga |
|---|---|
| `@expo/vector-icons` (Ionicons) | `react-native-vector-icons/Ionicons` (faqat `Ionicons.ttf` APK'ga) |
| `expo-haptics` | `src/utils/haptics.ts` (xuddi shu API) → `react-native-haptic-feedback` |
| `expo-image` | RN `Image` (`resizeMode`); kesh/transition yo'q |
| `expo-image-picker` | `react-native-image-picker` (`launchImageLibrary`; kesish/crop yo'q) |
| `expo-status-bar` | RN `StatusBar` |
| RN core `Clipboard` (eskirgan) | `@react-native-clipboard/clipboard` |
| reanimated 3 | reanimated 4.6 + `react-native-worklets` 0.12 |
| flash-list 1 | flash-list 2 (`estimatedItemSize` olib tashlandi, `FlashListRef`) |
- Ishlatilmagan `expo-av`, `expo-document-picker`, `expo-file-system`,
  `react-native-svg`, `react-native-image-viewing` olib tashlandi
  (ovozli xabar/hujjat — 2-fazada TDLib bilan birga qaytadi).
- Tekshirilgan (2026-10-11, sandbox): `tsc --noEmit` toza;
  `./gradlew assembleRelease` (arm64-v8a, JDK 17) o'tdi — APK 28 MB,
  `org.uzbektg.app`, ichida JS bundle, `Ionicons.ttf`, hermes/reanimated/
  worklets `.so`. **Telefonda/emulatorda ochilishi hali tasdiqlanmagan**
  (sandbox'da KVM yo'q) — birinchi CI APK'ni egasi o'rnatib ko'rishi kerak.

## Maqsad
Telegram mijozi: haqiqiy akkaunt bilan kirish, chatlar, xabarlar, media;
ustiga **ghost mode** (o'qilgan belgisi yo'q, "online" yo'q, "yozmoqda" yo'q)
va boshqa qo'shimchalar. Platforma: avval Android, keyin iOS.

## Ilova identifikatori
- Android `applicationId`: **`org.uzbektg.app`**.
  `com.uzbek-tg.org` bo'lmaydi: Java paket nomida `-` belgisi taqiqlangan va
  domen teskari yoziladi (`uzbektg.org` → `org.uzbektg`).
- Ko'rinadigan nom: **Uzbek TG** (o'zgartirish mumkin; "Telegram" so'zisiz).

## Fazalar
**0. RN CLI'ga ko'chirish**
- Expo'ni olib tashlash, `android/` (bare RN 0.85, New Architecture).
- `expo-*` modullar o'rniga RN muqobillari (vector-icons, image-picker,
  document-picker, haptics, audio).
- CI: `apk-release.yml` (KidsWear'dagidek: GitHub Release'ga `uzbek-tg.apk`,
  versionCode = run raqami, crash ekrani).
- Tayyor mezoni: APK telefonda ochiladi, mock ma'lumot bilan ekranlar ishlaydi.

**1. TDLib ulash (Android)**
- TDLib'ni Android uchun yig'ish (CI'da, kesh bilan) yoki tekshirilgan
  prebuilt; `td_json_client` JSON interfeysi → Kotlin native modul → JS.
- `TG_API_ID` / `TG_API_HASH` secret'dan BuildConfig'ga.
- Kirish oqimi: telefon → kod → (bo'lsa) 2FA parol → chatlar.
- Tayyor mezoni: haqiqiy akkaunt bilan kirib, chatlar ro'yxati ko'rinadi.

**2. Asosiy messenjer**
- Xabarlarni o'qish/yuborish, media yuklab olish/yuborish, guruh va kanallar,
  bildirishnomalar.

**3. Qo'shimchalar**
- Ghost mode: `viewMessages` chaqirilmaydi (o'qilgan belgisi ketmaydi),
  `online` holati yuborilmaydi, `sendChatAction` (yozmoqda) o'chiriladi.
- Keyingi g'oyalar alohida yoziladi (egasi bilan kelishib).

**4. iOS**
- TDLib iOS build, App Store talablari.

## Keyingi sessiya uchun
Repo: `uzbek-tg`. "CLAUDE.md va docs/REJA.md ni o'qi, 0-fazani boshla:
Expo'dan bare RN CLI'ga ko'chir (KidsWear repodagi android/ va apk-release.yml
namuna), mock ma'lumot bilan APK telefonda ochilsin."
