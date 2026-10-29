# FogChess — Multiplayer Fog of War Chess

A static, serverless multiplayer Fog of War Chess web application built for **GitHub Pages**.

## Features
- **True Fog of War Visibility ("Full Sight" + Always-On Pawn Diagonals):**
  - You only see squares occupied by your pieces and squares your pieces can reach/see.
  - Pawns always illuminate their two forward-diagonal squares (even when empty), plus 1 square straight ahead (and 2 squares ahead from their starting rank when the first square is unblocked).
  - Sliding pieces (Rook, Bishop, Queen) reveal rays up to and including the first blocking piece.
- **Capture the King Ruleset:**
  - No check or checkmate warnings. Moving into an attacked square or moving a pinned piece is legal.
  - A match is won by capturing the opponent's King (or by resignation), at which point the fog lifts to reveal the full board.
- **Serverless WebSocket Rooms (MQTT-over-WSS + BroadcastChannel):**
  - Connects via standard Secure WebSockets (`wss://`) across redundant public brokers so rooms work through **any** firewall, symmetric NAT, VPN, or browser (avoiding WebRTC ICE/TURN hole-punching failures) while remaining 100% static on GitHub Pages.
  - Create a 6-character room code or share an invite link (`?room=XXXXXX`) to play directly.
  - Includes a one-click **"Open 2nd Player Tab"** button for local two-tab testing and a **Practice vs. Bot** mode.

## Running Locally

Because the app uses ES modules (`<script type="module">`), serve the folder with any static HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch** (`main` / root `/`).
4. Your site will be live at `https://<your-username>.github.io/fogchess/`.
