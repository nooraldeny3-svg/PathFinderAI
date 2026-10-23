# PathFinder AI — Backend

Bu doküman PathFinder AI projesinin **yalnızca backend** tarafını anlatır. Frontend (`client/`) bu dokümanın kapsamı dışındadır; backend onu sadece bir REST API tüketicisi olarak görür.

## Proje ne yapıyor?

PathFinder AI, üniversite mezunlarına bölümlerine, becerilerine ve ilgi alanlarına göre **kariyer önerisi** ve **beceri yol haritası** sunan bir sistemdir. Backend'in görevi:

1. Kullanıcı kaydı / girişi (JWT ile kimlik doğrulama)
2. Kullanıcının değerlendirme (assessment) cevaplarını saklamak: bölüm, mezuniyet yılı, ilgi alanları, beceri seviyeleri (1–5)
3. Bu profili kariyer verisiyle karşılaştırıp kariyer önerileri üretmek (kural tabanlı motor + isteğe bağlı OpenAI / Gemini)
4. Her öneri için eksik becerileri ve öğrenme adımlarını (roadmap) döndürmek
5. Kullanıcıların önerilere verdiği puanları (feedback) saklayıp sonraki skorlamada kullanmak

## Teknolojiler

| Katman | Teknoloji |
| --- | --- |
| Runtime | Node.js 20.12+ (ES modules) |
| Web framework | Express 4 |
| Kimlik doğrulama | JWT (`jsonwebtoken`), şifreler `bcryptjs` ile hash'lenir |
| Veritabanı | PostgreSQL 14+ (`pg` pool, ORM yok, düz SQL) |
| AI | OpenAI veya Gemini REST API (opsiyonel) |
| Test | Node'un yerleşik test runner'ı (`node:test`) |

## Klasör yapısı

```
server/
  .env.example               Ortam değişkenleri şablonu
  data/
    careers.json             14 kariyer + gerekli beceriler (seed verisi)
    skills.json              32 beceri + öğrenme kaynakları (seed verisi)
  db/schema.sql              Tablo tanımları
  scripts/setupDb.js         Şemayı oluşturur ve seed verisini yükler (tekrar çalıştırılabilir)
  src/
    index.js                 Sunucuyu başlatır
    app.js                   Express uygulaması, route bağlama, 404 ve hata yakalayıcı
    config.js                .env okuma ve konfigürasyon
    db.js                    PostgreSQL pool, query() ve withTransaction()
    errors.js                HttpError, asyncHandler, errorHandler
    interests.js             Sabit ilgi alanı listesi (software, data, ai, ...)
    middleware/auth.js       signToken() ve requireAuth
    routes/
      auth.js                /api/auth/*
      catalog.js             /api/skills, /interests, /majors, /careers
      profile.js             /api/profile
      recommendations.js     /api/recommendations/*
    services/
      careers.js             loadCareers(), loadAssessment()
      recommender/
        ruleBased.js         Skorlama, roadmap ve açıklama üretimi
        aiProvider.js        OpenAI / Gemini çağrıları (timeout'lu)
        index.js             Orkestrasyon: shortlist → AI → doğrulama → cache → fallback
  test/recommender.test.js   Öneri motoru birim testleri
docker-compose.yml           Lokal PostgreSQL 16
```

## Kurulum ve çalıştırma

```bash
npm install                          # root'tan, workspace'leri kurar
docker compose up -d                 # PostgreSQL → localhost:5432
cp server/.env.example server/.env   # JWT_SECRET'ı değiştir
npm run db:setup                     # tabloları oluşturur, kariyer/beceri verisini yükler
npm run dev:server                   # API → http://localhost:4000 (node --watch)
npm test                             # birim testleri
```

Sağlık kontrolü: `GET http://localhost:4000/api/health` → `{ "status": "ok" }`

