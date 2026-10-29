/**
 * FogChess: Powerup Edition Engine (v5)
 *
 * Combines Chess ("Capture the King" ruleset + Check alerts) with Mario Kart-style Mystery Item Boxes:
 * - Board is normally fully visible to both players.
 * - Rainbow '?' Item Boxes spawn on unoccupied squares in the middle ranks (ranks 3-6),
 *   up to a maximum of 3 boxes on the board at once, with a random 2-5 turn delay before replenishing.
 * - Landing a piece on an Item Box consumes it and grants a random powerup (max 2 held per player).
 * - Players may use up to 2 powerups on a single turn before making their move.
 * - Full state serialization/deserialization so rejoining a room restores the live game & inventories.
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
    fullDesc: 'Inflicts Fog of War on your opponent for 1–3 of their turns (they only see what their pieces see, while you see the full board).',
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
    fullDesc: 'Encases a visible enemy non-King piece in ice so it cannot move on their upcoming turn.',
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
 * Rolls a random replenishment delay of 2 to 5 full turns (4 to 10 half-turns).
 */
export function rollReplenishDelayHalfTurns() {
  const fullTurns = Math.floor(Math.random() * 4) + 2; // 2, 3, 4, or 5 full turns
  return fullTurns * 2;
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

    // Powerup & status state
    this.itemBoxes = new Set();
    this.inventories = {
      w: [],
      b: [],
    };
    this.powerupsUsedThisTurn = 0;
    // Countdown in half-turns before another '?' box spawns (2-5 full turns = 4-10 half-turns)
    this.turnsUntilNextSpawn = rollReplenishDelayHalfTurns();

    // Active board/player effects:
    this.fogTurns = { w: 0, b: 0 };
    this.walls = new Map(); // "r,c" -> remaining half-turns
    this.shields = new Map(); // "r,c" -> { color, turnsLeft }
    this.frozen = new Map(); // "r,c" -> { color, turnsLeft }
    this.featherSquares = new Set(); // "r,c"

    if (Array.isArray(initialItemCoords)) {
      for (const [r, c] of initialItemCoords) {
        this.itemBoxes.add(`${r},${c}`);
      }
    } else {
      // Spawn 2 initial mystery boxes on middle ranks (rows 2..5)
      this.spawnRandomItemBox();
      this.spawnRandomItemBox();
    }
  }

  /**
   * Serializes the entire live match state (including both players' powerups, active effects,
   * board, turn, and move history) so a joining/rejoining client can restore it without resetting.
   */
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

  /**
   * Restores a serialized match state onto this game instance.
   */
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

  /**
   * Finds the [r, c] coordinates of `color`'s King, or null if captured.
   */
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
   * Returns true if `color`'s King is currently under attack (in Check) by any enemy piece.
   * Respects Stone Walls and Frozen enemy pieces.
   */
  isKingInCheck(color) {
    if (this.winner) return false;
    const kingSq = this.findKingSquare(color);
    if (!kingSq) return false;
    const [kr, kc] = kingSq;
    const attackerColor = oppositeColor(color);
    const enemyMoves = this.getAllMoves(attackerColor);
    return enemyMoves.some((m) => m.to[0] === kr && m.to[1] === kc);
  }

  /**
   * Computes the set of visible squares (as "r,c" strings) for `viewerColor`.
   * If `viewerColor` is NOT currently affected by Fog Cloud, all 64 squares are visible!
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
            const castleMoves = this.getCastlingMoves(r, c, viewerColor);
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

  /**
   * Validates and executes a powerup activation before the current player's move.
   * Players may use up to 2 powerups (their entire inventory) on a single turn!
   */
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

    // Remove from inventory & increment counter
    inv.splice(slotIndex, 1);
    this.powerupsUsedThisTurn++;

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
        const duration = params.duration || (Math.floor(Math.random() * 3) + 1); // 1 to 3 turns
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

        this.board[r1][c1] = p2;
        this.board[r2][c2] = p1;

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
   * Returns all legal moves for the piece at (r, c), respecting Walls, Star Shields, Ice Freeze, and Feather Jump.
   */
  getMovesFrom(r, c) {
    if (this.winner) return [];
    const piece = this.board[r][c];
    if (!piece || piece.color !== this.turn) return [];

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

        for (const dc of [-1, 1]) {
          const nr = r + dir;
          const nc = c + dc;
          if (!inBounds(nr, nc) || this.isWall(nr, nc)) continue;

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
        moves.push(...this.getCastlingMoves(r, c, color));
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

  getCastlingMoves(r, c, color) {
    const moves = [];
    const homeRank = color === COLORS.WHITE ? 7 : 0;
    if (r !== homeRank || c !== 4) return moves;
    if (this.isFrozen(r, c)) return moves;

    const rights = this.castlingRights[color];
    if (!rights) return moves;

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
      moves.push({
        from: [homeRank, 4],
        to: [homeRank, 6],
        castling: 'k',
      });
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
      moves.push({
        from: [homeRank, 4],
        to: [homeRank, 2],
        castling: 'q',
      });
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
   * Executes a move `{ from: [r1, c1], to: [r2, c2] }`.
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
      // If picking up this box dropped the board below max capacity, or to enforce a 2-5 turn delay
      // after a pickup, ensure turnsUntilNextSpawn is at least a fresh 2-5 turn delay!
      if (wasAtMaxBoxesBeforeMove || this.turnsUntilNextSpawn <= 2) {
        this.turnsUntilNextSpawn = rollReplenishDelayHalfTurns();
      }
    }

    // Tick down turn-based effects at the end of this player's move
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

    // Handle delayed replenishment of '?' item boxes (2-5 full turns = 4-10 half-turns)
    // Never spawn on the exact same move a box was picked up!
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
