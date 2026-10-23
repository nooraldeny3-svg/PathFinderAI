# PathFinder AI — Authentication

Bu doküman kimlik doğrulama (auth) API'lerini, döndükleri cevapları ve bunların nasıl denenebileceğini anlatır. Backend'in genel yapısı için [BACKEND.md](BACKEND.md)'ye bakın.

## Nasıl çalışıyor?

- Kullanıcı kayıt olur veya giriş yapar, sunucu bir **JWT token** döner.
- Client bu token'ı korumalı isteklerde `Authorization: Bearer <token>` header'ı ile gönderir.
- Şifreler veritabanında `bcryptjs` ile hash'lenmiş olarak tutulur, hiçbir response'ta yer almaz.
- Token içinde kullanıcı id'si (`sub`) ve `email` bulunur. Varsayılan geçerlilik süresi **7 gündür** (`JWT_EXPIRES_IN`).
- Login ve register, IP başına **15 dakikada 10 deneme** ile sınırlıdır (rate limiting).

| Dosya | Görevi |
| --- | --- |
| `server/src/routes/auth.js` | `/api/auth/register`, `/login`, `/me` endpoint'leri |
| `server/src/middleware/auth.js` | `signToken()` token üretir, `requireAuth` token'ı doğrular |
| `server/src/middleware/rateLimit.js` | Login/register için deneme limiti |
| `client/src/AuthContext.jsx` | Frontend'de giriş durumu, token `localStorage`'da tutulur |
| `client/src/pages/AuthTest.jsx` | Auth API'lerini denemek için test sayfası |

## Kurulum

```bash
npm install                          # root'tan
docker compose up -d                 # PostgreSQL
cp server/.env.example server/.env   # JWT_SECRET'ı değiştir
npm run db:setup                     # tabloları oluşturur
npm run dev:server                   # API → http://localhost:4000
```

Auth ile ilgili ortam değişkenleri (`server/.env`):

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `JWT_SECRET` | `dev-only-secret` | Token imzalama anahtarı. Production'da zorunludur, yoksa sunucu başlamaz |
| `JWT_EXPIRES_IN` | `7d` | Token geçerlilik süresi (`1h`, `30m`, `7d` gibi) |
| `AUTH_RATE_LIMIT_MAX` | `10` | Pencere içinde IP başına izin verilen login/register denemesi |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit penceresi (milisaniye, varsayılan 15 dk) |

## API

Tüm hatalar aynı formatta döner:

```json
{ "error": "Mesaj" }
```

### POST `/api/auth/register` — Yeni kullanıcı kaydı

**Request body:**

```json
{
  "fullName": "Test User",
  "email": "test@example.com",
  "password": "sifre1234"
}
```

**Başarılı → `201 Created`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "test@example.com",
    "fullName": "Test User"
  }
}
```

Kayıttan sonra ayrıca login olmaya gerek yoktur, dönen token hemen kullanılabilir. Email küçük harfe çevrilip baştaki/sondaki boşluklar silinerek kaydedilir.

**Hatalar:**

| Status | `error` | Ne zaman |
| --- | --- | --- |
| `400` | `A valid email is required` | Email boş veya geçersiz formatta |
| `400` | `Password must be at least 8 characters` | Şifre 8 karakterden kısa |
| `400` | `Full name is required` | `fullName` boş |
| `409` | `An account with this email already exists` | Bu email ile zaten hesap var |
| `429` | `Too many attempts, please try again later` | Deneme limiti aşıldı |
| `500` | `Internal server error` | Beklenmeyen hata (örn. veritabanı kapalı) |

Kontroller tablodaki sırayla yapılır ve ilk hatada durur. Örneğin email ve şifre ikisi birden hatalıysa sadece email hatası döner.

### POST `/api/auth/login` — Giriş

**Request body:**

```json
{
  "email": "test@example.com",
  "password": "sifre1234"
}
```

**Başarılı → `200 OK`:** Register ile aynı formatta `{ token, user }` döner.

**Hatalar:**

| Status | `error` | Ne zaman |
| --- | --- | --- |
| `401` | `Invalid email or password` | Email kayıtlı değil veya şifre yanlış |
| `429` | `Too many attempts, please try again later` | Deneme limiti aşıldı |
| `500` | `Internal server error` | Beklenmeyen hata |

Güvenlik nedeniyle "email bulunamadı" ve "şifre yanlış" durumları için aynı mesaj döner. Böylece bir email'in kayıtlı olup olmadığı dışarıdan anlaşılamaz.

### GET `/api/auth/me` — Giriş yapmış kullanıcı 🔒

**Header:**

```
Authorization: Bearer <token>
```

**Başarılı → `200 OK`:**

```json
{
  "user": {
    "id": 2,
    "email": "test@example.com",
    "fullName": "Test User"
  }
}
```

**Hatalar:**

| Status | `error` | Ne zaman |
| --- | --- | --- |
| `401` | `Authentication required` | `Authorization` header'ı yok veya `Bearer ` ile başlamıyor |
| `401` | `Invalid or expired token` | Token bozuk, yanlış imzalı veya süresi dolmuş |
| `404` | `User not found` | Token geçerli ama kullanıcı veritabanından silinmiş |

Bu endpoint'te rate limit yoktur.

### Rate limiting

- Login ve register için sayaç **ortaktır**. Aynı IP'den 15 dakika içinde toplam 10 deneme yapılabilir.
- Başarılı denemeler de sayılır.
- Limit aşılınca `429` döner ve `Retry-After` header'ı kaç saniye beklenmesi gerektiğini söyler:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 873

{ "error": "Too many attempts, please try again later" }
```

