# PathFinder AI

**AI-Powered Career Path & Skill Recommendation System for University Graduates**

PathFinder AI helps graduates connect their education and skills to suitable career paths. It makes career guidance more accessible and helps graduates identify the skills they need to develop.

## How it works

1. **Complete assessment** – major, skills and career interests
2. **Analyze profile** – compare skills with career requirements
3. **Recommend careers** – suggest suitable roles and explain the matches
4. **Build skill roadmap** – show gaps and recommended learning steps

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript, React (Vite) |
| Backend | Node.js, Express, JWT auth, REST API |
| Database | PostgreSQL |
| Recommendation engine | OpenAI / Gemini API with a rule-based fallback |

```
client (React)  ──REST──▶  server (Express + JWT)  ──▶  PostgreSQL
                                   │
                                   └──▶ Recommendation engine
                                        ├─ rule-based scoring (curated career/skill data)
                                        └─ OpenAI / Gemini (optional, with timeout + cache)
```

## Project structure

```
client/                 React app (assessment, results, auth pages)
server/
  data/                 Curated careers and skills (seed data)
  db/schema.sql         Database schema
  scripts/setupDb.js    Creates the schema and loads the seed data
  src/routes/           REST endpoints
  src/services/recommender/
    ruleBased.js        Skill / interest / major scoring and roadmap builder
    aiProvider.js       OpenAI and Gemini clients with timeout
    index.js            Orchestration: shortlist → AI → validation → cache → fallback
  test/                 Unit tests (node:test)
docker-compose.yml      Local PostgreSQL
```

## Getting started

Requirements: Node.js 20.12+ and PostgreSQL 14+ (or Docker).

```bash
npm install                          # installs client and server workspaces
docker compose up -d                 # starts PostgreSQL on localhost:5432
cp server/.env.example server/.env   # then edit JWT_SECRET (and AI keys if wanted)
npm run db:setup                     # creates tables and loads careers/skills
npm run dev:server                   # API on http://localhost:4000
npm run dev:client                   # web app on http://localhost:5173
```

Run the tests with `npm test`.

### Enabling the AI engine

By default (`AI_PROVIDER=none`) recommendations come from the rule-based engine. To use an LLM, set in `server/.env`:

```
AI_PROVIDER=openai        # or gemini
OPENAI_API_KEY=...        # or GEMINI_API_KEY=...
```

The AI only chooses from a shortlist produced by the rule-based engine, and any career it returns that is not in the curated data is discarded. Requests time out after `AI_TIMEOUT_MS`, identical profiles are cached for `AI_CACHE_TTL_MS`, and on any failure the API returns the rule-based results with a notice.

## API

All endpoints are under `/api`. Endpoints marked 🔒 need an `Authorization: Bearer <token>` header.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/auth/register` | Create account `{ fullName, email, password }` → `{ token, user }` |
| POST | `/auth/login` | Log in `{ email, password }` → `{ token, user }` |
| GET 🔒 | `/auth/me` | Current user |
| GET | `/skills`, `/interests`, `/majors`, `/careers` | Catalog data for the assessment |
| GET 🔒 | `/profile` | Saved assessment |
| PUT 🔒 | `/profile` | Save assessment `{ major, graduationYear, interests[], skills[{ skillId, level 1–5 }] }` |
| POST 🔒 | `/recommendations` | Generate recommendations (422 with the missing fields if the assessment is incomplete) |
| GET 🔒 | `/recommendations/latest` | Most recent recommendations |
| POST 🔒 | `/recommendations/:id/feedback` | Rate a recommended career `{ careerId, rating 1–5, comment? }` |

## Feasibility & trade-offs

| Challenge | Solution in this codebase |
| --- | --- |
| Slow or unavailable AI API | Timeout, in-memory cache and rule-based fallback (`server/src/services/recommender/index.js`) |
| Incomplete graduate profiles | Major, at least one interest and three rated skills are required; the API explains what is missing |
| Inaccurate career recommendations | Curated career/skill data (`server/data/`), AI output validated against it, user ratings adjust scores |

**Advantages:** personalized guidance on an accessible web platform.
**Limitations:** the AI engine needs internet/API access, and results are guidance that should be validated with mentors and career services.

## Roadmap (10 weeks)

| Phase | Weeks | Work |
| --- | --- | --- |
| 1 | 1–3 | Figma wireframes, database schema, repository setup |
| 2 | 4–7 | Questionnaire interface, API authentication, database persistence |
| 3 | 8–10 | AI recommendation integration, end-to-end testing, bug fixing |

## Team

Advisor: **Dr. Sibel Boran**

| Member | Role |
| --- | --- |
| Razan Snouno | UI/UX Designer |
| Abdihakim Mohamed Hasan | Frontend Developer |
| Nouraldin L N Yasseen | Backend Developer |
| Elham Abdullahi Mohamed | ML / AI Engineer |
| Şilan Aybek | System Architect |
| Aya I B A Irshaid | Project Manager & QA Lead |
