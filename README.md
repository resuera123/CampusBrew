# CampusBrew

CIT-U Campus Beverage Delivery System — a mobile ordering and delivery platform
connecting students, campus beverage shops, and student delivery personnel
("dashers"). Built for IT332 Capstone (SRS/SDD v2.0).

Customers browse shops and order drinks; shop operators manage their menu,
order queue and sales; dashers accept delivery offers, stream live location,
and settle payment (GCash or Cash on Delivery). An admin reviews verification,
dasher and shop applications, handles reports and support messages, and manages
suspensions — in the app or on the website.

| | Link |
|---|---|
| 🌐 Website | https://campusbrew.onrender.com |
| 📱 Download the Android app | https://campusbrew.onrender.com/download |
| 🛠️ Admin panel | https://campusbrew.onrender.com/admin/login |
| ⚙️ Backend API | https://campusbrew-backend.onrender.com |

> The backend runs on Render's free plan and sleeps when idle — the first
> request after a while can take up to a minute.

---

## Download the app (Android)

1. On an Android phone, open **https://campusbrew.onrender.com/download** and tap
   **Download for Android**. (Google Drive shows a warning for app files — tap
   **Download anyway**.)
2. Open the downloaded `CampusBrew.apk`. If asked, allow installs from this
   source.
3. Sign up, verify your email, and start ordering.

The APK connects to the live backend on Render — no laptop or Metro needed.
iOS isn't available.

---

## Roles

| Role | What they do |
|------|--------------|
| **Customer** | Orders drinks (GCash or COD once CIT-U verified), tracks delivery live, chats, rates, tips, reports payment problems |
| **Dasher** | A verified customer approved by the admin; switches between ordering and delivering, accepts offers, earns a weekly incentive |
| **Shop operator** | A shop approved by the admin; manages menu, availability and orders, sees sales reports |
| **Admin** | One seeded account; reviews verification / dasher / shop applications, reports, support messages and suspensions |

---

## Tech stack

