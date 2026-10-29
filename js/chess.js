/**
 * FogChess: Powerup Edition Engine (v7)
 *
 * Includes 12 Mario Kart-style Mystery Powerups:
 *  1. fog       — Fog Cloud (1–3 turns of Fog of War on opponent)
 *  2. wall      — Stone Wall (Impassable obstacle for 2 rounds)
 *  3. shield    — Star Shield (Invincible non-King piece for 1 round)
 *  4. freeze    — Ice Freeze (Freeze enemy non-King piece for 1 turn)
 *  5. feather   — Feather Jump (1 friendly non-King piece jumps like a Knight this turn)
 *  6. swap      — Position Swap (Swap 2 friendly non-King pieces)
 *  7. resurrect — Resurrect (Revive a lost piece onto an empty square on your lowest/home row)
 *  8. panic     — Panic (Opponent only has 10 seconds to make their next move)
 *  9. refuge    — Refuge (Piece can step onto the outer Refuge border ring around the board)
 * 10. armor     — Armor (Persistent 2nd life for a Pawn; attack breaks armor & attacker stays put)
 * 11. ghost     — Ghost / Passthrough (1-turn buff: piece phases through pieces/walls when moving/capturing)
 * 12. transform — Wheel of Fortune (Randomly promotes/demotes a friendly non-King piece with weighted odds)
 */

export const COLORS = {
  WHITE: 'w',
  BLACK: 'b',
};

export const PIECES = {
  PAWN: 'p',
  KNIGHT: 'n',
  BISHOP: 'b',
  ROOK: 'r',
  QUEEN: 'q',
  KING: 'k',
};

// Weighted transformation table for 'transform' (Wheel of Fortune)
export const TRANSFORM_WEIGHTS = [
  { type: 'p', weight: 10 }, // 10%
  { type: 'b', weight: 30 }, // 30%
  { type: 'n', weight: 30 }, // 30%
  { type: 'r', weight: 20 }, // 20%
  { type: 'q', weight: 10 }, // 10%
];

export function rollTransformedPieceType(currentType) {
  const candidates = TRANSFORM_WEIGHTS.filter((entry) => entry.type !== currentType);
  const totalWeight = candidates.reduce((acc, item) => acc + item.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of candidates) {
    if (r < item.weight) return item.type;
    r -= item.weight;
  }
  return candidates[candidates.length - 1].type;
}

export const POWERUP_DEFS = {
  fog: {
    id: 'fog',
    name: 'Fog Cloud',
    icon: '🌫️',
    shortDesc: 'Blind opponent with Fog of War for 1–3 turns',
    fullDesc: 'Inflicts Fog of War on your opponent for 1–3 of their turns (they only see what their pieces see, while you see the full board).',
    targetType: 'none',
  },
  wall: {
    id: 'wall',
    name: 'Stone Wall',
    icon: '🧱',
    shortDesc: 'Place an impassable wall on an empty square (2 rounds)',
    fullDesc: 'Drop a stone barrier on any empty square for 2 full rounds (4 turns). Blocks movement and sliding rays; Knights & Ghosts can pass.',
    targetType: 'empty_square',
  },
  shield: {
    id: 'shield',
    name: 'Star Shield',
    icon: '⭐',
    shortDesc: 'Make 1 friendly non-King piece invincible for 1 round',
    fullDesc: 'Grants one of your non-King pieces temporary immunity from capture through your opponent’s next turn.',
    targetType: 'friendly_non_king',
  },
  freeze: {
    id: 'freeze',
    name: 'Ice Freeze',
    icon: '❄️',
    shortDesc: 'Freeze 1 enemy non-King piece for their next turn',
    fullDesc: 'Encases a visible enemy non-King piece in ice so it cannot move or attack on their upcoming turn.',
    targetType: 'enemy_non_king',
  },
  feather: {
    id: 'feather',
    name: 'Feather Jump',
    icon: '🪶',
    shortDesc: '1 friendly non-King piece can move like a Knight this turn',
    fullDesc: 'Gives one of your non-King pieces the ability to jump like a Knight (in addition to its normal moves) for this turn.',
    targetType: 'friendly_non_king',
  },
  swap: {
    id: 'swap',
    name: 'Position Swap',
    icon: '🔄',
    shortDesc: 'Swap positions of 2 friendly non-King pieces',
    fullDesc: 'Instantly swaps the board positions of any two of your non-King pieces before you make your normal move.',
    targetType: 'two_friendly_non_king',
  },
  resurrect: {
    id: 'resurrect',
    name: 'Resurrect',
    icon: '⚱️',
    shortDesc: 'Revive a lost piece onto your home back row',
    fullDesc: 'Choose one of your captured pieces and return it to any empty square on your lowest (home) row.',
    targetType: 'home_row_empty',
  },
  panic: {
    id: 'panic',
    name: 'Panic!',
    icon: '🚨',
    shortDesc: 'Opponent only gets 10 seconds for their next move',
    fullDesc: 'Puts a 10-second shot clock on your opponent’s upcoming turn! If time runs out, they forfeit their move.',
    targetType: 'none',
  },
  refuge: {
    id: 'refuge',
    name: 'Refuge',
    icon: '🌀',
    shortDesc: 'Piece can step off-board onto the outer Refuge ring',
    fullDesc: 'Allows a friendly non-King piece to move 1 square off the edge of the board into the outer Refuge ring (or capture an enemy piece hiding in Refuge).',
    targetType: 'friendly_non_king',
  },
  armor: {
    id: 'armor',
    name: 'Pawn Armor',
    icon: '🛡️',
    shortDesc: 'Give a Pawn a persistent 2nd life against capture',
    fullDesc: 'Equips a friendly Pawn with persistent Armor. An enemy attack destroys the armor instead of the Pawn, and the attacker stays on its starting square!',
    targetType: 'friendly_pawn',
  },
  ghost: {
    id: 'ghost',
    name: 'Ghost Phase',
    icon: '👻',
    shortDesc: 'Phase through at most 1 piece this turn (cannot capture King via passthrough)',
    fullDesc: 'For this turn, the chosen friendly non-King piece can phase through at most 1 piece when moving or capturing. A King cannot be captured as a result of a passthrough.',
    targetType: 'friendly_non_king',
  },
  transform: {
    id: 'transform',
    name: 'Wheel of Fortune',
    icon: '🎰',
    shortDesc: 'Randomly promote/demote a friendly non-King piece',
    fullDesc: 'Spins the Wheel of Fortune on a friendly non-King piece, transforming it into a different piece (10% Pawn, 30% Bishop, 30% Knight, 20% Rook, 10% Queen).',
    targetType: 'friendly_non_king',
  },
};

export const POWERUP_IDS = Object.keys(POWERUP_DEFS);
export const MAX_BOARD_ITEMS = 3;
export const MAX_INVENTORY_SLOTS = 2;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

/**
 * Returns true if (r, c) is on the 1-square outer Refuge border ring around the 8x8 board:
 * r in [-1..8], c in [-1..8], and outside [0..7]x[0..7].
 */
export function inRefugeRing(r, c) {
  return (
    r >= -1 &&
    r <= 8 &&
    c >= -1 &&
    c <= 8 &&
    (r === -1 || r === 8 || c === -1 || c === 8)
  );
}

export function coordsToAlgebraic(r, c) {
  if (inBounds(r, c)) {
    return `${FILES[c]}${8 - r}`;
  }
  const fileStr = c < 0 ? 'a-' : c > 7 ? 'h+' : FILES[c];
  const rankStr = r < 0 ? '9' : r > 7 ? '0' : `${8 - r}`;
  return `🌀${fileStr}${rankStr}`;
}

export function algebraicToCoords(sq) {
  const c = FILES.indexOf(sq[0]);
  const r = 8 - parseInt(sq[1], 10);
  return [r, c];
}

export function oppositeColor(color) {
  return color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
}

export function randomPowerupId() {
  return POWERUP_IDS[Math.floor(Math.random() * POWERUP_IDS.length)];
}

