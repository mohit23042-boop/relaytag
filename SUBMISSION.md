# RelayTag submission kit

## One-line pitch

RelayTag gives shared physical objects a living memory: scan a tag, discuss a problem, and turn the fix into a handoff note for the next person.

## Why this idea

Shared tools outlive the conversations about them. A repair tip or recurring fault often disappears when a borrower leaves. RelayTag anchors the conversation and its useful outcome to the object itself. Its QR code is the entry point; CometChat powers each object's live group conversation; resolving an issue preserves the answer in the object's history.

## Demo path (under 90 seconds)

| Time | Show | Say |
|---|---|---|
| 0–12s | Sewing machine profile, printable QR tag | “Shared objects collect stories, but most of that knowledge gets lost between people.” |
| 12–27s | Open the tag link as Leo; show open issue | “RelayTag gives each object its own scannable page, condition, and issue history.” |
| 27–48s | Leo sends a live message; Nina sees it | “The object's conversation is a real CometChat group. People can ask and answer while the context is fresh.” |
| 48–69s | Resolve the open issue with a practical fix | “A useful answer should survive the conversation. Resolving an issue turns the fix into a permanent handoff note.” |
| 69–84s | Nina reads **Handoff notes** and checks the tip | “The next borrower gets the answer at the object and can confirm that the fix still works.” |

Keep the **LIVE** badge visible during the chat segment. Use two browser profiles to show both participants at once. The local build is configured with a development Auth Key, so record locally and avoid publishing the built `dist` directory.

## Draft X post

Built RelayTag for the @CometChat #ZeroToChat hackathon: a living memory for shared objects. Scan a tag to see an object's condition, ask its group a question in live CometChat, and preserve each fix as a handoff note for whoever uses it next. Demo: [video] Code: [repository]

Replace the bracketed links before posting. Quote-post the official hackathon announcement, as required by the hackathon page. The submission deadline shown there is October 7, 2026.

## Recording checklist

- Build with the local `.env` and confirm the chat badge reads **LIVE**.
- Open `http://127.0.0.1:4174/?object=machine-04&as=leo` and the Nina link in separate browser profiles.
- Use a new, concise test message in the recording, then show it in Nina's conversation.
- Resolve the sample open issue using a useful, concrete fix and show it in **Handoff notes**.
- Keep the video under 90 seconds, with the repository URL ready for the X post.
