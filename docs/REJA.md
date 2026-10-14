# uzbek-tg — reja

> Oxirgi yangilanish: 2026-10-12 (0-faza tasdiqlandi; 1-faza kodi yozildi)

## Hozirgi holat (koddan)
- **Bare React Native CLI 0.85.3** (New Architecture, Hermes), Expo olib
  tashlandi. `android/` — KidsWear namunasidan: `org.uzbektg.app`,
  crash ekrani (`CrashActivity`, alohida `:crash` jarayonda).
- Ekranlar (Pulse UI) endi **TDLib**'ga ulangan (1-faza, quyida). Mock faqat
  `TopicDetailScreen`da qoldi (forum topic'lar hali yo'q, ekranga yo'l ham yo'q).
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
- **2026-10-12: egasi `apk-1` ni telefonda ochdi, mock ekranlar ishladi — 0-faza
  tayyor.** (Birinchi yuklab olish buzilgan edi: `INSTALL_PARSE_FAILED_NO_CERTIFICATES`,
  qayta yuklab olinganda o'rnatildi.)

### 1-faza: TDLib (kod yozildi, telefonda hali sinalmagan)
- TDLib 1.8.68 (`android/tdlib.env` dagi commit), **JSONJava** interfeysi:
  `libtdjsonjava.so` + `org.drinkless.tdlib.JsonClient` (Boost litsenziyasi).
  - Yig'ish: `scripts/build-tdlib-android.sh` (TDLib'ning `example/android`
    skriptlari, NDK 27, API 24, arm64-v8a + armeabi-v7a).
  - CI: `.github/workflows/tdlib-android.yml` — faqat `tdlib.env` o'zgarganda
    yig'ib, `tdlib-<versiya>-<commit7>` release'ga `tdlib-android.zip` qo'yadi
    (`--latest=false`, APK havolasi buzilmaydi).
  - APK workflow'i `scripts/fetch-tdlib.sh` bilan shu release'dan oladi; release
    hali bo'lmasa APK chiqarmaydi va TDLib tugagach (`workflow_run`) qayta ishlaydi.
- Native modul: `android/.../tdlib/TdlibModule.kt` — `start/send/execute`,
  javob va update'lar `tdlib` event'i (JSON matn). `setTdlibParameters` shu
  yerda yuboriladi: `api_id`/`api_hash` **BuildConfig'dan**, JS'ga chiqmaydi.
- Kalitlar: `TG_API_ID`, `TG_API_HASH` — GitHub repository secret'lari →
  build vaqtida env → `BuildConfig`. Berilmasa ilova "Ulanib bo'lmadi" ekranini
  ko'rsatadi. **Eslatma:** kalit APK ichiga yoziladi, APK'ni decompile qilgan odam
  uni ko'rishi mumkin (barcha Telegram mijozlarida shunday) — APK'ni ommaga
  tarqatmaslik kerak.
