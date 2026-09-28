# CometChat integration record

RelayTag uses CometChat for the live, object-specific conversation. Each object has a stable `chatGuid`; the app creates or joins that group and embeds the React UI Kit's message list and composer in its profile.

## Tooling used during the build

The official skills command was run with the Codex target:

```bash
npx @cometchat/skills add --ide codex --family react
```

That installed the React guidance in `.cometchat/skills/` and the CometChat docs MCP endpoint in `.codex/config.toml`. I connected to the MCP server and called:

- `list_cometchat_bundles`
- `get_cometchat_implementation_bundle` with `react-uikit-quickstart`

The bundle was last verified on 29 April 2026. Its setup calls for init before login and login before rendering chat, which the app follows. The installed React UI Kit is newer than that bundle; its package exports the stylesheet as `@cometchat/chat-uikit-react/styles`, so the app uses that path. The application build succeeds with this import.

## Live mode and preview mode

With `VITE_COMETCHAT_APP_ID`, `VITE_COMETCHAT_REGION`, and `VITE_COMETCHAT_AUTH_KEY` present at build time, the conversation renders through CometChat. Without them, an explicitly labeled **PREVIEW** conversation uses the local API. Preview messages are not CometChat messages and should not be shown as proof of the hackathon integration.

Live delivery was verified with the user's CometChat app on September 28, 2026: Leo sent a test message, the UI Kit showed it as sent, and Nina saw it in the same object conversation after switching profiles. The public submission video should show the **LIVE** badge, a message crossing between two separate browser profiles, and the Codex CometChat tooling.
