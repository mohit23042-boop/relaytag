# RoadQuest

Live game: https://relaytag-demo.onrender.com/roadquest/

A multiplayer road trip where the cleanest driver wins. Visit four cities, obey the speed limits, red lights, stop signs and one-way directions. A violation parks your car and creates an evidence card for a human officer. Explain your case using CometChat private messaging or voice/video calling. Pay with fictional credits, or receive the officer's one warning, to continue. Confirmed violations remain on the score.

## Play

1. Choose Leo and create a race. Copy the room link.
2. Open the link on another device or Incognito. Choose Maya, the officer. An optional third player chooses Nina.
3. The host or officer starts the four-minute race.
4. Choose a road at each city. Hold W / Up or the Accelerate button. Hold S / Down / Space or Brake to stop. Roads guide the car automatically.
5. Keep below the posted limit. Cross the signal line on green. For stop signs, stop in the approach area shown on the progress bar and hold the brake for one second.
6. When detained, choose Talk to the officer. Maya opens the case from Roadside cases. Both see a private CometChat conversation with voice/video call buttons.
7. The officer grants one warning or confirms the fine. The driver can also pay directly. The car resumes; a second warning is unavailable.
8. Visit all four cities to qualify. Finishers rank by fewest violations, then active driving time. If nobody finishes before time runs out, there is no winner.

Different characters need separate browser profiles/devices because CometChat uses browser storage for login. Calls require camera/microphone permission on both devices. Use headphones during a two-device demonstration.

## 90-second recording

- 0–15s: Show the world, Leo and Maya joined, and explain “the cleanest drive wins.” Start the race.
- 15–30s: Choose Old Quarter via Market Street and drive through the stop line without braking. Show the roadside police car, evidence and violation count.
- 30–60s: Leo opens Talk to the officer; Maya opens his case. Send “Officer, I missed the stop sign. May I use my one warning?” Reply as Maya, then show a real video call if both devices grant media access.
- 60–75s: Maya grants the warning. Show Leo's car moving again and the confirmed violation still on the scoreboard.
- 75–90s: Show the other destinations, Nina's competing score, and explain the four-city completion and winner rules.

## CometChat integration

The React UI Kit supplies group race radio, private driver/officer message lists and composers, read receipts, call buttons and incoming-call UI. The Chat SDK creates/joins the room group and resolves the peer user. The Calls SDK supplies voice/video sessions. Production authentication uses server-issued tokens; the REST API key is kept on the server. Game physics, traffic evidence and officer permissions are enforced by the Express server, independently of chat messages.

## Run locally

Use the existing repository environment configuration. Run `npm install`, `npm test`, `npm run build`, and `npm start`. Open `/roadquest/`. Render builds with the same existing service commands. `/` continues to serve RelayTag.

This is a hackathon demo with predefined fictional characters. Race state is in server memory and resets on restart/deployment. It supports one officer and two drivers per room; fines have no real money or legal effect. Rooms expire after one hour of inactivity.

## 3D / voice radio update
The game now uses a pixelated 3D rear chase camera and a GPS map at the bottom right. Text chat panels are removed. Every player clicks Join voice radio to join the same CometChat audio channel, including the officer. Allow microphone access. Seven violations are enforced: speeding, red signal, missing a stop, wrong-way entry, missing seat belt, school-zone speed above 25, and pedestrian crossing speed above 15. Roadside warnings and fictional fines still release cars. GPS highlights the selected road. Signs and HUD show the upcoming checkpoints in either direction.
