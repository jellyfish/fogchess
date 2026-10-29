/**
 * FogChess: Powerup Edition Engine (v6)
 *
 * - Full Chess legality: players cannot move into check or leave their King in check.
 * - Check, Checkmate, and Stalemate detection (plus King capture if an unblocked attack lands).
 * - Rainbow '?' Item Boxes spawn on unoccupied squares in the middle ranks (ranks 3-6),
 *   up to 3 on the board at once, with a 1.5–3 turn (3–6 half-turn) replenish delay.
 * - Players can hold up to 2 powerups and use up to 2 powerups on a single turn before moving.
 * - Full state serialization/deserialization for seamless room rejoin.
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

export const POWERUP_DEFS = {
  fog: {
    id: 'fog',
    name: 'Fog Cloud',
    icon: '🌫️',
    shortDesc: 'Blind opponent with Fog of War for 1–3 turns',
    fullDesc: 'Inflicts Fog of War on your opponent for 1–3 of their turns (they only see what their pieces see, while you see the full board and which of your pieces are hidden).',
    targetType: 'none',
  },
  wall: {
    id: 'wall',
    name: 'Stone Wall',
    icon: '🧱',
    shortDesc: 'Place an impassable wall on an empty square (2 rounds)',
    fullDesc: 'Drop a stone barrier on any empty square for 2 full rounds (4 turns). Blocks movement and sliding rays; Knights can jump over it.',
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
};

export const POWERUP_IDS = Object.keys(POWERUP_DEFS);
export const MAX_BOARD_ITEMS = 3;
export const MAX_INVENTORY_SLOTS = 2;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function coordsToAlgebraic(r, c) {
  return `${FILES[c]}${8 - r}`;
}

export function algebraicToCoords(sq) {
  const c = FILES.indexOf(sq[0]);
  const r = 8 - parseInt(sq[1], 10);
  return [r, c];
}

export function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function oppositeColor(color) {
  return color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
}

export function randomPowerupId() {
  return POWERUP_IDS[Math.floor(Math.random() * POWERUP_IDS.length)];
}

/**
 * Rolls a slightly faster replenishment delay of 3 to 6 half-turns (1.5 to 3 full turns).
 */