### Ortam değişkenleri (`server/.env`)

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `PORT` | `4000` | API portu |
| `DATABASE_URL` | `postgres://pathfinder:pathfinder@localhost:5432/pathfinder` | PostgreSQL bağlantısı |
| `JWT_SECRET` | `dev-only-secret` | Production'da zorunlu, yoksa sunucu başlamaz |
| `JWT_EXPIRES_IN` | `7d` | Token süresi |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS için izin verilen origin |
| `AUTH_RATE_LIMIT_MAX` | `10` | IP başına pencere içinde izin verilen login/register denemesi |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit penceresi (15 dk) |
| `AI_PROVIDER` | `none` | `openai`, `gemini` veya `none` (sadece kural tabanlı) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-4o-mini` | OpenAI ayarları |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | — / `gemini-2.0-flash` | Gemini ayarları |
| `AI_TIMEOUT_MS` | `15000` | AI isteği zaman aşımı |
| `AI_CACHE_TTL_MS` | `3600000` | Aynı profil için AI sonucunun cache süresi |

## Veritabanı

| Tablo | İçerik |
| --- | --- |
| `users` | `id`, `email` (unique), `password_hash`, `full_name` |
| `profiles` | Kullanıcı başına bir satır: `major`, `graduation_year`, `interests TEXT[]` |
| `skills` | Beceri kataloğu: `name`, `category`, `learning_resource` |
| `user_skills` | Kullanıcının beceri seviyesi, `level` 1–5 |
| `careers` | Kariyer kataloğu: `slug`, `title`, `description`, `field`, `related_majors[]`, `interests[]` |
| `career_skills` | Kariyerin gerektirdiği beceriler: `importance` 1–3, `min_level` 1–5 |
| `recommendations` | Üretilen öneriler: `source` (`ai` / `rules`), `payload JSONB` |
| `feedback` | Bir öneri içindeki kariyere verilen puan (1–5) ve yorum |

Kariyer ve beceri verisi `server/data/*.json` dosyalarından gelir. Yeni kariyer/beceri eklemek için JSON'u düzenleyip `npm run db:setup` tekrar çalıştırılır (upsert yapar, mevcut veriyi bozmaz).

## API

Tüm endpoint'ler `/api` altındadır. 🔒 işaretliler `Authorization: Bearer <token>` header'ı ister.

| Method | Path | Açıklama |
| --- | --- | --- |
| POST | `/auth/register` | `{ fullName, email, password }` → `201 { token, user }` |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET 🔒 | `/auth/me` | Giriş yapmış kullanıcı |
| GET | `/skills` | Beceri listesi |
| GET | `/interests` | İlgi alanı listesi |
| GET | `/majors` | Kariyerlerden türetilen bölüm listesi |
| GET | `/careers` | Kariyerler + gerekli beceriler |
| GET 🔒 | `/profile` | Kayıtlı değerlendirme |
| PUT 🔒 | `/profile` | `{ major, graduationYear, interests[], skills[{ skillId, level }] }` (önceki becerilerin yerine geçer) |
| POST 🔒 | `/recommendations` | Öneri üretir ve kaydeder → `201` |
| GET 🔒 | `/recommendations/latest` | Son öneri (yoksa `404`) |
| POST 🔒 | `/recommendations/:id/feedback` | `{ careerId, rating 1–5, comment? }` → `204` |

### Hata formatı

Tüm hatalar aynı şekilde döner:

```json
{ "error": "Mesaj", "details": ["opsiyonel ek bilgi"] }
```

| Kod | Ne zaman |
| --- | --- |
| 400 | Geçersiz girdi (email, şifre < 8 karakter, bilinmeyen ilgi alanı, seviye 1–5 dışında...) |
| 401 | Token yok / geçersiz, ya da yanlış email-şifre |
| 404 | Kayıt veya endpoint bulunamadı |
| 409 | Bu email ile hesap zaten var |
| 422 | Değerlendirme eksik; `details` eksik alanları listeler (`major`, `interests`, `skills (at least 3)`) |
| 429 | Login/register deneme limiti aşıldı; `Retry-After` header'ı kaç saniye bekleneceğini söyler |
| 500 | Beklenmeyen hata (detay sadece sunucu loguna yazılır) |

### Öneri yanıtı örneği

```json
{
  "id": 12,
  "source": "rules",
  "createdAt": "2026-10-23T10:00:00.000Z",
  "notice": "Sadece AI başarısız olduğunda bulunur",
  "recommendations": [
    {
      "careerId": 2,
      "title": "Backend Developer",
      "field": "Software Engineering",
      "description": "...",
      "score": 78,
      "explanation": "You already meet the expected level in Node.js, SQL. ...",
      "matchedSkills": ["Node.js", "SQL"],
      "roadmap": [
        { "skill": "REST API Design", "currentLevel": 1, "targetLevel": 3, "priority": "high", "step": "..." }
      ]
    }
  ]
}
```

## Öneri motoru nasıl çalışır?

### 1. Kural tabanlı skorlama (`ruleBased.js`)

Her kariyer için 0–100 arası skor:

```
skor = 0.65 × beceri_skoru + 0.20 × ilgi_skoru + 0.15 × bölüm_eşleşmesi + feedback_düzeltmesi
```

- **Beceri skoru:** Her gerekli beceri için `min(kullanıcı_seviyesi / min_level, 1)`, `importance` ile ağırlıklı ortalama.
- **İlgi skoru:** Kariyerin ilgi alanlarından kullanıcıyla ortak olanların oranı.
- **Bölüm eşleşmesi:** Kullanıcının bölümü `related_majors` içinde ise 1 (büyük/küçük harf duyarsız).
- **Feedback düzeltmesi:** Kariyerin ortalama kullanıcı puanı skoru en fazla ±5 puan kaydırır.

`min_level`'a ulaşılmayan beceriler **roadmap**'e girer; önce `importance`, sonra açık büyüklüğüne göre sıralanır (`importance` 3 → `high`, 2 → `medium`, 1 → `low`).

### 2. AI katmanı (`index.js`, `aiProvider.js`)

`AI_PROVIDER` ve ilgili API key ayarlıysa:

1. Kural motoru en iyi **8 kariyerlik shortlist** çıkarır.
2. AI sadece bu shortlist'ten en fazla 5 kariyer seçer, sıralar, açıklama ve roadmap yazar (JSON formatında).
3. Dönen cevap doğrulanır: shortlist'te olmayan kariyerler atılır, başlık/açıklama gibi alanlar küratörlü veriden doldurulur, skor 0–100'e sıkıştırılır.
4. Sonuç, profil hash'i (SHA-256) anahtarıyla bellekte cache'lenir.
5. Timeout, ağ hatası veya kullanılamaz cevap durumunda **kural tabanlı sonuç** döner ve `notice` alanı eklenir.

AI kapalıyken sistem tamamen kural tabanlı çalışır; API key olmadan da geliştirme yapılabilir.

## Kod kuralları

- Route handler'lar `asyncHandler(...)` ile sarılır; hata fırlatmak için `throw new HttpError(status, mesaj, details)`.
- Korumalı route'larda `requireAuth` kullanılır; kullanıcı id'si `req.userId` içindedir.
- SQL her zaman parametreli (`$1, $2 ...`) yazılır, string birleştirme yapılmaz.
- Birden fazla yazma işlemi içeren işlemler `withTransaction(async (client) => ...)` içinde yapılır.
- İş mantığı `services/` altında, HTTP katmanı `routes/` altında tutulur.
- Öneri motorunda değişiklik yapılırsa `server/test/recommender.test.js` güncellenir ve `npm test` çalıştırılır.

## Bilinen sınırlamalar / yapılabilecekler

- AI cache'i bellekte tutulur; sunucu yeniden başlarsa silinir ve birden fazla instance arasında paylaşılmaz.
- Login/register rate limit sayaçları bellekte tutulur (`middleware/rateLimit.js`); sunucu yeniden başlarsa sıfırlanır ve birden fazla instance arasında paylaşılmaz. Proxy arkasında çalıştırılırsa doğru IP için Express'te `trust proxy` ayarlanmalı.
- Route'lar için entegrasyon testi yok (sadece öneri motoru birim testleri var).
- Veritabanı migration aracı yok; şema değişiklikleri `schema.sql` üzerinden `CREATE TABLE IF NOT EXISTS` ile yapılıyor, mevcut tabloya kolon eklemek elle `ALTER TABLE` gerektirir.
