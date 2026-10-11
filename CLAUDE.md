# uzbek-tg — loyiha qoidalari

> Repo nomi: `uzbek-tg` (avval `chat-app`). Telegram uchun uchinchi tomon
> mijozi (Plus Messenger, Nicegram kabi): haqiqiy Telegram akkaunti bilan
> ishlaydi, ustiga ghost mode va boshqa qo'shimchalar.
> Reja va holat: `docs/REJA.md` — yangi sessiya shundan boshlaydi.

## Qarorlar (2026-10-11, egasi tasdiqlagan)
- Mobil: **bare React Native CLI** (Expo emas). Hozirgi kod Expo'da — 0-faza
  uni RN CLI'ga ko'chiradi (KidsWear/Lumina'dagi kabi: CI'da APK, crash ekrani).
- Telegram bilan aloqa: **TDLib** (rasmiy kutubxona), native modul orqali.
  O'z MTProto'mizni yozmaymiz.
- Hozirgi Pulse UI (ekranlar, komponentlar) saqlanadi; `src/services/mock` va
  `src/data/mock` o'rniga TDLib qatlami keladi.

## Qoidalar
- Til: o'zbekcha; texnik atamalar inglizcha.
- `api_id` / `api_hash` (my.telegram.org) — **kalit**. Repoga, logga, chatga
  tushmaydi; faqat GitHub Actions secret (`TG_API_ID`, `TG_API_HASH`) →
  build vaqtida BuildConfig'ga.
- Ilova nomida "Telegram" so'zi rasmiy ilovadek ishlatilmaydi.
- Rasmiy Telegram ilovalari kodi GPL — undan kod ko'chirilmaydi (faqat g'oya).
  TDLib — Boost litsenziyasi, ishlatish mumkin.
- Holatni bo'rttirmaslik: ishlamaydigan narsa "tayyor" deb yozilmaydi.
- Har bosqichdan keyin commit + push `main` ga; PR faqat so'ralsa.