- JS: `src/services/tdlib/` — `client.ts` (so'rov/javob `@extra` bilan),
  `auth.ts` (telefon → kod → 2FA parol → ro'yxatdan o'tish → `ready`),
  `chats.ts` (chatlar ro'yxati update'lardan, tarix, matn yuborish, reaksiya,
  pin, o'chirish, uzatish, kontaktlar, qidiruv, a'zolar, bloklash, mute),
  `files.ts` (avatarlarni yuklab olish).
- Ulangan ekranlar: Login, OTP (kod uzunligi TDLib'dan), Password (yangi),
  ProfileSetup (`registerUser`), ChatList, ChatDetail, Forward, Contacts,
  Search, Profile, GroupInfo, ChannelInfo, BlockedUsers, EditProfile, Settings
  (chiqish, kesh tozalash).
- Hali yo'q (2-faza): media ko'rsatish/yuborish (rasm/video/ovoz xabarlarda
  hozircha "📷 Rasm" kabi matn), "yozmoqda" ko'rsatkichi, javob (reply) preview,
  push bildirishnomalar. "O'qildi" faqat chat ochilganda `markRead` orqali
  yuboriladi (ghost mode shu nuqtaga ulanadi).
- Sandbox'da tekshirilgan: TDLib arm64 lokal yig'ildi; `tsc` toza; JS bundle
  yig'iladi; barcha TDLib so'rov/maydon nomlari 1.8.68 `td_api.tl` bilan
  solishtirildi.

### 2-faza (boshlandi, 2026-10-13)
- Egasi haqiqiy akkaunt bilan kirdi: chatlar, guruhlar, qidiruv ishlaydi (1-faza tasdiqlandi).
- Media xabarlar (`src/components/chat/MediaContent.tsx`): rasm (minithumbnail → to'liq),
  video/GIF/dumaloq video-xabar (oldindan ko'rinish + to'liq ekranda `react-native-video`),
  stiker (webp; animatsiyali — statik thumbnail), ovozli xabar va audio (yuklab olib ijro,
  waveform), fayl (yuklab olish). Galereyaga saqlash/ulashish hali yo'q.
- Guruh/kanal a'zolari soni (`updateBasicGroup`/`updateSupergroup`), qidiruvda nomsiz
  foydalanuvchi tuzatildi.
- Tizim `Alert` o'rniga Telegram uslubidagi dialog/pastki menyu (`components/ui/Dialog.tsx`).
  Qo'ng'iroq tugmalari olib tashlandi (TDLib qo'ng'iroqlari uchun WebRTC kerak — keyinroq).
- **Telegram uslubidagi UI (2026-10-13, kod yozildi, telefonda hali sinalmagan):**
  - Yangi ikonka (ko'k-yashil fon, oq "UZ" pufakcha), "Pulse" nomlari "Uzbek TG" ga.
  - Chatlar: sarlavhada ulanish holati ("Ulanmoqda..." / "Yangilanmoqda..."),
    papka tablari (Telegram'dagi chat folders, o'qilmaganlar soni bilan), arxiv qatori va
    Arxiv ekrani, qadalgan/ovozsiz belgilari, ✓/✓✓, guruhda yuboruvchi nomi,
    "yozmoqda..." (`updateChatAction`, chat sarlavhasida ham).
  - Uzoq bosish menyusi: qadash, ovozsiz, o'qilgan deb belgilash, arxivlash,
    o'chirish/chiqish.
  - Pastda suzuvchi "pill" panel: Chatlar / Kontaktlar / Sozlamalar / Profil
    (chat ichida yashiriladi). Qidiruv chatlar sarlavhasidagi tugmada.
  - Sozlamalar: markazda avatar, telefon • @username, rangli bo'limlar;
    yangi ekranlar — Qurilmalar (seanslar, tugatish), Ma'lumotlar va xotira
    (kesh hajmi, tozalash), Chat papkalari (faqat ko'rish).
  - Profil tabi: Rasm qo'yish / Tahrirlash / Sozlamalar, telefon, bio, username.

#### 2026-10-14: katta yangilanish (kod yozildi, telefonda hali sinalmagan)
- 3 til (uz/en/ru): `src/i18n/` (`useT`, `t`, ko'plik shakllari), Til ekrani.
- Native modul `AppNative` (Kotlin, kutubxonasiz): ekran surati (mavzu animatsiyasi),
  ovoz yozish (OGG/Opus, Android 10+; eskida AAC→audio), fayl tanlash, bildirishnoma,
  galereyaga saqlash, ulashish/ochish (FileProvider), tarmoq turi.
- Mavzu: Telegram'ga yaqin ranglar, 7 ta asosiy rang, kunduzgi/tungi rejimga doira
  animatsiyasi bilan o'tish (`ThemeReveal`, react-native-svg mask).

#### Telegram bilan tenglik ro'yxati (ghost mode'dan oldin)
| Funksiya | Holat |
|---|---|
| Kirish (kod, 2FA), chiqish | ✅ ishlaydi |
| Chatlar ro'yxati, papkalar, arxiv, qadash/ovozsiz/arxivlash | ✅ egasi ko'rdi (2026-10-13) |
| Matn yuborish, reaksiya, o'chirish, uzatish, pin | ✅ ishlaydi |
| Rasm/video/ovoz/fayl ko'rish va ijro | ✅ ishlaydi |
| Formatlangan matn, havolalar, inline tugmalar, ko'rishlar, xizmat xabarlari | ⏳ kod yozildi |
| Javob (reply), tahrirlash, qoralama, "yozmoqda" yuborish | ⏳ kod yozildi |
| Rasm/video/fayl yuborish, ovozli xabar yozish | ⏳ kod yozildi |
| Galereyaga saqlash, ulashish, faylni ochish | ⏳ kod yozildi |
| Maxfiylik (haqiqiy qoidalar), 2FA, avto-o'chirish, akkaunt TTL | ⏳ kod yozildi (istisno ro'yxatini tahrirlash yo'q) |
| Bildirishnomalar sozlamalari (TDLib doiralari) | ⏳ kod yozildi |
| Telefon bildirishnomalari | ⏳ faqat ilova jarayoni tirik paytda; yopiq ilovaga push uchun Firebase kerak |
| Akkaunt (ism, bio, username, tug'ilgan kun) | ⏳ kod yozildi (raqam almashtirish yo'q) |
| Qurilmalar, seanslarni tugatish, avto-tugatish | ⏳ kod yozildi (QR kirish yo'q) |
| Xotira (diagramma, toifa bo'yicha tozalash, saqlash muddati, chegarasi) | ⏳ kod yozildi |
| Trafik statistikasi, avto-yuklash, proxy | ⏳ kod yozildi |
| Papka yaratish/tahrirlash/o'chirish | ⏳ kod yozildi |
| Chat sozlamalari (shrift, burchak, fon, rang, kun/tun) | ⏳ kod yozildi |
| 3 til | ⏳ kod yozildi |
| Izohlar (post thread), albomlar bitta bubble'da, animatsiyali stiker | ❌ yo'q / qisman |
| Qo'ng'iroqlar | ❌ (WebRTC kerak) |

### Release imzo kaliti
- `.github/workflows/release-keystore.yml` (qo'lda, `confirm=HA`) — PKCS12 kalit
  (alias `uzbektg`, RSA 4096, tasodifiy parol) yaratib, 1 kunlik artifact beradi.
- Egasi 2 ta secret qo'yadi: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`;
  `.jks` faylni zaxiralaydi (yo'qolsa ilovani yangilab bo'lmaydi).
- APK workflow'i secret bo'lsa release kalit bilan, bo'lmasa debug kalit bilan
  imzolaydi (release notes'da `Imzo: release|debug`). Debug → release o'tishda
  telefondagi ilovani bir marta o'chirib qayta o'rnatish kerak.

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
