### Features
- [x] Settings for the match (when setting up)
	- [x] spawn rate for abilities
	- [x] max powerups on the board
	- [x] opt in/out abilities
	- [x] turn timer on/off
	- [x] capture the king / checkmate on/off
- [ ] spectators should be allowed to join rooms where two players are already playing
- [ ] show a version number at the bottom of the page. version number is a SHA hash of the actual integer version number, just for obfuscation
- [ ] different rates for each ability
- [ ] rubber banding based on material remaining, so somebody falling behind has a higher chance of getting a good powerup
- [ ] debug mode
- [ ] hover hint tooltip that translates chess notation to english (e.g. "pawn takes bishop on a5")
- [ ] all abilities should be playable on either player's turn. no restrictions when abilities can be played. 

### power up ideas
- [ ] ~~Uncastle: king returns to starting square if open.~~
- [x] Resurrect: revive a piece you have lost. the piece returns in a selected square in the lowest row for that player.
- [x] Panic: opponent only has 10 seconds to make next move.
- [x] Refuge: a selected piece can land on a square outside the board, and remains in that place until it moves back on board. these pieces can be captured by opponents that also use refuge to visit the same virtual square
- [x] Armor: armor protects any pawn and gives it a second life. attacking piece stays in starting square but attempted attack destroys armor. armor persists
- [x] ghost/passthrough: applied to a piece, that piece may phase through any other piece when moving/capturing
- [x] random promotion/demotion: a piece is changed to any other non-king piece. chance is not evenly distributed, and the piece _must_ change (ie can't promote a pawn into a pawn)
	- [x] transform to piece rates
		- [x] pawn: 10%
		- [x] bishop: 30%
		- [x] knight: 30%
		- [x] rook: 20%
		- [x] queen: 10%
	- [x] the way this appears visually when being applied is a cycle through all possible piece changes and a ticking sound with each, slowing down (mimicking a wheel of fortune)
- [ ] undo button: undo your previous turn (and the move the opponent just made)
- [ ] give all your pawns the ability to move (and capture!) backwards for 3 turns

### UX enhancements/fixes  (lower priority tasks)
- [x] Hints for powerups need to explicitly declare pieces that are exempt (e.g. "Refuge" doesn't apply to the King)
- [ ] The Refuge squares should only show up when a piece has the Refuge ability applied to it (or is actively in the Refuge squares)
- [ ] better visualizations, animations for powerups, sound effects etc
	- [ ] picking up a powerup should have a little slot machine effect where it cycles through powerups (and plays a little audio mario kart-style powerup jingle) before revealing what was unlocked
- [ ] 