| Layer      | Technology |
|------------|------------|
| Mobile app | Expo SDK 54 · React Native 0.81 · TypeScript · React Navigation v7 |
| Website    | Vite · React · TypeScript · React Router (landing pages + admin panel) |
| Backend    | Spring Boot 3.5 (Java 17) · layered Controller → Service → Repository + DTOs |
| Database   | MongoDB Atlas (Spring Data MongoDB; TTL + 2dsphere geospatial indexes) |
| Auth       | JWT; email codes (sign-up, password reset, CIT-U verification) via Brevo in production, Gmail SMTP locally |
| Realtime   | Plain Spring WebSocket at `/ws` (shares the HTTP port) |
| Payments   | Xendit e-wallet (GCash) with signed webhooks and refunds; Cash on Delivery |
| Maps       | Leaflet + OpenStreetMap in a WebView (no API key, no billing) |
| Push       | Expo Push Service + in-app realtime alerts (see [Push notifications](#push-notifications)) |
| App builds | EAS Build (Android APK) |

## Repository layout

```
CampusBrew/
├── campusbrew-api/      Spring Boot backend (Maven)
├── CampusBrew/          Expo React Native client
├── CampusBrewWebSite/   Vite + React website and admin panel
├── ARCHITECTURE.md      Detailed system/module design
└── README.md            This file
```

---

## Prerequisites

- **Java 17** (Temurin recommended) and the bundled Maven wrapper (`./mvnw`)
- **Node.js 18+** and npm (Node 22 for the website build on Render)
- **Expo Go** app on a physical device, or an Android/iOS emulator
- Access to the team's **MongoDB Atlas** cluster
- For email codes: a **Gmail App Password** (local) or a **Brevo** API key (production)
- *(Optional, for payments)* a **Xendit** test account with a secret key and
  webhook callback token
- *(Optional, for APK builds)* an **Expo account** and `npm install -g eas-cli`

---

## Backend setup (`campusbrew-api`)

The real `application.properties` holds secrets and is **gitignored**. Copy the
template and fill it in:

```bash
cd campusbrew-api
cp src/main/resources/application.properties.example src/main/resources/application.properties
```

Edit `src/main/resources/application.properties` and set at least:

| Key | What to put |
|-----|-------------|
| `spring.data.mongodb.uri` | Your Atlas connection string (`mongodb+srv://…`) |
| `jwt.secret` | A long random string — `openssl rand -base64 48` |
| `spring.mail.username` / `spring.mail.password` | Gmail address + App Password (for email codes) |
| `admin.email` / `admin.password` | The admin account created at startup |
| `xendit.secretKey` / `xendit.callbackToken` | *(Optional)* Xendit test credentials |

> ⚠️ **Never commit secrets.** Only `application.properties.example` (placeholders)
> and `application-prod.properties` (env-var references) are tracked. The real
> `application.properties` stays local.

Run it:

```bash
./mvnw spring-boot:run        # starts on http://localhost:8080
./mvnw test                   # run the test suite
./mvnw clean package          # build the runnable jar (target/*.jar)
```

The REST API and the `/ws` realtime endpoint both listen on **port 8080**.

## Mobile app setup (`CampusBrew`)

```bash
cd CampusBrew
npm install
npx expo start               # scan the QR with Expo Go, or press a/i for emulators
npx expo start --no-dev      # same, but talks to the live Render backend
```

**How the client finds the backend** — see [`src/constants/api.ts`](CampusBrew/src/constants/api.ts):

- In **dev** (`__DEV__`), the API host is auto-detected from the Metro bundle
  URL, so it follows whatever network you're on (campus wifi, phone hotspot, …)
  with no edits. If auto-detection ever picks the wrong host, set `MANUAL_HOST`
  at the top of that file.
- In **production builds** (the APK, or `--no-dev`), it uses `PROD_BASE`
  (`https://campusbrew-backend.onrender.com`).
- The realtime socket shares the same host/port: `http → ws`, `https → wss`,
  path `/ws`.

For dev against a local backend, your phone/emulator and the machine running it
must be on the **same network**.

### Building the Android APK

Builds run on Expo's servers (EAS) using the `preview` profile in
[`eas.json`](CampusBrew/eas.json), which produces an installable APK.

1. Raise `expo.android.versionCode` in [`app.json`](CampusBrew/app.json) (Android
   only installs an update over the old app when this number goes up).
2. Build:
   ```bash
   cd CampusBrew
   eas login                                  # first time only
   eas build -p android --profile preview
   ```
3. Download the APK from the link EAS prints (or `eas build:list --platform android --limit 1`).
4. Replace the APK on Google Drive with **Manage versions → Upload new version**,
   so the link on the website's Download page stays the same. If the size changes,
   update it in [`Download.tsx`](CampusBrewWebSite/src/pages/Download.tsx).

### Push notifications

Order updates, chat messages, new-order alerts for shops and delivery offers for
dashers arrive over the WebSocket while the app is open. A shop also gets a
"New order received" phone notification with sound from the app itself.

Server-sent push (the Expo Push Service) needs Firebase credentials for Android,
which this project doesn't use — so notifications don't arrive while the app is
fully closed. Registration is best-effort and silently does nothing where push
isn't available (Expo Go, emulators, and the current APK).

## Website setup (`CampusBrewWebSite`)

The public site (home, about, contact, download) and the admin panel at `/admin`.

```bash
cd CampusBrewWebSite
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
```

The backend URL is read at build time from `VITE_API_URL` (defaults to
`http://localhost:8080`). Set it in a local `.env` or in Render's environment.

---

## Deployment

### Backend (Render web service, Docker)

The backend is containerized and deployed on **Render** as a Docker web service.
The `prod` Spring profile ([`application-prod.properties`](campusbrew-api/src/main/resources/application-prod.properties))
reads all configuration from environment variables, so no secrets live in the image.

The [`Dockerfile`](campusbrew-api/Dockerfile) is a multi-stage build (Maven build
stage → slim JRE runtime) that runs as a non-root user and activates the `prod`
profile. Build and run locally:

```bash
cd campusbrew-api
docker build -t campusbrew-api .
docker run -p 8080:8080 --env-file .env campusbrew-api
```

| Setting | Value |
|---------|-------|
| Language / Runtime | **Docker** |
| Root Directory | `campusbrew-api` |
| Dockerfile Path | `campusbrew-api/Dockerfile` |
| Docker Command | *(leave blank — uses the image `ENTRYPOINT`)* |
| Pre-Deploy Command | *(leave blank)* |

Render injects `PORT`, which the prod profile binds to automatically.

#### Environment variables (prod)

Set these in Render → Environment (or your `--env-file` for local Docker):

| Variable | Required | Notes |
|----------|----------|-------|
| `MONGODB_URI` | ✅ | Atlas connection string |
| `MONGODB_DATABASE` | — | defaults to `campusbrew` |
| `JWT_SECRET` | ✅ | long random string |
| `JWT_EXPIRATION` | — | ms; defaults to `86400000` (24h) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ✅ | the admin account created at startup (share the password privately) |
| `BREVO_API_KEY` | ✅ | Brevo → SMTP & API → API Keys; email codes are sent over HTTPS (Render's free plan blocks SMTP) |
| `MAIL_FROM` | ✅ | a sender address verified in Brevo |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | — | Gmail SMTP fallback, used when `BREVO_API_KEY` isn't set |
| `MAIL_HOST` / `MAIL_PORT` | — | default `smtp.gmail.com` / `587` |
| `XENDIT_SECRET_KEY` / `XENDIT_CALLBACK_TOKEN` | — | required only for GCash payments and refunds |
| `XENDIT_SUCCESS_URL` / `XENDIT_FAILURE_URL` | — | default `campusbrew://payment/...` deep links |
| `FEES_DELIVERY_FEE`, `FEES_COMMISSION`, `INCENTIVE_THRESHOLD`, `COD_LIMIT`, `TIP_MAX_AMOUNT`, `RATING_MIN_COUNT_TO_SHOW`, `LOCATION_INTERVAL_SECONDS`, … | — | business tunables; sensible defaults in `application-prod.properties` (the dasher incentive threshold counts deliveries per week, resetting every Monday) |

> **Xendit webhook:** in the Xendit dashboard, point the e-wallet callback URL at
> `https://<your-render-host>/api/payments/webhook/xendit` and use the same
> `XENDIT_CALLBACK_TOKEN` for signature verification.

### Website (Render static site)

| Setting | Value |
|---------|-------|
| Root Directory | `CampusBrewWebSite` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Environment | `NODE_VERSION=22`, `VITE_API_URL=https://campusbrew-backend.onrender.com` |
| Redirects/Rewrites | Rewrite `/*` → `/index.html` (so `/download` and `/admin` load directly) |

---

## Further reading

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system and per-module design