export function rollReplenishDelayHalfTurns() {
  return Math.floor(Math.random() * 4) + 3; // 3 to 6 half-turns (1.5 to 3 full turns)
}

export class FogChessGame {
  constructor(initialItemCoords = null) {
    this.reset(initialItemCoords);
  }

  reset(initialItemCoords = null) {
    this.board = this.createInitialBoard();
    this.turn = COLORS.WHITE;
    this.castlingRights = {
      w: { k: true, q: true },
      b: { k: true, q: true },
    };
    this.enPassantTarget = null;
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
    this.history = [];
    this.captured = { w: [], b: [] };
    this.winner = null;
    this.winReason = null;

    this.itemBoxes = new Set();
    this.inventories = {
      w: [],
      b: [],
    };
    this.powerupsUsedThisTurn = 0;
    this.turnsUntilNextSpawn = rollReplenishDelayHalfTurns();

    // Active effects:
    this.fogTurns = { w: 0, b: 0 };
    this.walls = new Map(); // "r,c" -> remaining half-turns
    this.shields = new Map(); // "r,c" -> { color, turnsLeft }
    this.frozen = new Map(); // "r,c" -> { color, turnsLeft }
    this.featherSquares = new Set(); // "r,c" (1-turn buff)
    this.ghostSquares = new Set(); // "r,c" (1-turn buff)
    this.refugeReadySquares = new Set(); // "r,c" (1-turn buff allowing piece to step onto outer Refuge ring)
    this.armoredSquares = new Set(); // "r,c" (persistent Pawn Armor on 8x8 board)
    this.refugePieces = new Map(); // Outer ring "r,c" -> { type, color, armored?: boolean }
    this.panicActive = { w: false, b: false }; // If true for `this.turn`, player has 10s to move!

    if (Array.isArray(initialItemCoords)) {
      for (const [r, c] of initialItemCoords) {
        this.itemBoxes.add(`${r},${c}`);
      }
    } else {
      this.spawnRandomItemBox();
      this.spawnRandomItemBox();
    }
  }

  serializeState() {
    return {
      board: this.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
      turn: this.turn,
      castlingRights: {
        w: { ...this.castlingRights.w },
        b: { ...this.castlingRights.b },
      },
      enPassantTarget: this.enPassantTarget ? [...this.enPassantTarget] : null,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber,
      history: this.history.map((h) => ({ ...h })),
      captured: {
        w: [...this.captured.w],
        b: [...this.captured.b],
      },
      winner: this.winner,
      winReason: this.winReason,
      itemBoxes: Array.from(this.itemBoxes),
      inventories: {
        w: [...this.inventories.w],
        b: [...this.inventories.b],
      },
      powerupsUsedThisTurn: this.powerupsUsedThisTurn,
      turnsUntilNextSpawn: this.turnsUntilNextSpawn,
      fogTurns: { ...this.fogTurns },
      walls: Array.from(this.walls.entries()),
      shields: Array.from(this.shields.entries()),
      frozen: Array.from(this.frozen.entries()),
      featherSquares: Array.from(this.featherSquares),
      ghostSquares: Array.from(this.ghostSquares),
      refugeReadySquares: Array.from(this.refugeReadySquares),
      armoredSquares: Array.from(this.armoredSquares),
      refugePieces: Array.from(this.refugePieces.entries()),
      panicActive: { ...this.panicActive },
    };
  }

  loadState(state) {
    if (!state || !Array.isArray(state.board)) return false;

    this.board = state.board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
    this.turn = state.turn || COLORS.WHITE;
    this.castlingRights = {
      w: { ...(state.castlingRights?.w || { k: true, q: true }) },
      b: { ...(state.castlingRights?.b || { k: true, q: true }) },
    };
    this.enPassantTarget = state.enPassantTarget ? [...state.enPassantTarget] : null;
    this.halfMoveClock = state.halfMoveClock || 0;
    this.fullMoveNumber = state.fullMoveNumber || 1;
    this.history = Array.isArray(state.history) ? state.history.map((h) => ({ ...h })) : [];
    this.captured = {
      w: Array.isArray(state.captured?.w) ? [...state.captured.w] : [],
      b: Array.isArray(state.captured?.b) ? [...state.captured.b] : [],
    };
    this.winner = state.winner || null;
    this.winReason = state.winReason || null;

    this.itemBoxes = new Set(Array.isArray(state.itemBoxes) ? state.itemBoxes : []);
    this.inventories = {
      w: Array.isArray(state.inventories?.w) ? [...state.inventories.w] : [],
      b: Array.isArray(state.inventories?.b) ? [...state.inventories.b] : [],
    };
    this.powerupsUsedThisTurn = state.powerupsUsedThisTurn || 0;
    this.turnsUntilNextSpawn =
      typeof state.turnsUntilNextSpawn === 'number'
        ? state.turnsUntilNextSpawn
        : rollReplenishDelayHalfTurns();

    this.fogTurns = {
      w: state.fogTurns?.w || 0,
      b: state.fogTurns?.b || 0,
    };
    this.walls = new Map(Array.isArray(state.walls) ? state.walls : []);
    this.shields = new Map(Array.isArray(state.shields) ? state.shields : []);
    this.frozen = new Map(Array.isArray(state.frozen) ? state.frozen : []);
    this.featherSquares = new Set(Array.isArray(state.featherSquares) ? state.featherSquares : []);
    this.ghostSquares = new Set(Array.isArray(state.ghostSquares) ? state.ghostSquares : []);
    this.refugeReadySquares = new Set(Array.isArray(state.refugeReadySquares) ? state.refugeReadySquares : []);
    this.armoredSquares = new Set(Array.isArray(state.armoredSquares) ? state.armoredSquares : []);
    this.refugePieces = new Map(Array.isArray(state.refugePieces) ? state.refugePieces : []);
    this.panicActive = {
      w: Boolean(state.panicActive?.w),
      b: Boolean(state.panicActive?.b),
    };

    return true;
  }

  isMatchInProgress() {
    return (
      this.history.length > 0 ||
      this.powerupsUsedThisTurn > 0 ||
      this.walls.size > 0 ||
      this.shields.size > 0 ||
      this.frozen.size > 0 ||
      this.armoredSquares.size > 0 ||
      this.refugePieces.size > 0 ||
      this.fogTurns.w > 0 ||
      this.fogTurns.b > 0
    );
  }

