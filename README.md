# FogChess — Powerup Edition (Mario Kart-Style Chess)

A static, serverless multiplayer web game combining **Chess ("Capture the King")** with **Mario Kart-style Mystery `?` Powerup Boxes**, hosted directly on **GitHub Pages**.

## Core Gameplay Mechanics

- **Full Vision by Default:** Both players see the entire board unless hit by the **Fog Cloud** powerup.
- **Rainbow `?` Mystery Item Boxes:**
  - Unoccupied squares in the middle 4 ranks (ranks 3–6) spawn floating rainbow `?` item boxes (2 at the start of a match, and new ones spawning every 2–3 turns up to a maximum of **3 boxes** on the board at once).
  - Moving a piece onto a `?` square consumes the box from the board and grants a random powerup into your inventory.
- **Secret Inventory (Max 2 Powerups):**
  - Each player can hold up to **2 powerups** at a time.
  - Only the player who collects a box knows which powerup they unlocked — the opponent only sees how many mystery `[?]` slots you hold until you activate one!
- **Free Bonus Action Activation:**
  - On your turn, you may activate **1 powerup** from your inventory as a free bonus action *before* making your normal chess move.
- **Capture the King:**
  - No check or checkmate restrictions. You win by capturing the opponent's King (or by opponent resignation).

## The 6 Mystery Powerups

| Icon | Powerup | Effect |
| :--- | :--- | :--- |
| 🌫️ | **Fog Cloud** | Inflicts **Fog of War** on your opponent for **1–3 turns** (they can only see squares their pieces can see/reach, while you still see the full board). |
| 🧱 | **Stone Wall** | Drop an impassable stone barrier on any empty square for **2 full rounds (4 turns)**. Blocks movement and sliding rays; Knights can jump over it. |
| ⭐ | **Star Shield** | Grants one of your non-King pieces **invincibility from capture** for 1 full round (through your opponent's next turn). |
| ❄️ | **Ice Freeze** | Freezes one visible enemy non-King piece in ice so it **cannot move** on their upcoming turn. |
| 🪶 | **Feather Jump** | Gives one of your non-King pieces the ability to **jump like a Knight** (in addition to its normal moves) for this turn. |
| 🔄 | **Position Swap** | Instantly **swaps the board positions** of any two of your own non-King pieces before you make your normal move. |

## Running Locally

Serve the directory with any static HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.