- Sayaçlar bellekte tutulur, sunucu yeniden başlatılınca sıfırlanır. Test ederken limite takılırsanız sunucuyu yeniden başlatmanız yeterlidir.
- Limiti hızlıca denemek için `server/.env` içine `AUTH_RATE_LIMIT_MAX=3` yazabilirsiniz.

## Nasıl denenir?

Önce sunucunun çalıştığından emin olun: `npm run dev:server`

### 1. Web test sayfası

```bash
npm run dev:server     # 1. terminal
npm run dev:client     # 2. terminal
```

Tarayıcıda **http://localhost:5173/auth-test** adresini açın.

- **Register / Login** sekmelerinden formu doldurup gönderin.
- Sağdaki **Response** kutusunda status kodu, süre, varsa `Retry-After` değeri ve dönen JSON görünür.
- Başarılı register/login sonrası token otomatik olarak **Token** kutusuna yazılır. **GET /auth/me** butonu bu token ile istek atar.
- Token'ı silerek veya değiştirerek `401` cevaplarını görebilirsiniz.
- Tarayıcının form kontrolü kapalıdır, böylece hatalı girdiler de sunucuya gider ve `400` cevapları incelenebilir.

### 2. PowerShell

```powershell
# Kayıt
$body = @{ fullName = "Test User"; email = "test@example.com"; password = "sifre1234" } | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/register -ContentType "application/json" -Body $body
$r

# Giriş
$body = @{ email = "test@example.com"; password = "sifre1234" } | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/login -ContentType "application/json" -Body $body
$token = $r.token

# Token ile kullanıcı bilgisi
Invoke-RestMethod -Uri http://localhost:4000/api/auth/me -Headers @{ Authorization = "Bearer $token" }
```

`Invoke-RestMethod` hata durumunda sadece exception gösterir. Status kodunu ve hata mesajını görmek için isteği `try/catch` içine alın:

```powershell
try {
  Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/register -ContentType "application/json" -Body $body
} catch {
  $_.Exception.Response.StatusCode.value__   # örn. 409
  $_.ErrorDetails.Message                    # örn. {"error":"An account with this email already exists"}
}
```

### 3. curl (Git Bash / CMD)

`-i` parametresi status kodunu ve header'ları da gösterir. PowerShell'de `curl` yerine `curl.exe` yazın.

```bash
# Kayıt
curl -i -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d "{\"fullName\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"sifre1234\"}"

# Giriş
curl -i -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"sifre1234\"}"

# Kullanıcı bilgisi (<token> yerine login cevabındaki token'ı yazın)
curl -i http://localhost:4000/api/auth/me -H "Authorization: Bearer <token>"
```

### 4. Postman

1. **Register:** `POST http://localhost:4000/api/auth/register` → **Body** → **raw** → **JSON**:
   ```json
   { "fullName": "Test User", "email": "test@example.com", "password": "sifre1234" }
   ```
2. **Login:** `POST http://localhost:4000/api/auth/login` → aynı şekilde `{ "email": "...", "password": "..." }`
3. **Me:** `GET http://localhost:4000/api/auth/me` → **Authorization** sekmesi → Type: **Bearer Token** → login cevabındaki `token` değerini yapıştırın.

Token'ı her seferinde elle kopyalamamak için Login isteğinin **Scripts → Post-response** kısmına şunu ekleyip Me isteğinde token olarak `{{token}}` yazabilirsiniz:

```js
pm.collectionVariables.set('token', pm.response.json().token);
```

## Kontrol listesi

| Deneme | Beklenen |
| --- | --- |
| Yeni email ile kayıt | `201` + `token` + `user` |
| Aynı email ile tekrar kayıt | `409` |
| Geçersiz email ile kayıt | `400 A valid email is required` |
| 8 karakterden kısa şifre ile kayıt | `400 Password must be at least 8 characters` |
| `fullName` boş kayıt | `400 Full name is required` |
| Doğru bilgilerle giriş | `200` + `token` + `user` |
| Yanlış şifre veya kayıtlı olmayan email ile giriş | `401 Invalid email or password` |
| Geçerli token ile `/me` | `200` + `user` |
| Token olmadan `/me` | `401 Authentication required` |
| Bozuk veya süresi dolmuş token ile `/me` | `401 Invalid or expired token` |
| 15 dk içinde 11. login/register denemesi | `429` + `Retry-After` header'ı |

## Testler

```bash
npm test
```

`server/test/rateLimit.test.js` rate limiter'ın limiti uyguladığını, IP'leri ayrı saydığını ve süre dolunca sıfırlandığını kontrol eder. Auth endpoint'leri için henüz otomatik entegrasyon testi yoktur, bunlar yukarıdaki yöntemlerle elle denenir.
