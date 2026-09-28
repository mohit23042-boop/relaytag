# RelayTag

**A living memory for shared objects.** Each object gets a scannable page, a conversation, an issue history, and handoff notes that preserve useful fixes for the next person.

The interface uses a dark palette and Satoshi throughout. Satoshi loads from Fontshare's hosted stylesheet, with a system font fallback when that service is unavailable.

The sample workshop follows a sewing machine. Leo reports a thread problem, Maya helps in the object’s conversation, and the resolution becomes a note Nina can read when she next uses it. You can register more objects in the library; each gets its own tag, history, and CometChat group.

## What works

- Register and browse shared objects.
- Generate an object-specific QR link.
- Report issues and resolve them into permanent handoff notes.
- Let another borrower confirm that a handoff tip still works; each person can check a tip once, and authors cannot check their own.
- Print an object tag sized for an A4 sheet.
- Use three demo perspectives: Maya, Leo, and Nina.
- Send local preview messages when CometChat is not configured. The app labels this mode **PREVIEW**.
- Use a real CometChat group conversation when credentials are configured. The app labels this mode **LIVE**.
- Persist object data in `server/data.json` on the local server.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4174`. `npm run dev` builds the frontend and starts the local API and web server. After changing frontend code, rerun `npm run build` and reload the page. Run the API workflow test with `npm test`.

## Connect CometChat

1. Create a free app in the [CometChat dashboard](https://app.cometchat.com/). Get its **App ID**, **region**, and **Auth Key**.
2. Copy `.env.example` to `.env` and fill in the three values. Keep `.env` out of Git; it is ignored already.
3. Run `npm run build`, then `npm start`. The conversation badge should change to **LIVE**.
4. Open separate browser profiles for two demo personas. For example, use `?object=machine-04&as=maya` in one and `?object=machine-04&as=leo` in the other. The profile menu can switch personas within one browser profile.
5. Send a message from one profile and confirm it appears in the other. The CometChat SDK creates the demo users and each object’s public group on first use.

The project includes CometChat’s official Codex skills under `.cometchat/skills`, plus its MCP configuration in `.codex/config.toml`. They were installed using the command on the hackathon page:

```bash
npx @cometchat/skills add --ide codex --family react
```

See [COMETCHAT_INTEGRATION.md](COMETCHAT_INTEGRATION.md) for the MCP calls used during the build and the version-specific integration choice. [SUBMISSION.md](SUBMISSION.md) has the demo script and a draft X post.

## Architecture

| Part | Responsibility |
|---|---|
| React frontend | Object library, status, conversation, handoff flow, QR links |
| CometChat React UI Kit | Real-time group messages and composer in LIVE mode |
| Express API | Objects, issues, notes, local preview conversation |
| Local JSON file or PostgreSQL | Persisted workshop demo data |

The API serializes writes and saves through a temporary file before replacing the data file. Resolving an issue updates its status and creates a linked handoff note in one operation.

## Deploy on Render

The `render.yaml` Blueprint provisions a web service and PostgreSQL database on the free plans. Connect this repository to Render as a Blueprint. Supply the CometChat App ID and region for both the `VITE_` and server variables. Supply a **REST API Key** in `COMETCHAT_REST_API_KEY`. Do not set `VITE_COMETCHAT_AUTH_KEY` on Render. The Blueprint obtains `DATABASE_URL` from the database. The three fictional demo users (`relaytag_maya`, `relaytag_leo`, `relaytag_nina`) must already exist in your CometChat app; the local development flow creates them on first use. Render sets `PORT` automatically and the server binds to `0.0.0.0` there. Check `/api/health` after deploying, then test one object change and a chat message.

The public demo intentionally lets visitors switch among fictional workshop personas. This is for judging and exploration, not real user identity. API writes and token requests are rate limited. CometChat's REST API Key stays on the server, and the browser receives a token for one of the three demo users. Use actual user authentication and authorization before putting real workshop information or private conversations into the app.

The free Render web service can sleep after inactivity. Its local files disappear when it sleeps or redeploys, so the Blueprint uses PostgreSQL for object data. Free PostgreSQL lasts 30 days; choose a paid database or export the data before that deadline if you want to keep using the service. The QR codes will point to the deployed URL when printed from the deployed app.

The core issue and handoff flow, local preview chat, and live CometChat delivery were tested on September 28, 2026. A message sent as Leo appeared in the same object's CometChat group after switching to Nina. The supplied `.env` is local and ignored by Git; anyone cloning the project needs their own CometChat credentials.

## Suggested 90-second demo

1. Open the sewing machine from the object library and show its QR tag.
2. Open the same object as Leo and Maya in separate browser profiles. Show a live CometChat message crossing between them.
3. Resolve the issue with one practical sentence.
4. Open the link as Nina and show the fix in **Passed along**.

The local build has passed the LIVE check. For the final recording, use two browser profiles if you want to show both participants at once.
