# uzbek-tg — reja

> Oxirgi yangilanish: 2026-10-11

## Hozirgi holat (koddan)
- Expo SDK 56 ilova ("Pulse Messenger" deb nomlangan): login → SMS kod →
  profil → chatlar, guruhlar, kanallar, sozlamalar ekranlari bor.
- **Backend yo'q:** hamma ma'lumot `src/data/mock` dan; SMS kod doim `12345`.
- Kutubxona versiyalari aralash (masalan `expo-haptics` SDK 53 dan) —
  `npm ci` peer xatosi bilan to'xtaydi.
- 2026-10-11 sandbox'da veb export bilan ishga tushirildi, ekranlar ishlaydi.

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