  createInitialBoard() {
    const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));

    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: backRank[c], color: COLORS.BLACK };
      board[1][c] = { type: PIECES.PAWN, color: COLORS.BLACK };
      board[6][c] = { type: PIECES.PAWN, color: COLORS.WHITE };
      board[7][c] = { type: backRank[c], color: COLORS.WHITE };
    }
    return board;
  }

  getPieceAt(r, c) {
    if (inBounds(r, c)) return this.board[r][c];
    if (inRefugeRing(r, c)) return this.refugePieces.get(`${r},${c}`) || null;
    return null;
  }

  getItemBoxCoordsList() {
    return Array.from(this.itemBoxes).map((key) => key.split(',').map(Number));
  }

  spawnRandomItemBox() {
    if (this.itemBoxes.size >= MAX_BOARD_ITEMS) return null;

    const candidates = [];
    for (let r = 2; r <= 5; r++) {
      for (let c = 0; c < 8; c++) {
        const key = `${r},${c}`;
        if (
          !this.board[r][c] &&
          !this.itemBoxes.has(key) &&
          !this.walls.has(key)
        ) {
          candidates.push([r, c]);
        }
      }
    }

    if (candidates.length === 0) return null;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    this.itemBoxes.add(`${chosen[0]},${chosen[1]}`);
    return chosen;
  }

  isWall(r, c) {
    return this.walls.has(`${r},${c}`);
  }

  isShielded(r, c) {
    return this.shields.has(`${r},${c}`);
  }

  isFrozen(r, c) {
    return this.frozen.has(`${r},${c}`);
  }

  hasFeather(r, c) {
    return this.featherSquares.has(`${r},${c}`);
  }

  hasGhost(r, c) {
    return this.ghostSquares.has(`${r},${c}`);
  }

  hasRefugeReady(r, c) {
    return this.refugeReadySquares.has(`${r},${c}`);
  }

  isArmored(r, c) {
    if (inBounds(r, c)) return this.armoredSquares.has(`${r},${c}`);
    if (inRefugeRing(r, c)) return Boolean(this.refugePieces.get(`${r},${c}`)?.armored);
    return false;
  }

  isPlayerFogged(color) {
    return (this.fogTurns[color] || 0) > 0;
  }

  findKingSquare(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === color && p.type === PIECES.KING) {
          return [r, c];
        }
      }
    }
    return null;
  }

  isSquareAttackedBy(targetR, targetC, attackerColor) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece || piece.color !== attackerColor) continue;
        if (this.isFrozen(r, c)) continue;

        const pseudo = this.getPseudoMovesFrom(r, c, true);
        if (pseudo.some((m) => m.to[0] === targetR && m.to[1] === targetC)) {
          return true;
        }
      }
    }
    return false;
  }

  isKingInCheck(color) {
    const kingSq = this.findKingSquare(color);
    if (!kingSq) return false;
    return this.isSquareAttackedBy(kingSq[0], kingSq[1], oppositeColor(color));
  }

  /**
   * Simulates a pseudo-legal move (including Refuge entry/exit and Armor bounce)
   * and returns true if it leaves `moverColor`'s King in Check.
   */
  wouldMoveLeaveKingInCheck(move, moverColor) {
    const [r1, c1] = move.from;
    const [r2, c2] = move.to;
    const fromInBounds = inBounds(r1, c1);
    const toInBounds = inBounds(r2, c2);

    // If attacking an Armored Pawn, the attacker stays at [r1, c1] and the Pawn stays at [r2, c2]!
    const hitsArmor =
      (toInBounds && this.board[r2]?.[c2] && this.isArmored(r2, c2)) ||
      (move.enPassant && this.isArmored(r1, c2)) ||
      (!toInBounds && this.isArmored(r2, c2));

    if (hitsArmor) {
      return this.isKingInCheck(moverColor);
    }

    const fromKey = `${r1},${c1}`;
    const toKey = `${r2},${c2}`;

    const savedFromBoard = fromInBounds ? this.board[r1][c1] : null;
    const savedToBoard = toInBounds ? this.board[r2][c2] : null;
    const savedFromRefuge = !fromInBounds ? this.refugePieces.get(fromKey) : null;
    const savedToRefuge = !toInBounds ? this.refugePieces.get(toKey) : null;

    let savedEp = null;
    if (move.enPassant && fromInBounds) {
      savedEp = this.board[r1][c2];
      this.board[r1][c2] = null;
    }

    const movingPiece = fromInBounds ? savedFromBoard : savedFromRefuge;

    // Apply move temporarily
    if (fromInBounds) this.board[r1][c1] = null;
    else this.refugePieces.delete(fromKey);

    if (toInBounds) this.board[r2][c2] = movingPiece;
    else this.refugePieces.set(toKey, movingPiece);

    const inCheck = this.isKingInCheck(moverColor);

    // Restore state
    if (fromInBounds) this.board[r1][c1] = savedFromBoard;
    else if (savedFromRefuge) this.refugePieces.set(fromKey, savedFromRefuge);

    if (toInBounds) this.board[r2][c2] = savedToBoard;
    else if (savedToRefuge) this.refugePieces.set(toKey, savedToRefuge);
    else this.refugePieces.delete(toKey);

    if (move.enPassant && fromInBounds) {
      this.board[r1][c2] = savedEp;
    }

    return inCheck;
  }

  getVisibleSquares(viewerColor, forceComputeSight = false) {
    const visible = new Set();

    if (!forceComputeSight && !this.isPlayerFogged(viewerColor)) {
      for (let r = -1; r <= 8; r++) {
        for (let c = -1; c <= 8; c++) {
          if (inBounds(r, c) || inRefugeRing(r, c)) {
            visible.add(`${r},${c}`);
          }
        }
      }
      return visible;
    }

    // Friendly Refuge pieces see their own square and adjacent board squares
    for (const [key, piece] of this.refugePieces.entries()) {
      if (piece.color !== viewerColor) continue;
      visible.add(key);
      const [rr, rc] = key.split(',').map(Number);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (inBounds(rr + dr, rc + dc)) {
            visible.add(`${rr + dr},${rc + dc}`);
          }
        }
      }
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece || piece.color !== viewerColor) continue;

        visible.add(`${r},${c}`);
        const isGhost = this.hasGhost(r, c);

        if (this.hasFeather(r, c)) {
          const jumps = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1],
          ];
          for (const [dr, dc] of jumps) {
            const nr = r + dr;
            const nc = c + dc;
            if (inBounds(nr, nc)) visible.add(`${nr},${nc}`);
          }
        }

        if (this.hasRefugeReady(r, c)) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (inRefugeRing(r + dr, c + dc)) {
                visible.add(`${r + dr},${c + dc}`);
              }
            }
          }
        }

        switch (piece.type) {
          case PIECES.PAWN: {
            const dir = viewerColor === COLORS.WHITE ? -1 : 1;
            const startRank = viewerColor === COLORS.WHITE ? 6 : 1;

            for (const dc of [-1, 1]) {
              const nr = r + dir;
              const nc = c + dc;
              if (inBounds(nr, nc)) {
                visible.add(`${nr},${nc}`);
              }
            }

            const r1 = r + dir;
            if (inBounds(r1, c)) {
              visible.add(`${r1},${c}`);
              const r2 = r + 2 * dir;
              if (
                r === startRank &&
                (isGhost || (!this.board[r1][c] && !this.isWall(r1, c))) &&
                inBounds(r2, c)
              ) {
                visible.add(`${r2},${c}`);
              }
            }
            break;
          }

          case PIECES.KNIGHT: {
            const jumps = [
              [-2, -1], [-2, 1], [-1, -2], [-1, 2],
              [1, -2], [1, 2], [2, -1], [2, 1],
            ];
            for (const [dr, dc] of jumps) {
              const nr = r + dr;
              const nc = c + dc;
              if (inBounds(nr, nc)) {
                visible.add(`${nr},${nc}`);
              }
            }
            break;
          }

          case PIECES.KING: {
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (inBounds(nr, nc)) {
                  visible.add(`${nr},${nc}`);
                }
              }
            }
            const castleMoves = this.getCastlingMoves(r, c, viewerColor, true);
            for (const cm of castleMoves) {
              visible.add(`${cm.to[0]},${cm.to[1]}`);
            }
            break;
          }

          case PIECES.BISHOP:
          case PIECES.ROOK:
          case PIECES.QUEEN: {
            const dirs = [];
            if (piece.type === PIECES.ROOK || piece.type === PIECES.QUEEN) {
              dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
            }
            if (piece.type === PIECES.BISHOP || piece.type === PIECES.QUEEN) {
              dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
            }
            const maxBlockers = isGhost ? 1 : 0;
            for (const [dr, dc] of dirs) {
              let nr = r + dr;
              let nc = c + dc;
              let blockersPassed = 0;
              while (inBounds(nr, nc)) {
                visible.add(`${nr},${nc}`);
                if (this.board[nr][nc] || this.isWall(nr, nc)) {
                  if (blockersPassed < maxBlockers) {
                    blockersPassed++;
                  } else {
                    break;
                  }
                }
                nr += dr;
                nc += dc;
              }
            }
            break;
          }
        }
      }
    }

    return visible;
  }

  usePowerup(color, slotIndex, params = {}) {
    if (this.winner || color !== this.turn) {
      return { ok: false, reason: 'You can only use powerups on your turn.' };
    }
    if (this.powerupsUsedThisTurn >= MAX_INVENTORY_SLOTS) {
      return { ok: false, reason: 'You have already used 2 powerups this turn.' };
    }

    const inv = this.inventories[color];
    if (slotIndex < 0 || slotIndex >= inv.length) {
      return { ok: false, reason: 'Invalid powerup slot.' };
    }

    const powerupId = inv[slotIndex];
    const result = this.applyPowerupEffect(color, powerupId, params);
    if (!result.ok) return result;

    inv.splice(slotIndex, 1);
    this.powerupsUsedThisTurn++;

    this.checkEndOfGameCondition();

    return {
      ok: true,
      powerupId,
      ...result,
    };
  }

  applyPowerupEffect(color, powerupId, params = {}) {
    const oppColor = oppositeColor(color);

    switch (powerupId) {
      case 'fog': {
        const duration = params.duration || (Math.floor(Math.random() * 3) + 1);
        this.fogTurns[oppColor] = (this.fogTurns[oppColor] || 0) + duration;
        return {
          ok: true,
          duration,
          summary: `${POWERUP_DEFS.fog.icon} Fog Cloud! ${oppColor === COLORS.WHITE ? 'White' : 'Black'} is shrouded in Fog of War for ${duration} turn${duration > 1 ? 's' : ''}!`,
        };
      }

      case 'wall': {
        const sq = params.square;
        if (!sq || !inBounds(sq[0], sq[1])) {
          return { ok: false, reason: 'Select a valid board square.' };
        }
        const [r, c] = sq;
        const key = `${r},${c}`;
        if (this.board[r][c] || this.isWall(r, c) || this.itemBoxes.has(key)) {
          return { ok: false, reason: 'Stone Wall must be placed on a completely empty square.' };
        }
        this.walls.set(key, 4);
        return {
          ok: true,
          square: [r, c],
          summary: `${POWERUP_DEFS.wall.icon} Stone Wall placed on ${coordsToAlgebraic(r, c)} (lasts 2 rounds)!`,
        };
      }

      case 'shield': {
        const sq = params.square;
        if (!sq || !inBounds(sq[0], sq[1])) {
          return { ok: false, reason: 'Select one of your non-King pieces.' };
        }
        const [r, c] = sq;
        const piece = this.board[r][c];
        if (!piece || piece.color !== color || piece.type === PIECES.KING) {
          return { ok: false, reason: 'Star Shield can only target your own non-King piece.' };
        }
        const key = `${r},${c}`;
        this.shields.set(key, { color, turnsLeft: 2 });
        return {
          ok: true,
          square: [r, c],
          summary: `${POWERUP_DEFS.shield.icon} Star Shield protects ${piece.type.toUpperCase()} on ${coordsToAlgebraic(r, c)}!`,
        };
      }

      case 'freeze': {
        const sq = params.square;
        if (!sq || !inBounds(sq[0], sq[1])) {
          return { ok: false, reason: 'Select an enemy non-King piece.' };
        }
        const [r, c] = sq;
        const piece = this.board[r][c];
        if (!piece || piece.color !== oppColor || piece.type === PIECES.KING) {
          return { ok: false, reason: 'Ice Freeze can only target an enemy non-King piece.' };
        }
        const key = `${r},${c}`;
        this.frozen.set(key, { color: oppColor, turnsLeft: 2 });
        return {
          ok: true,
          square: [r, c],
          summary: `${POWERUP_DEFS.freeze.icon} Ice Freeze locked ${piece.type.toUpperCase()} on ${coordsToAlgebraic(r, c)} for 1 turn!`,
        };
      }

      case 'feather': {
        const sq = params.square;
        if (!sq || !inBounds(sq[0], sq[1])) {
          return { ok: false, reason: 'Select one of your non-King pieces.' };
        }
        const [r, c] = sq;
        const piece = this.board[r][c];
        if (!piece || piece.color !== color || piece.type === PIECES.KING) {
          return { ok: false, reason: 'Feather Jump can only target your own non-King piece.' };
        }
        if (this.isFrozen(r, c)) {
          return { ok: false, reason: 'That piece is frozen and cannot jump this turn.' };
        }
        this.featherSquares.add(`${r},${c}`);
        return {
          ok: true,
          square: [r, c],
          summary: `${POWERUP_DEFS.feather.icon} Feather Jump! Your ${piece.type.toUpperCase()} on ${coordsToAlgebraic(r, c)} can jump like a Knight this turn!`,
        };
      }

      case 'swap': {
        const { squareA, squareB } = params;
        if (!squareA || !squareB) {
          return { ok: false, reason: 'Select two of your non-King pieces to swap.' };
        }
        const [r1, c1] = squareA;
        const [r2, c2] = squareB;
        if (r1 === r2 && c1 === c2) {
          return { ok: false, reason: 'Select two different pieces to swap.' };
        }
        const p1 = this.board[r1]?.[c1];
        const p2 = this.board[r2]?.[c2];
        if (
          !p1 || !p2 ||
          p1.color !== color || p2.color !== color ||
          p1.type === PIECES.KING || p2.type === PIECES.KING
        ) {
          return { ok: false, reason: 'Both targets must be your own non-King pieces.' };
        }
        const promoRank = color === COLORS.WHITE ? 0 : 7;
        if ((p1.type === PIECES.PAWN && r2 === promoRank) || (p2.type === PIECES.PAWN && r1 === promoRank)) {
          return { ok: false, reason: 'Cannot swap a Pawn directly onto the promotion rank.' };
        }

        const wasInCheck = this.isKingInCheck(color);

        this.board[r1][c1] = p2;
        this.board[r2][c2] = p1;

        if (!wasInCheck && this.isKingInCheck(color)) {
          this.board[r1][c1] = p1;
          this.board[r2][c2] = p2;
          return { ok: false, reason: 'Cannot swap pieces if it exposes your King to Check!' };
        }

        const key1 = `${r1},${c1}`;
        const key2 = `${r2},${c2}`;
        this.swapMapKeys(this.shields, key1, key2);
        this.swapMapKeys(this.frozen, key1, key2);
        this.swapSetKeys(this.featherSquares, key1, key2);
        this.swapSetKeys(this.ghostSquares, key1, key2);
        this.swapSetKeys(this.refugeReadySquares, key1, key2);
        this.swapSetKeys(this.armoredSquares, key1, key2);

        const homeRank = color === COLORS.WHITE ? 7 : 0;
        if ((r1 === homeRank && c1 === 0) || (r2 === homeRank && c2 === 0)) {
          this.castlingRights[color].q = false;
        }
        if ((r1 === homeRank && c1 === 7) || (r2 === homeRank && c2 === 7)) {
          this.castlingRights[color].k = false;
        }

        return {
          ok: true,
          squareA: [r1, c1],
          squareB: [r2, c2],
          summary: `${POWERUP_DEFS.swap.icon} Swapped ${p1.type.toUpperCase()} (${coordsToAlgebraic(r1, c1)}) and ${p2.type.toUpperCase()} (${coordsToAlgebraic(r2, c2)})!`,
        };
      }

      case 'resurrect': {
        const sq = params.square;
        const pieceType = params.pieceType;
        const homeRow = color === COLORS.WHITE ? 7 : 0;
        if (!sq || sq[0] !== homeRow || !inBounds(sq[0], sq[1])) {
          return { ok: false, reason: 'Select an empty square on your lowest (home) row.' };
        }
        const [r, c] = sq;
        if (this.board[r][c] || this.isWall(r, c)) {
          return { ok: false, reason: 'That home-row square is not empty.' };
        }
        const lostList = this.captured[color];
        if (!lostList || lostList.length === 0) {
          return { ok: false, reason: 'You have no lost pieces to resurrect yet!' };
        }
        const targetType = pieceType && lostList.includes(pieceType) ? pieceType : lostList[lostList.length - 1];
        const idx = lostList.lastIndexOf(targetType);
        if (idx === -1) {
          return { ok: false, reason: 'Selected piece is not in your lost pieces.' };
        }

        lostList.splice(idx, 1);
        this.board[r][c] = { type: targetType, color };

        return {
          ok: true,
          square: [r, c],
          pieceType: targetType,
          summary: `${POWERUP_DEFS.resurrect.icon} Resurrected ${targetType.toUpperCase()} onto ${coordsToAlgebraic(r, c)}!`,
        };
      }

      case 'panic': {
        this.panicActive[oppColor] = true;
        return {
          ok: true,
          summary: `${POWERUP_DEFS.panic.icon} PANIC! ${oppColor === COLORS.WHITE ? 'White' : 'Black'} only has 10 seconds to make their next move!`,
        };
      }

      case 'refuge': {
        const sq = params.square;
        if (!sq || !inBounds(sq[0], sq[1])) {
          return { ok: false, reason: 'Select one of your non-King pieces on the board.' };
        }
        const [r, c] = sq;
        const piece = this.board[r][c];
        if (!piece || piece.color !== color || piece.type === PIECES.KING) {
          return { ok: false, reason: 'Refuge can only target your own non-King piece.' };
        }
        if (this.isFrozen(r, c)) {
          return { ok: false, reason: 'That piece is frozen and cannot use Refuge this turn.' };
        }
        this.refugeReadySquares.add(`${r},${c}`);
        return {
          ok: true,
          square: [r, c],
          summary: `${POWERUP_DEFS.refuge.icon} Refuge granted to ${piece.type.toUpperCase()} on ${coordsToAlgebraic(r, c)} — it can now step onto the outer Refuge border ring!`,
        };
      }

      case 'armor': {
        const sq = params.square;
        if (!sq || !inBounds(sq[0], sq[1])) {
          return { ok: false, reason: 'Select one of your Pawns.' };
        }
        const [r, c] = sq;
        const piece = this.board[r][c];
        if (!piece || piece.color !== color || piece.type !== PIECES.PAWN) {
          return { ok: false, reason: 'Pawn Armor can only be applied to a friendly Pawn.' };
        }
        const key = `${r},${c}`;
        if (this.armoredSquares.has(key)) {
          return { ok: false, reason: 'That Pawn already has Armor!' };
        }
        this.armoredSquares.add(key);
        return {
          ok: true,
          square: [r, c],
          summary: `${POWERUP_DEFS.armor.icon} Pawn on ${coordsToAlgebraic(r, c)} equipped with persistent Armor (2nd life)!`,
        };
      }

      case 'ghost': {
        const sq = params.square;
        if (!sq || !inBounds(sq[0], sq[1])) {
          return { ok: false, reason: 'Select one of your non-King pieces.' };
        }
        const [r, c] = sq;
        const piece = this.board[r][c];
        if (!piece || piece.color !== color || piece.type === PIECES.KING) {
          return { ok: false, reason: 'Ghost Phase can only target your own non-King piece.' };
        }
        if (this.isFrozen(r, c)) {
          return { ok: false, reason: 'That piece is frozen and cannot phase this turn.' };
        }
        this.ghostSquares.add(`${r},${c}`);
        return {
          ok: true,
          square: [r, c],
          summary: `${POWERUP_DEFS.ghost.icon} Ghost Phase! Your ${piece.type.toUpperCase()} on ${coordsToAlgebraic(r, c)} can phase through any pieces/walls this turn!`,
        };
      }

      case 'transform': {
        const sq = params.square;
        if (!sq || !inBounds(sq[0], sq[1])) {
          return { ok: false, reason: 'Select one of your non-King pieces.' };
        }
        const [r, c] = sq;
        const piece = this.board[r][c];
        if (!piece || piece.color !== color || piece.type === PIECES.KING) {
          return { ok: false, reason: 'Wheel of Fortune can only target your own non-King piece.' };
        }

        const oldType = piece.type;
        const newType =
          params.newPieceType && params.newPieceType !== oldType
            ? params.newPieceType
            : rollTransformedPieceType(oldType);

        const wasInCheck = this.isKingInCheck(color);
        this.board[r][c] = { type: newType, color };

        if (!wasInCheck && this.isKingInCheck(color)) {
          this.board[r][c] = { type: oldType, color };
          return { ok: false, reason: 'Cannot transform that piece right now as it would expose your King to Check!' };
        }

        // If a non-pawn transformed away from pawn, clear pawn-only armor
        if (newType !== PIECES.PAWN) {
          this.armoredSquares.delete(`${r},${c}`);
        }

        return {
          ok: true,
          square: [r, c],
          oldPieceType: oldType,
          newPieceType: newType,
          summary: `${POWERUP_DEFS.transform.icon} Wheel of Fortune transformed ${oldType.toUpperCase()} on ${coordsToAlgebraic(r, c)} into ${newType.toUpperCase()}!`,
        };
      }

      default:
        return { ok: false, reason: 'Unknown powerup.' };
    }
  }

  swapMapKeys(map, k1, k2) {
    const v1 = map.get(k1);
    const v2 = map.get(k2);
    if (v1 !== undefined) map.set(k2, v1);
    else map.delete(k2);
    if (v2 !== undefined) map.set(k1, v2);
    else map.delete(k1);
  }

  swapSetKeys(set, k1, k2) {
    const h1 = set.has(k1);
    const h2 = set.has(k2);
    if (h1) set.add(k2);
    else set.delete(k2);
    if (h2) set.add(k1);
    else set.delete(k1);
  }

  /**
   * Generates pseudo-legal moves for the piece at (r, c), supporting:
   * - Pieces on the 8x8 board (including Ghost passthrough, Feather jump, and Refuge outer-ring entry)
   * - Pieces currently in the Outer Refuge Ring (re-entering adjacent 8x8 edge squares)
   */
  getPseudoMovesFrom(r, c, forAttackCheck = false) {
    // Case A: Piece is currently outside the board in the Outer Refuge Ring
    if (inRefugeRing(r, c)) {
      if (forAttackCheck) return []; // Pieces in Refuge do not check the 8x8 board until they re-enter
      const refugePiece = this.refugePieces.get(`${r},${c}`);
      if (!refugePiece || refugePiece.color !== this.turn) return [];

      const moves = [];
      const color = refugePiece.color;
      const promoRank = color === COLORS.WHITE ? 0 : 7;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          if (this.isWall(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (target && (target.color === color || this.isShielded(nr, nc))) continue;

          moves.push({
            from: [r, c],
            to: [nr, nc],
            capture: Boolean(target),
            promotion: refugePiece.type === PIECES.PAWN && nr === promoRank,
            fromRefuge: true,
          });
        }
      }
      return moves;
    }

    // Case B: Piece is on the standard 8x8 board
    if (!inBounds(r, c)) return [];
    const piece = this.board[r][c];
    if (!piece) return [];
    if (!forAttackCheck && piece.color !== this.turn) return [];
    if (this.isFrozen(r, c)) return [];

    const moves = [];
    const color = piece.color;
    const promoRank = color === COLORS.WHITE ? 0 : 7;
    const isGhost = this.hasGhost(r, c);
    const canEnterRefuge = !forAttackCheck && this.hasRefugeReady(r, c);

    const canLandOnBoard = (nr, nc) => {
      if (!inBounds(nr, nc)) return false;
      if (this.isWall(nr, nc)) return false;
      const target = this.board[nr][nc];
      if (!target) return true;
      if (target.color === color) return false;
      if (this.isShielded(nr, nc)) return false;
      return true;
    };

    const canLandOnRefugeRing = (nr, nc) => {
      if (!canEnterRefuge || !inRefugeRing(nr, nc)) return false;
      const occupant = this.refugePieces.get(`${nr},${nc}`);
      if (!occupant) return true;
      return occupant.color !== color; // Can capture enemy piece visiting the same Refuge square!
    };

    switch (piece.type) {
      case PIECES.PAWN: {
        const dir = color === COLORS.WHITE ? -1 : 1;
        const startRank = color === COLORS.WHITE ? 6 : 1;

        if (!forAttackCheck) {
          const r1 = r + dir;
          if (inBounds(r1, c) && !this.board[r1][c] && !this.isWall(r1, c)) {
            moves.push({
              from: [r, c],
              to: [r1, c],
              promotion: r1 === promoRank,
            });
          } else if (canLandOnRefugeRing(r1, c)) {
            moves.push({
              from: [r, c],
              to: [r1, c],
              capture: Boolean(this.refugePieces.get(`${r1},${c}`)),
              toRefuge: true,
            });
          }

          // 2 steps forward (with Ghost Phase, can phase through a blocker on r1!)
          const r2 = r + 2 * dir;
          const r1ClearOrGhost = isGhost || (inBounds(r1, c) && !this.board[r1][c] && !this.isWall(r1, c));
          if (
            r === startRank &&
            r1ClearOrGhost &&
            inBounds(r2, c) &&
            !this.board[r2][c] &&
            !this.isWall(r2, c)
          ) {
            moves.push({
              from: [r, c],
              to: [r2, c],
              doublePawnPush: !this.board[r1][c],
            });
          }
        }

        for (const dc of [-1, 1]) {
          const nr = r + dir;
          const nc = c + dc;
          if (inBounds(nr, nc)) {
            if (this.isWall(nr, nc)) continue;
            if (forAttackCheck) {
              moves.push({ from: [r, c], to: [nr, nc], capture: true });
              continue;
            }
            const target = this.board[nr][nc];
            if (target && target.color !== color && !this.isShielded(nr, nc)) {
              moves.push({
                from: [r, c],
                to: [nr, nc],
                capture: true,
                promotion: nr === promoRank,
              });
            } else if (
              this.enPassantTarget &&
              this.enPassantTarget[0] === nr &&
              this.enPassantTarget[1] === nc &&
              !this.isShielded(r, nc)
            ) {
              moves.push({
                from: [r, c],
                to: [nr, nc],
                capture: true,
                enPassant: true,
              });
            }
          } else if (canLandOnRefugeRing(nr, nc)) {
            moves.push({
              from: [r, c],
              to: [nr, nc],
              capture: Boolean(this.refugePieces.get(`${nr},${nc}`)),
              toRefuge: true,
            });
          }
        }
        break;
      }

      case PIECES.KNIGHT: {
        const jumps = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1],
        ];
        for (const [dr, dc] of jumps) {
          const nr = r + dr;
          const nc = c + dc;
          if (canLandOnBoard(nr, nc)) {
            moves.push({
              from: [r, c],
              to: [nr, nc],
              capture: Boolean(this.board[nr][nc]),
            });
          } else if (canLandOnRefugeRing(nr, nc)) {
            moves.push({
              from: [r, c],
              to: [nr, nc],
              capture: Boolean(this.refugePieces.get(`${nr},${nc}`)),
              toRefuge: true,
            });
          }
        }
        break;
      }

      case PIECES.KING: {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (canLandOnBoard(nr, nc)) {
              moves.push({
                from: [r, c],
                to: [nr, nc],
                capture: Boolean(this.board[nr][nc]),
              });
            }
          }
        }
        if (!forAttackCheck) {
          moves.push(...this.getCastlingMoves(r, c, color, false));
        }
        break;
      }

      case PIECES.BISHOP:
      case PIECES.ROOK:
      case PIECES.QUEEN: {
        const dirs = [];
        if (piece.type === PIECES.ROOK || piece.type === PIECES.QUEEN) {
          dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        }
        if (piece.type === PIECES.BISHOP || piece.type === PIECES.QUEEN) {
          dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }
        const maxBlockers = isGhost ? 1 : 0;
        for (const [dr, dc] of dirs) {
          let nr = r + dr;
          let nc = c + dc;
          let blockersPassed = 0;
          while (inBounds(nr, nc) || canLandOnRefugeRing(nr, nc)) {
            if (inRefugeRing(nr, nc)) {
              moves.push({
                from: [r, c],
                to: [nr, nc],
                capture: Boolean(this.refugePieces.get(`${nr},${nc}`)),
                toRefuge: true,
                passedThrough: blockersPassed > 0,
              });
              break;
            }

            if (this.isWall(nr, nc)) {
              if (blockersPassed < maxBlockers) {
                blockersPassed++;
                nr += dr;
                nc += dc;
                continue;
              }
              break;
            }

            const target = this.board[nr][nc];
            if (!target) {
              moves.push({
                from: [r, c],
                to: [nr, nc],
                capture: false,
                passedThrough: blockersPassed > 0,
              });
            } else {
              const isIllegalKingPassthroughCapture =
                blockersPassed > 0 && target.type === PIECES.KING;
              if (
                target.color !== color &&
                !this.isShielded(nr, nc) &&
                !isIllegalKingPassthroughCapture
              ) {
                moves.push({
                  from: [r, c],
                  to: [nr, nc],
                  capture: true,
                  passedThrough: blockersPassed > 0,
                });
              }
              if (blockersPassed < maxBlockers) {
                blockersPassed++;
              } else {
                break;
              }
            }
            nr += dr;
            nc += dc;
          }
        }
        break;
      }
    }

    // If piece has Feather Jump active this turn, add Knight jump moves
    if (this.hasFeather(r, c) && piece.type !== PIECES.KNIGHT) {
      const jumps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      for (const [dr, dc] of jumps) {
        const nr = r + dr;
        const nc = c + dc;
        if (canLandOnBoard(nr, nc)) {
          const alreadyListed = moves.some((m) => m.to[0] === nr && m.to[1] === nc);
          if (!alreadyListed) {
            moves.push({
              from: [r, c],
              to: [nr, nc],
              capture: Boolean(this.board[nr][nc]),
              promotion: piece.type === PIECES.PAWN && nr === promoRank,
              featherJump: true,
            });
          }
        }
      }
    }

    // If piece has Refuge active and is on an edge square, also allow stepping 1 square directly
    // outward into any adjacent Refuge border square
    if (canEnterRefuge) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (canLandOnRefugeRing(nr, nc)) {
            const alreadyListed = moves.some((m) => m.to[0] === nr && m.to[1] === nc);
            if (!alreadyListed) {
              moves.push({
                from: [r, c],
                to: [nr, nc],
                capture: Boolean(this.refugePieces.get(`${nr},${nc}`)),
                toRefuge: true,
              });
            }
          }
        }
      }
    }

    return moves;
  }

  getMovesFrom(r, c) {
    if (this.winner) return [];
    const piece = this.getPieceAt(r, c);
    if (!piece || piece.color !== this.turn) return [];

    const pseudoMoves = this.getPseudoMovesFrom(r, c, false);
    return pseudoMoves.filter((m) => !this.wouldMoveLeaveKingInCheck(m, piece.color));
  }

  getCastlingMoves(r, c, color, skipCheckValidation = false) {
    const moves = [];
    const homeRank = color === COLORS.WHITE ? 7 : 0;
    if (r !== homeRank || c !== 4) return moves;
    if (this.isFrozen(r, c)) return moves;

    const rights = this.castlingRights[color];
    if (!rights) return moves;

    const enemyColor = oppositeColor(color);
    if (!skipCheckValidation && this.isSquareAttackedBy(homeRank, 4, enemyColor)) {
      return moves;
    }

    if (
      rights.k &&
      !this.board[homeRank][5] &&
      !this.board[homeRank][6] &&
      !this.isWall(homeRank, 5) &&
      !this.isWall(homeRank, 6) &&
      !this.isFrozen(homeRank, 7) &&
      this.board[homeRank][7]?.type === PIECES.ROOK &&
      this.board[homeRank][7]?.color === color
    ) {
      const transitSafe =
        skipCheckValidation ||
        (!this.isSquareAttackedBy(homeRank, 5, enemyColor) &&
          !this.isSquareAttackedBy(homeRank, 6, enemyColor));
      if (transitSafe) {
        moves.push({
          from: [homeRank, 4],
          to: [homeRank, 6],
          castling: 'k',
        });
      }
    }

    if (
      rights.q &&
      !this.board[homeRank][3] &&
      !this.board[homeRank][2] &&
      !this.board[homeRank][1] &&
      !this.isWall(homeRank, 3) &&
      !this.isWall(homeRank, 2) &&
      !this.isWall(homeRank, 1) &&
      !this.isFrozen(homeRank, 0) &&
      this.board[homeRank][0]?.type === PIECES.ROOK &&
      this.board[homeRank][0]?.color === color
    ) {
      const transitSafe =
        skipCheckValidation ||
        (!this.isSquareAttackedBy(homeRank, 3, enemyColor) &&
          !this.isSquareAttackedBy(homeRank, 2, enemyColor));
      if (transitSafe) {
        moves.push({
          from: [homeRank, 4],
          to: [homeRank, 2],
          castling: 'q',
        });
      }
    }

    return moves;
  }

  getAllMoves(color = this.turn) {
    if (this.winner) return [];
    const savedTurn = this.turn;
    this.turn = color;
    const all = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c]?.color === color) {
          all.push(...this.getMovesFrom(r, c));
        }
      }
    }
    for (const [key, piece] of Array.from(this.refugePieces.entries())) {
      if (piece.color === color) {
        const [rr, rc] = key.split(',').map(Number);
        all.push(...this.getMovesFrom(rr, rc));
      }
    }
    this.turn = savedTurn;
    return all;
  }

  hasPotentialRescuePowerup(color) {
    if (this.powerupsUsedThisTurn >= MAX_INVENTORY_SLOTS) return false;
    const inv = this.inventories[color] || [];
    const rescueTypes = new Set(['wall', 'freeze', 'feather', 'swap', 'resurrect', 'ghost', 'transform']);
    return inv.some((id) => rescueTypes.has(id));
  }

  checkEndOfGameCondition() {
    if (this.winner) return;
    const legalMoves = this.getAllMoves(this.turn);
    if (legalMoves.length === 0 && !this.hasPotentialRescuePowerup(this.turn)) {
      if (this.isKingInCheck(this.turn)) {
        this.winner = oppositeColor(this.turn);
        this.winReason = 'Checkmate';
      } else {
        this.winner = 'draw';
        this.winReason = 'Stalemate';
      }
    }
  }

  /**
   * Forfeits/skips the current player's turn when their 10-second Panic timer expires!
   */
  skipTurnByPanicTimeout() {
    if (this.winner) return null;
    const timedOutColor = this.turn;

    // If the timed-out player is in Check, auto-play a random legal move so King safety stays valid!
    if (this.isKingInCheck(timedOutColor)) {
      const legal = this.getAllMoves(timedOutColor);
      if (legal.length > 0) {
        const chosen = legal[Math.floor(Math.random() * legal.length)];
        return this.makeMove(chosen.from, chosen.to, PIECES.QUEEN);
      }
    }

    this.panicActive[timedOutColor] = false;
    if (this.fogTurns[timedOutColor] > 0) {
      this.fogTurns[timedOutColor]--;
    }

    for (const [k, left] of this.walls.entries()) {
      if (left <= 1) this.walls.delete(k);
      else this.walls.set(k, left - 1);
    }
    for (const [k, data] of this.shields.entries()) {
      if (data.turnsLeft <= 1) this.shields.delete(k);
      else this.shields.set(k, { ...data, turnsLeft: data.turnsLeft - 1 });
    }
    for (const [k, data] of this.frozen.entries()) {
      if (data.turnsLeft <= 1) this.frozen.delete(k);
      else this.frozen.set(k, { ...data, turnsLeft: data.turnsLeft - 1 });
    }

    this.featherSquares.clear();
    this.ghostSquares.clear();
    this.refugeReadySquares.clear();
    this.powerupsUsedThisTurn = 0;
    this.enPassantTarget = null;

    const skipRecord = {
      color: timedOutColor,
      piece: '⏱',
      from: [0, 0],
      to: [0, 0],
      panicTimeoutSkip: true,
      moveNumber: this.fullMoveNumber,
    };
    this.history.push(skipRecord);

    if (this.turn === COLORS.BLACK) {
      this.fullMoveNumber++;
    }
    this.turn = oppositeColor(this.turn);
    this.checkEndOfGameCondition();
    return skipRecord;
  }

  /**
   * Executes a legal move `{ from: [r1, c1], to: [r2, c2] }`.
   */
  makeMove(from, to, promotionPiece = PIECES.QUEEN, options = {}) {
    const [r1, c1] = from;
    const [r2, c2] = to;
    const legalMoves = this.getMovesFrom(r1, c1);
    const matched = legalMoves.find(
      (m) => m.to[0] === r2 && m.to[1] === c2
    );
    if (!matched) return null;

    const fromInBounds = inBounds(r1, c1);
    const toInBounds = inBounds(r2, c2);
    const fromKey = `${r1},${c1}`;
    const toKey = `${r2},${c2}`;

    const movingPiece = { ...this.getPieceAt(r1, c1) };
    const moverColor = movingPiece.color;

    // Clear active Panic timer for this player since they made their move in time
    this.panicActive[moverColor] = false;

    // Check if this attack hits an Armored Pawn!
    const epTargetKey = matched.enPassant ? `${r1},${c2}` : null;
    const hitsArmorOnTarget =
      (toInBounds && this.board[r2]?.[c2] && this.armoredSquares.has(toKey)) ||
      (!toInBounds && this.refugePieces.get(toKey)?.armored);
    const hitsArmorEnPassant = Boolean(matched.enPassant && this.armoredSquares.has(epTargetKey));

    if (hitsArmorOnTarget || hitsArmorEnPassant) {
      // Attacking piece stays on its starting square, and the Pawn's Armor is destroyed!
      if (hitsArmorEnPassant) {
        this.armoredSquares.delete(epTargetKey);
      } else if (toInBounds) {
        this.armoredSquares.delete(toKey);
      } else {
        const rp = this.refugePieces.get(toKey);
        if (rp) this.refugePieces.set(toKey, { ...rp, armored: false });
      }

      // Tick down turn effects & advance turn
      this.tickEndOfTurnEffects(moverColor, false, options);

      const bounceRecord = {
        color: moverColor,
        piece: movingPiece.type,
        from: [r1, c1],
        to: [r2, c2],
        armorBroken: true,
        spawnedItem: this.lastSpawnedItem,
        moveNumber: this.fullMoveNumber,
      };
      this.history.push(bounceRecord);

      if (this.turn === COLORS.BLACK) {
        this.fullMoveNumber++;
      }
      this.turn = oppositeColor(this.turn);
      this.checkEndOfGameCondition();
      return bounceRecord;
    }

    // Standard move or capture (including Refuge entry/exit)
    let capturedPiece = null;
    let capturedSquare = null;

    if (toInBounds && this.board[r2][c2]) {
      capturedPiece = { ...this.board[r2][c2] };
      capturedSquare = [r2, c2];
    } else if (!toInBounds && this.refugePieces.has(toKey)) {
      capturedPiece = { ...this.refugePieces.get(toKey) };
      capturedSquare = [r2, c2];
    }

    if (matched.enPassant && fromInBounds) {
      const epPawnRow = r1;
      const epPawnCol = c2;
      capturedPiece = { ...this.board[epPawnRow][epPawnCol] };
      capturedSquare = [epPawnRow, epPawnCol];
      this.board[epPawnRow][epPawnCol] = null;
      this.frozen.delete(`${epPawnRow},${epPawnCol}`);
      this.shields.delete(`${epPawnRow},${epPawnCol}`);
      this.armoredSquares.delete(`${epPawnRow},${epPawnCol}`);
    }

    if (capturedPiece && toInBounds) {
      this.frozen.delete(toKey);
      this.shields.delete(toKey);
      this.armoredSquares.delete(toKey);
    }

    // Check if moving piece was carrying Armor or Star Shield
    const movingHadArmor = fromInBounds
      ? this.armoredSquares.has(fromKey)
      : Boolean(movingPiece.armored);
    if (fromInBounds) {
      this.armoredSquares.delete(fromKey);
    }

    const movingShield = fromInBounds ? this.shields.get(fromKey) : null;
    if (fromInBounds) {
      this.shields.delete(fromKey);
    }

    // Remove piece from origin
    if (fromInBounds) {
      this.board[r1][c1] = null;
    } else {
      this.refugePieces.delete(fromKey);
    }

    // Place piece at destination
    let promotedTo = null;
    if (toInBounds) {
      const destPiece = { type: movingPiece.type, color: moverColor };
      if (matched.promotion) {
        promotedTo = promotionPiece || PIECES.QUEEN;
        destPiece.type = promotedTo;
      }
      this.board[r2][c2] = destPiece;
      if (movingHadArmor && destPiece.type === PIECES.PAWN) {
        this.armoredSquares.add(toKey);
      }
      if (movingShield) {
        this.shields.set(toKey, movingShield);
      }
    } else {
      // Destination is on the Outer Refuge Ring
      this.refugePieces.set(toKey, {
        type: movingPiece.type,
        color: moverColor,
        armored: movingHadArmor,
      });
    }

    if (matched.castling === 'k') {
      this.board[r1][5] = this.board[r1][7];
      this.board[r1][7] = null;
    } else if (matched.castling === 'q') {
      this.board[r1][3] = this.board[r1][0];
      this.board[r1][0] = null;
    }

    if (movingPiece.type === PIECES.KING) {
      this.castlingRights[moverColor].k = false;
      this.castlingRights[moverColor].q = false;
    }
    if (movingPiece.type === PIECES.ROOK && fromInBounds) {
      const homeRank = moverColor === COLORS.WHITE ? 7 : 0;
      if (r1 === homeRank && c1 === 0) this.castlingRights[moverColor].q = false;
      if (r1 === homeRank && c1 === 7) this.castlingRights[moverColor].k = false;
    }
    if (capturedPiece?.type === PIECES.ROOK && toInBounds) {
      const enemyHomeRank = capturedPiece.color === COLORS.WHITE ? 7 : 0;
      if (r2 === enemyHomeRank && c2 === 0) this.castlingRights[capturedPiece.color].q = false;
      if (r2 === enemyHomeRank && c2 === 7) this.castlingRights[capturedPiece.color].k = false;
    }

    if (matched.doublePawnPush) {
      const dir = moverColor === COLORS.WHITE ? -1 : 1;
      this.enPassantTarget = [r1 + dir, c1];
    } else {
      this.enPassantTarget = null;
    }

    if (capturedPiece) {
      this.captured[capturedPiece.color].push(capturedPiece.type);
    }

    // Check if destination square had a Rainbow '?' Item Box
    const wasAtMaxBoxesBeforeMove = this.itemBoxes.size >= MAX_BOARD_ITEMS;
    let pickedUpBox = false;
    let grantedPowerup = null;
    let inventoryWasFull = false;

    if (toInBounds && this.itemBoxes.has(toKey)) {
      pickedUpBox = true;
      this.itemBoxes.delete(toKey);
      if (this.inventories[moverColor].length < MAX_INVENTORY_SLOTS) {
        grantedPowerup = options.awardedPowerup || randomPowerupId();
        this.inventories[moverColor].push(grantedPowerup);
      } else {
        inventoryWasFull = true;
      }
      if (wasAtMaxBoxesBeforeMove || this.turnsUntilNextSpawn <= 2) {
        this.turnsUntilNextSpawn = rollReplenishDelayHalfTurns();
      }
    }

    this.tickEndOfTurnEffects(moverColor, pickedUpBox, options);

    const moveRecord = {
      color: moverColor,
      piece: movingPiece.type,
      from: [r1, c1],
      to: [r2, c2],
      captured: capturedPiece ? capturedPiece.type : null,
      capturedSquare,
      castling: matched.castling || null,
      enPassant: Boolean(matched.enPassant),
      promotedTo,
      pickedUpBox,
      grantedPowerup,
      inventoryWasFull,
      spawnedItem: this.lastSpawnedItem,
      toRefuge: !toInBounds,
      fromRefuge: !fromInBounds,
      moveNumber: this.fullMoveNumber,
    };

    this.history.push(moveRecord);

    if (capturedPiece?.type === PIECES.KING) {
      this.winner = moverColor;
      this.winReason = 'King captured';
    }

    if (this.turn === COLORS.BLACK) {
      this.fullMoveNumber++;
    }
    this.turn = oppositeColor(this.turn);

    this.checkEndOfGameCondition();

    return moveRecord;
  }

  tickEndOfTurnEffects(moverColor, pickedUpBox, options = {}) {
    if (this.fogTurns[moverColor] > 0) {
      this.fogTurns[moverColor]--;
    }

    for (const [k, left] of this.walls.entries()) {
      if (left <= 1) this.walls.delete(k);
      else this.walls.set(k, left - 1);
    }

    for (const [k, data] of this.shields.entries()) {
      if (data.turnsLeft <= 1) this.shields.delete(k);
      else this.shields.set(k, { ...data, turnsLeft: data.turnsLeft - 1 });
    }

    for (const [k, data] of this.frozen.entries()) {
      if (data.turnsLeft <= 1) this.frozen.delete(k);
      else this.frozen.set(k, { ...data, turnsLeft: data.turnsLeft - 1 });
    }

    this.featherSquares.clear();
    this.ghostSquares.clear();
    this.refugeReadySquares.clear();
    this.powerupsUsedThisTurn = 0;

    let spawnedItem = null;
    if ('spawnedItem' in options) {
      if (options.spawnedItem) {
        const [sr, sc] = options.spawnedItem;
        if (this.itemBoxes.size < MAX_BOARD_ITEMS) {
          this.itemBoxes.add(`${sr},${sc}`);
          spawnedItem = [sr, sc];
        }
        this.turnsUntilNextSpawn = rollReplenishDelayHalfTurns();
      } else if (this.itemBoxes.size < MAX_BOARD_ITEMS && !pickedUpBox) {
        this.turnsUntilNextSpawn = Math.max(1, this.turnsUntilNextSpawn - 1);
      }
    } else {
      if (this.itemBoxes.size < MAX_BOARD_ITEMS && !pickedUpBox) {
        this.turnsUntilNextSpawn--;
        if (this.turnsUntilNextSpawn <= 0) {
          spawnedItem = this.spawnRandomItemBox();
          this.turnsUntilNextSpawn = rollReplenishDelayHalfTurns();
        }
      }
    }
    this.lastSpawnedItem = spawnedItem;
  }

  resign(color) {
    if (this.winner) return;
    this.winner = oppositeColor(color);
    this.winReason = 'Resignation';
  }

  formatMoveForViewer(moveRecord, viewerColor, visibleSquares) {
    if (moveRecord.panicTimeoutSkip) {
      return `🚨 Timed Out (Skipped)`;
    }
    const boxTag = moveRecord.pickedUpBox ? ' 🎁' : '';
    const armorTag = moveRecord.armorBroken ? ' 🛡️!' : '';
    if (!viewerColor || moveRecord.color === viewerColor || !this.isPlayerFogged(viewerColor)) {
      const promo = moveRecord.promotedTo ? `=${moveRecord.promotedTo.toUpperCase()}` : '';
      const cap = moveRecord.armorBroken ? '×🛡️' : moveRecord.captured ? '×' : '→';
      return `${moveRecord.piece.toUpperCase()} ${coordsToAlgebraic(...moveRecord.from)} ${cap} ${coordsToAlgebraic(...moveRecord.to)}${promo}${boxTag}${armorTag}`;
    }

    const fromVisible = visibleSquares.has(`${moveRecord.from[0]},${moveRecord.from[1]}`);
    const toVisible = visibleSquares.has(`${moveRecord.to[0]},${moveRecord.to[1]}`);

    const fromStr = fromVisible ? coordsToAlgebraic(...moveRecord.from) : '??';
    const toStr = toVisible ? coordsToAlgebraic(...moveRecord.to) : '??';
    const pieceStr = toVisible ? moveRecord.piece.toUpperCase() : '?';
    const capStr = moveRecord.armorBroken ? '×🛡️' : moveRecord.captured ? '×' : '→';

    return `${pieceStr} ${fromStr} ${capStr} ${toStr}`;
  }
}