export function rollReplenishDelayHalfTurns() {
  return Math.floor(Math.random() * 4) + 3; // 3, 4, 5, or 6 half-turns
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

    this.fogTurns = { w: 0, b: 0 };
    this.walls = new Map();
    this.shields = new Map();
    this.frozen = new Map();
    this.featherSquares = new Set();

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

    return true;
  }

  isMatchInProgress() {
    return (
      this.history.length > 0 ||
      this.powerupsUsedThisTurn > 0 ||
      this.walls.size > 0 ||
      this.shields.size > 0 ||
      this.frozen.size > 0 ||
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

  /**
   * Returns true if square (targetR, targetC) is currently attacked by any piece of `attackerColor`.
   * Respects Stone Walls and Ice Freeze.
   */
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

  /**
   * Returns true if `color`'s King is currently in Check.
   */
  isKingInCheck(color) {
    const kingSq = this.findKingSquare(color);
    if (!kingSq) return false;
    return this.isSquareAttackedBy(kingSq[0], kingSq[1], oppositeColor(color));
  }

  /**
   * Simulates a pseudo-legal move and returns true if it leaves `moverColor`'s King in Check.
   */
  wouldMoveLeaveKingInCheck(move, moverColor) {
    const [r1, c1] = move.from;
    const [r2, c2] = move.to;

    const savedFrom = this.board[r1][c1];
    const savedTo = this.board[r2][c2];
    let savedEp = null;
    if (move.enPassant) {
      savedEp = this.board[r1][c2];
      this.board[r1][c2] = null;
    }

    this.board[r2][c2] = savedFrom;
    this.board[r1][c1] = null;

    const inCheck = this.isKingInCheck(moverColor);

    // Restore board
    this.board[r1][c1] = savedFrom;
    this.board[r2][c2] = savedTo;
    if (move.enPassant) {
      this.board[r1][c2] = savedEp;
    }

    return inCheck;
  }

  /**
   * Computes the set of visible squares (as "r,c" strings) for `viewerColor`.
   * If `viewerColor` is NOT currently affected by Fog Cloud (and `forceComputeSight` is false),
   * all 64 squares are visible.
   */
  getVisibleSquares(viewerColor, forceComputeSight = false) {
    const visible = new Set();

    if (!forceComputeSight && !this.isPlayerFogged(viewerColor)) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          visible.add(`${r},${c}`);
        }
      }
      return visible;
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece || piece.color !== viewerColor) continue;

        visible.add(`${r},${c}`);

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
                !this.board[r1][c] &&
                !this.isWall(r1, c) &&
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
            for (const [dr, dc] of dirs) {
              let nr = r + dr;
              let nc = c + dc;
              while (inBounds(nr, nc)) {
                visible.add(`${nr},${nc}`);
                if (this.board[nr][nc] || this.isWall(nr, nc)) {
                  break;
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

    // Re-evaluate if current player is still stuck with 0 moves and no remaining rescue powerups
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

        // Swap pieces on board
        this.board[r1][c1] = p2;
        this.board[r2][c2] = p1;

        if (!wasInCheck && this.isKingInCheck(color)) {
          // Revert swap if it exposes own King to Check
          this.board[r1][c1] = p1;
          this.board[r2][c2] = p2;
          return { ok: false, reason: 'Cannot swap pieces if it exposes your King to Check!' };
        }

        // Ensure swapping doesn't illegally leave player in check with 0 legal moves
        const key1 = `${r1},${c1}`;
        const key2 = `${r2},${c2}`;
        this.swapMapKeys(this.shields, key1, key2);
        this.swapMapKeys(this.frozen, key1, key2);
        this.swapSetKeys(this.featherSquares, key1, key2);

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
   * Generates pseudo-legal moves for the piece at (r, c) without filtering for self-check.
   * When `forAttackCheck` is true, omits castling to avoid recursion and only checks attackable squares.
   */
  getPseudoMovesFrom(r, c, forAttackCheck = false) {
    const piece = this.board[r][c];
    if (!piece) return [];
    if (!forAttackCheck && piece.color !== this.turn) return [];
    if (this.isFrozen(r, c)) return [];

    const moves = [];
    const color = piece.color;
    const promoRank = color === COLORS.WHITE ? 0 : 7;

    const canLandOn = (nr, nc) => {
      if (!inBounds(nr, nc)) return false;
      if (this.isWall(nr, nc)) return false;
      const target = this.board[nr][nc];
      if (!target) return true;
      if (target.color === color) return false;
      if (this.isShielded(nr, nc)) return false;
      return true;
    };

    switch (piece.type) {
      case PIECES.PAWN: {
        const dir = color === COLORS.WHITE ? -1 : 1;
        const startRank = color === COLORS.WHITE ? 6 : 1;

        // Pawn forward moves are not attacks
        if (!forAttackCheck) {
          const r1 = r + dir;
          if (inBounds(r1, c) && !this.board[r1][c] && !this.isWall(r1, c)) {
            moves.push({
              from: [r, c],
              to: [r1, c],
              promotion: r1 === promoRank,
            });

            const r2 = r + 2 * dir;
            if (
              r === startRank &&
              inBounds(r2, c) &&
              !this.board[r2][c] &&
              !this.isWall(r2, c)
            ) {
              moves.push({
                from: [r, c],
                to: [r2, c],
                doublePawnPush: true,
              });
            }
          }
        }

        for (const dc of [-1, 1]) {
          const nr = r + dir;
          const nc = c + dc;
          if (!inBounds(nr, nc) || this.isWall(nr, nc)) continue;

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
          if (canLandOn(nr, nc)) {
            moves.push({
              from: [r, c],
              to: [nr, nc],
              capture: Boolean(this.board[nr][nc]),
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
            if (canLandOn(nr, nc)) {
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
        for (const [dr, dc] of dirs) {
          let nr = r + dr;
          let nc = c + dc;
          while (inBounds(nr, nc)) {
            if (this.isWall(nr, nc)) break;
            const target = this.board[nr][nc];
            if (!target) {
              moves.push({ from: [r, c], to: [nr, nc], capture: false });
            } else {
              if (target.color !== color && !this.isShielded(nr, nc)) {
                moves.push({ from: [r, c], to: [nr, nc], capture: true });
              }
              break;
            }
            nr += dr;
            nc += dc;
          }
        }
        break;
      }
    }

    if (this.hasFeather(r, c) && piece.type !== PIECES.KNIGHT) {
      const jumps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      for (const [dr, dc] of jumps) {
        const nr = r + dr;
        const nc = c + dc;
        if (!canLandOn(nr, nc)) continue;
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

    return moves;
  }

  /**
   * Returns strictly legal moves for the piece at (r, c) — filters out any move that
   * puts or leaves the moving player's King in Check!
   */
  getMovesFrom(r, c) {
    if (this.winner) return [];
    const piece = this.board[r][c];
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
    // Cannot castle out of check
    if (!skipCheckValidation && this.isSquareAttackedBy(homeRank, 4, enemyColor)) {
      return moves;
    }

    // Kingside castling
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

    // Queenside castling
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
    this.turn = savedTurn;
    return all;
  }

  /**
   * Checks if `color` has any board-altering powerup in hand that could potentially create a legal move
   * when currently in check / having 0 legal moves.
   */
  hasPotentialRescuePowerup(color) {
    if (this.powerupsUsedThisTurn >= MAX_INVENTORY_SLOTS) return false;
    const inv = this.inventories[color] || [];
    const rescueTypes = new Set(['wall', 'freeze', 'feather', 'swap']);
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

    const movingPiece = { ...this.board[r1][c1] };
    const moverColor = movingPiece.color;
    let capturedPiece = this.board[r2][c2] ? { ...this.board[r2][c2] } : null;
    let capturedSquare = capturedPiece ? [r2, c2] : null;

    if (matched.enPassant) {
      const epPawnRow = r1;
      const epPawnCol = c2;
      capturedPiece = { ...this.board[epPawnRow][epPawnCol] };
      capturedSquare = [epPawnRow, epPawnCol];
      this.board[epPawnRow][epPawnCol] = null;
      this.frozen.delete(`${epPawnRow},${epPawnCol}`);
      this.shields.delete(`${epPawnRow},${epPawnCol}`);
    }

    const fromKey = `${r1},${c1}`;
    const toKey = `${r2},${c2}`;
    if (capturedPiece) {
      this.frozen.delete(toKey);
      this.shields.delete(toKey);
    }

    this.board[r2][c2] = movingPiece;
    this.board[r1][c1] = null;
    if (this.shields.has(fromKey)) {
      const shieldData = this.shields.get(fromKey);
      this.shields.delete(fromKey);
      this.shields.set(toKey, shieldData);
    }

    let promotedTo = null;
    if (matched.promotion) {
      promotedTo = promotionPiece || PIECES.QUEEN;
      this.board[r2][c2] = { type: promotedTo, color: moverColor };
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
    if (movingPiece.type === PIECES.ROOK) {
      const homeRank = moverColor === COLORS.WHITE ? 7 : 0;
      if (r1 === homeRank && c1 === 0) this.castlingRights[moverColor].q = false;
      if (r1 === homeRank && c1 === 7) this.castlingRights[moverColor].k = false;
    }
    if (capturedPiece?.type === PIECES.ROOK) {
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

    // Check if the destination square had a Rainbow '?' Item Box
    const wasAtMaxBoxesBeforeMove = this.itemBoxes.size >= MAX_BOARD_ITEMS;
    let pickedUpBox = false;
    let grantedPowerup = null;
    let inventoryWasFull = false;

    if (this.itemBoxes.has(toKey)) {
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
    this.powerupsUsedThisTurn = 0;

    // Handle delayed replenishment of '?' item boxes (3-6 half-turns)
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
      spawnedItem,
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

  resign(color) {
    if (this.winner) return;
    this.winner = oppositeColor(color);
    this.winReason = 'Resignation';
  }

  formatMoveForViewer(moveRecord, viewerColor, visibleSquares) {
    const boxTag = moveRecord.pickedUpBox ? ' 🎁' : '';
    if (!viewerColor || moveRecord.color === viewerColor || !this.isPlayerFogged(viewerColor)) {
      const promo = moveRecord.promotedTo ? `=${moveRecord.promotedTo.toUpperCase()}` : '';
      const cap = moveRecord.captured ? '×' : '→';
      return `${moveRecord.piece.toUpperCase()} ${coordsToAlgebraic(...moveRecord.from)} ${cap} ${coordsToAlgebraic(...moveRecord.to)}${promo}${boxTag}`;
    }

    const fromVisible = visibleSquares.has(`${moveRecord.from[0]},${moveRecord.from[1]}`);
    const toVisible = visibleSquares.has(`${moveRecord.to[0]},${moveRecord.to[1]}`);

    const fromStr = fromVisible ? coordsToAlgebraic(...moveRecord.from) : '??';
    const toStr = toVisible ? coordsToAlgebraic(...moveRecord.to) : '??';
    const pieceStr = toVisible ? moveRecord.piece.toUpperCase() : '?';
    const capStr = moveRecord.captured ? '×' : '→';

    return `${pieceStr} ${fromStr} ${capStr} ${toStr}`;
  }
}
