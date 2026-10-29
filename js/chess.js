/**
 * FogChess Engine
 * Implements Dark Chess / Fog of War Chess ("Capture the King" ruleset)
 * - No check or checkmate enforcement: players may move into attacked squares or move pinned pieces.
 * - Victory is achieved by capturing the enemy King (or opponent resignation).
 * - Visibility ("Sight"):
 *   - Friendly pieces illuminate their own square.
 *   - Sliding pieces (R, B, Q) illuminate rays up to and including the first blocker.
 *   - Knights & Kings illuminate all their target squares.
 *   - Pawns always illuminate their two forward-diagonals (even when empty),
 *     plus 1 square directly ahead (and 2 squares ahead from starting rank if 1st square is empty).
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

export class FogChessGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = this.createInitialBoard();
    this.turn = COLORS.WHITE;
    this.castlingRights = {
      w: { k: true, q: true },
      b: { k: true, q: true },
    };
    this.enPassantTarget = null; // [r, c] square where an en-passant capture lands
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
    this.history = [];
    this.captured = { w: [], b: [] }; // w: white pieces captured, b: black pieces captured
    this.winner = null; // 'w', 'b', or 'draw'
    this.winReason = null;
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

  /**
   * Computes the set of visible squares (as "r,c" strings) for `viewerColor`.
   */
  getVisibleSquares(viewerColor) {
    const visible = new Set();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece || piece.color !== viewerColor) continue;

        // Every friendly piece sees its own square
        visible.add(`${r},${c}`);

        switch (piece.type) {
          case PIECES.PAWN: {
            const dir = viewerColor === COLORS.WHITE ? -1 : 1;
            const startRank = viewerColor === COLORS.WHITE ? 6 : 1;

            // Always show two forward diagonals, even when empty
            for (const dc of [-1, 1]) {
              const nr = r + dir;
              const nc = c + dc;
              if (inBounds(nr, nc)) {
                visible.add(`${nr},${nc}`);
              }
            }

            // Forward 1 square (sees square even if blocked)
            const r1 = r + dir;
            if (inBounds(r1, c)) {
              visible.add(`${r1},${c}`);
              // Forward 2 squares from starting rank if 1st square is empty
              const r2 = r + 2 * dir;
              if (r === startRank && !this.board[r1][c] && inBounds(r2, c)) {
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
            // Castling squares are also visible if castling is currently available
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
                if (this.board[nr][nc]) {
                  // Stop ray at first blocking piece (the blocker's square itself is visible)
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
   * Returns all legal moves in FogChess for the piece at (r, c).
   * In FogChess, check does not restrict moves, so any pseudo-legal move is legal.
   */
  getMovesFrom(r, c) {
    if (this.winner) return [];
    const piece = this.board[r][c];
    if (!piece || piece.color !== this.turn) return [];

    const moves = [];
    const color = piece.color;

    switch (piece.type) {
      case PIECES.PAWN: {
        const dir = color === COLORS.WHITE ? -1 : 1;
        const startRank = color === COLORS.WHITE ? 6 : 1;
        const promoRank = color === COLORS.WHITE ? 0 : 7;

        // 1 step forward
        const r1 = r + dir;
        if (inBounds(r1, c) && !this.board[r1][c]) {
          moves.push({
            from: [r, c],
            to: [r1, c],
            promotion: r1 === promoRank,
          });

          // 2 steps forward
          const r2 = r + 2 * dir;
          if (r === startRank && inBounds(r2, c) && !this.board[r2][c]) {
            moves.push({
              from: [r, c],
              to: [r2, c],
              doublePawnPush: true,
            });
          }
        }

        // Captures (diagonal + en passant)
        for (const dc of [-1, 1]) {
          const nr = r + dir;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;

          const target = this.board[nr][nc];
          if (target && target.color !== color) {
            moves.push({
              from: [r, c],
              to: [nr, nc],
              capture: true,
              promotion: nr === promoRank,
            });
          } else if (
            this.enPassantTarget &&
            this.enPassantTarget[0] === nr &&
            this.enPassantTarget[1] === nc
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
          if (!inBounds(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || target.color !== color) {
            moves.push({
              from: [r, c],
              to: [nr, nc],
              capture: Boolean(target),
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
            if (!inBounds(nr, nc)) continue;
            const target = this.board[nr][nc];
            if (!target || target.color !== color) {
              moves.push({
                from: [r, c],
                to: [nr, nc],
                capture: Boolean(target),
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
            const target = this.board[nr][nc];
            if (!target) {
              moves.push({ from: [r, c], to: [nr, nc], capture: false });
            } else {
              if (target.color !== color) {
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

    return moves;
  }

  getCastlingMoves(r, c, color) {
    const moves = [];
    const homeRank = color === COLORS.WHITE ? 7 : 0;
    if (r !== homeRank || c !== 4) return moves;

    const rights = this.castlingRights[color];
    if (!rights) return moves;

    // Kingside castling (g-file = col 6, rook at col 7)
    if (
      rights.k &&
      !this.board[homeRank][5] &&
      !this.board[homeRank][6] &&
      this.board[homeRank][7]?.type === PIECES.ROOK &&
      this.board[homeRank][7]?.color === color
    ) {
      moves.push({
        from: [homeRank, 4],
        to: [homeRank, 6],
        castling: 'k',
      });
    }

    // Queenside castling (c-file = col 2, rook at col 0)
    if (
      rights.q &&
      !this.board[homeRank][3] &&
      !this.board[homeRank][2] &&
      !this.board[homeRank][1] &&
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
   * Executes a move `{ from: [r1, c1], to: [r2, c2], promotionPiece?: 'q'|'r'|'b'|'n' }`.
   * Returns a move record object if valid, or null if illegal.
   */
  makeMove(from, to, promotionPiece = PIECES.QUEEN) {
    const [r1, c1] = from;
    const [r2, c2] = to;
    const legalMoves = this.getMovesFrom(r1, c1);
    const matched = legalMoves.find(
      (m) => m.to[0] === r2 && m.to[1] === c2
    );
    if (!matched) return null;

    const movingPiece = { ...this.board[r1][c1] };
    let capturedPiece = this.board[r2][c2] ? { ...this.board[r2][c2] } : null;
    let capturedSquare = capturedPiece ? [r2, c2] : null;

    // Handle En Passant capture
    if (matched.enPassant) {
      const epPawnRow = r1;
      const epPawnCol = c2;
      capturedPiece = { ...this.board[epPawnRow][epPawnCol] };
      capturedSquare = [epPawnRow, epPawnCol];
      this.board[epPawnRow][epPawnCol] = null;
    }

    // Move piece
    this.board[r2][c2] = movingPiece;
    this.board[r1][c1] = null;

    // Handle Pawn Promotion
    let promotedTo = null;
    if (matched.promotion) {
      promotedTo = promotionPiece || PIECES.QUEEN;
      this.board[r2][c2] = { type: promotedTo, color: movingPiece.color };
    }

    // Handle Castling rook move
    if (matched.castling === 'k') {
      this.board[r1][5] = this.board[r1][7];
      this.board[r1][7] = null;
    } else if (matched.castling === 'q') {
      this.board[r1][3] = this.board[r1][0];
      this.board[r1][0] = null;
    }

    // Update castling rights
    if (movingPiece.type === PIECES.KING) {
      this.castlingRights[movingPiece.color].k = false;
      this.castlingRights[movingPiece.color].q = false;
    }
    if (movingPiece.type === PIECES.ROOK) {
      const homeRank = movingPiece.color === COLORS.WHITE ? 7 : 0;
      if (r1 === homeRank && c1 === 0) this.castlingRights[movingPiece.color].q = false;
      if (r1 === homeRank && c1 === 7) this.castlingRights[movingPiece.color].k = false;
    }
    if (capturedPiece?.type === PIECES.ROOK) {
      const enemyHomeRank = capturedPiece.color === COLORS.WHITE ? 7 : 0;
      if (r2 === enemyHomeRank && c2 === 0) this.castlingRights[capturedPiece.color].q = false;
      if (r2 === enemyHomeRank && c2 === 7) this.castlingRights[capturedPiece.color].k = false;
    }

    // Update En Passant target
    if (matched.doublePawnPush) {
      const dir = movingPiece.color === COLORS.WHITE ? -1 : 1;
      this.enPassantTarget = [r1 + dir, c1];
    } else {
      this.enPassantTarget = null;
    }

    // Record captured piece
    if (capturedPiece) {
      this.captured[capturedPiece.color].push(capturedPiece.type);
    }

    // Build move record
    const moveRecord = {
      color: movingPiece.color,
      piece: movingPiece.type,
      from: [r1, c1],
      to: [r2, c2],
      captured: capturedPiece ? capturedPiece.type : null,
      capturedSquare,
      castling: matched.castling || null,
      enPassant: Boolean(matched.enPassant),
      promotedTo,
      moveNumber: this.fullMoveNumber,
    };

    this.history.push(moveRecord);

    // Check if King was captured
    if (capturedPiece?.type === PIECES.KING) {
      this.winner = movingPiece.color;
      this.winReason = 'King captured';
    }

    // Advance turn
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

  /**
   * Formats a move for a given viewer's perspective so hidden squares don't leak in the move log!
   */
  formatMoveForViewer(moveRecord, viewerColor, visibleSquares) {
    if (!viewerColor) {
      // Spectator / full view
      return `${ coordsToAlgebraic(...moveRecord.from) } → ${ coordsToAlgebraic(...moveRecord.to) }`;
    }
    if (moveRecord.color === viewerColor) {
      const promo = moveRecord.promotedTo ? `=${moveRecord.promotedTo.toUpperCase()}` : '';
      const cap = moveRecord.captured ? '×' : '→';
      return `${moveRecord.piece.toUpperCase()} ${coordsToAlgebraic(...moveRecord.from)} ${cap} ${coordsToAlgebraic(...moveRecord.to)}${promo}`;
    }

    // Opponent's move: only reveal coordinates that are currently visible to viewer
    const fromVisible = visibleSquares.has(`${moveRecord.from[0]},${moveRecord.from[1]}`);
    const toVisible = visibleSquares.has(`${moveRecord.to[0]},${moveRecord.to[1]}`);

    const fromStr = fromVisible ? coordsToAlgebraic(...moveRecord.from) : '??';
    const toStr = toVisible ? coordsToAlgebraic(...moveRecord.to) : '??';
    const pieceStr = toVisible ? moveRecord.piece.toUpperCase() : '?';
    const capStr = moveRecord.captured ? '×' : '→';

    return `${pieceStr} ${fromStr} ${capStr} ${toStr}`;
  }
}
