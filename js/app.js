import {
  FogChessGame,
  COLORS,
  PIECES,
  coordsToAlgebraic,
  oppositeColor,
} from './chess.js';
import { RoomNetwork, generateRoomCode } from './network.js';
import { getPieceSVG, PIECE_NAMES } from './pieces.js';

class FogChessApp {
  constructor() {
    this.game = new FogChessGame();
    this.mode = 'online'; // 'online' | 'bot'
    this.myColor = COLORS.WHITE;
    this.hostColorPref = 'w'; // 'w' | 'b' | 'random'
    this.boardFlipped = false;
    this.selectedSquare = null; // [r, c]
    this.legalMovesForSelected = [];
    this.pendingPromotionMove = null; // { from, to }
    this.fogPeekDebug = false; // only allowed in practice/bot mode

    this.network = new RoomNetwork({
      onStatusChange: (state, text) => this.handleNetworkStatus(state, text),
      onPeerConnected: () => this.handlePeerConnected(),
      onMessage: (data) => this.handleNetworkMessage(data),
      onPeerDisconnected: () => this.handlePeerDisconnected(),
      onError: (msg) => this.showToast(msg, 'error'),
    });

    this.cacheDOM();
    this.bindEvents();
    this.checkURLRoomParam();
    this.renderAll();
  }

  cacheDOM() {
    this.boardEl = document.getElementById('chessboard');
    this.rankLabelsEl = document.getElementById('rank-labels');
    this.fileLabelsEl = document.getElementById('file-labels');

    // Room & Lobby elements
    this.createRoomBtn = document.getElementById('btn-create-room');
    this.joinRoomBtn = document.getElementById('btn-join-room');
    this.roomCodeInput = document.getElementById('input-room-code');
    this.hostColorSelect = document.getElementById('select-host-color');
    this.activeRoomPanel = document.getElementById('active-room-panel');
    this.lobbySetupPanel = document.getElementById('lobby-setup-panel');
    this.roomCodeBadge = document.getElementById('room-code-display');
    this.copyLinkBtn = document.getElementById('btn-copy-link');
    this.copyCodeBtn = document.getElementById('btn-copy-code');
    this.openSecondTabBtn = document.getElementById('btn-open-second-tab');
    this.leaveRoomBtn = document.getElementById('btn-leave-room');
    this.practiceBotBtn = document.getElementById('btn-practice-bot');

    // Status & HUD
    this.connectionBadge = document.getElementById('connection-badge');
    this.connectionText = document.getElementById('connection-text');
    this.turnBanner = document.getElementById('turn-banner');
    this.myRoleBadge = document.getElementById('my-role-badge');
    this.visibleCountBadge = document.getElementById('visible-count-badge');
    this.moveListEl = document.getElementById('move-list');
    this.capturedWhiteEl = document.getElementById('captured-white');
    this.capturedBlackEl = document.getElementById('captured-black');

    // Game controls
    this.flipBoardBtn = document.getElementById('btn-flip-board');
    this.resignBtn = document.getElementById('btn-resign');
    this.rematchBtn = document.getElementById('btn-rematch');
    this.peekFogBtn = document.getElementById('btn-peek-fog');

    // Modals
    this.promotionModal = document.getElementById('promotion-modal');
    this.promotionChoices = document.getElementById('promotion-choices');
    this.gameOverBanner = document.getElementById('game-over-banner');
    this.gameOverTitle = document.getElementById('game-over-title');
    this.gameOverSubtitle = document.getElementById('game-over-subtitle');
    this.bannerRematchBtn = document.getElementById('btn-banner-rematch');
    this.toastEl = document.getElementById('toast-notification');
  }

  bindEvents() {
    this.createRoomBtn.addEventListener('click', () => {
      this.hostColorPref = this.hostColorSelect.value;
      const code = generateRoomCode();
      this.startHostingRoom(code);
    });

    this.joinRoomBtn.addEventListener('click', () => {
      const code = this.roomCodeInput.value.trim().toUpperCase();
      if (!code || code.length < 4) {
        this.showToast('Please enter a valid room code.', 'error');
        return;
      }
      this.startJoiningRoom(code);
    });

    this.roomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.joinRoomBtn.click();
      }
    });

    this.copyCodeBtn.addEventListener('click', () => {
      if (!this.network.roomCode) return;
      navigator.clipboard?.writeText(this.network.roomCode);
      this.showToast(`Copied room code: ${this.network.roomCode}`, 'success');
    });

    this.copyLinkBtn.addEventListener('click', () => {
      if (!this.network.roomCode) return;
      const url = this.getInviteURL(this.network.roomCode);
      navigator.clipboard?.writeText(url);
      this.showToast('Invite link copied to clipboard!', 'success');
    });

    this.openSecondTabBtn.addEventListener('click', () => {
      if (!this.network.roomCode) return;
      const url = this.getInviteURL(this.network.roomCode);
      window.open(url, '_blank');
    });

    this.leaveRoomBtn.addEventListener('click', () => {
      this.network.cleanup();
      this.activeRoomPanel.classList.add('hidden');
      this.lobbySetupPanel.classList.remove('hidden');
      window.history.replaceState({}, '', window.location.pathname);
      this.handleNetworkStatus('idle', 'Not in a room');
      this.resetMatch(COLORS.WHITE);
    });

    this.practiceBotBtn.addEventListener('click', () => {
      this.network.cleanup();
      this.mode = 'bot';
      this.activeRoomPanel.classList.add('hidden');
      this.lobbySetupPanel.classList.remove('hidden');
      this.peekFogBtn.classList.remove('hidden');
      this.handleNetworkStatus('bot', 'Practice vs. Tactical Bot');
      this.resetMatch(COLORS.WHITE);
      this.showToast('Started Practice vs. Bot match! You play White.', 'success');
    });

    this.flipBoardBtn.addEventListener('click', () => {
      this.boardFlipped = !this.boardFlipped;
      this.renderBoard();
    });

    this.peekFogBtn.addEventListener('click', () => {
      if (this.mode !== 'bot') return;
      this.fogPeekDebug = !this.fogPeekDebug;
      this.peekFogBtn.textContent = this.fogPeekDebug ? 'Hide Fog Peek' : 'Peek Through Fog';
      this.renderBoard();
    });

    this.resignBtn.addEventListener('click', () => {
      if (this.game.winner) return;
      this.game.resign(this.myColor);
      if (this.mode === 'online' && this.network.connected) {
        this.network.send({ type: 'RESIGN', color: this.myColor });
      }
      this.renderAll();
    });

    const triggerRematch = () => {
      const nextColor = oppositeColor(this.myColor);
      this.resetMatch(nextColor);
      if (this.mode === 'online' && this.network.connected) {
        this.network.send({
          type: 'START_MATCH',
          yourColor: oppositeColor(nextColor),
        });
      }
      this.showToast('New match started! Colors swapped.', 'success');
    };

    this.rematchBtn.addEventListener('click', triggerRematch);
    this.bannerRematchBtn.addEventListener('click', triggerRematch);
  }

  checkURLRoomParam() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && roomParam.trim().length >= 4) {
      const cleanCode = roomParam.trim().toUpperCase();
      this.roomCodeInput.value = cleanCode;
      this.startJoiningRoom(cleanCode);
    }
  }

  getInviteURL(code) {
    const url = new URL(window.location.href);
    url.searchParams.set('room', code);
    return url.toString();
  }

  startHostingRoom(code) {
    this.mode = 'online';
    this.fogPeekDebug = false;
    this.peekFogBtn.classList.add('hidden');

    let chosenColor = COLORS.WHITE;
    if (this.hostColorPref === 'b') chosenColor = COLORS.BLACK;
    else if (this.hostColorPref === 'random') {
      chosenColor = Math.random() < 0.5 ? COLORS.WHITE : COLORS.BLACK;
    }

    this.resetMatch(chosenColor);
    this.lobbySetupPanel.classList.add('hidden');
    this.activeRoomPanel.classList.remove('hidden');
    this.roomCodeBadge.textContent = code;
    this.openSecondTabBtn.classList.remove('hidden');

    const url = new URL(window.location.href);
    url.searchParams.set('room', code);
    window.history.replaceState({}, '', url.toString());

    this.network.hostRoom(code);
  }

  startJoiningRoom(code) {
    this.mode = 'online';
    this.fogPeekDebug = false;
    this.peekFogBtn.classList.add('hidden');

    this.lobbySetupPanel.classList.add('hidden');
    this.activeRoomPanel.classList.remove('hidden');
    this.roomCodeBadge.textContent = code;
    this.openSecondTabBtn.classList.add('hidden');

    this.network.joinRoom(code);
  }

  resetMatch(myColor) {
    this.game.reset();
    this.myColor = myColor;
    this.boardFlipped = myColor === COLORS.BLACK;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.pendingPromotionMove = null;
    this.promotionModal.classList.add('hidden');
    this.gameOverBanner.classList.add('hidden');
    this.renderAll();

    if (this.mode === 'bot' && this.game.turn !== this.myColor) {
      this.scheduleBotMove();
    }
  }

  handleNetworkStatus(state, text) {
    this.connectionBadge.className = `status-badge status-${state}`;
    this.connectionText.textContent = text;
  }

  handlePeerConnected() {
    this.showToast('Opponent connected to room!', 'success');
    if (this.network.isHost) {
      // Host assigns colors and starts the match
      const guestColor = oppositeColor(this.myColor);
      this.resetMatch(this.myColor);
      this.network.send({
        type: 'START_MATCH',
        yourColor: guestColor,
      });
    }
  }

  handlePeerDisconnected() {
    this.showToast('Opponent disconnected from the room.', 'error');
  }

  handleNetworkMessage(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'START_MATCH': {
        this.resetMatch(data.yourColor);
        this.showToast(
          `Match started! You are playing as ${data.yourColor === COLORS.WHITE ? 'White' : 'Black'}.`,
          'success'
        );
        break;
      }

      case 'MOVE': {
        this.game.makeMove(data.from, data.to, data.promotionPiece);
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
        this.renderAll();
        break;
      }

      case 'RESIGN': {
        this.game.resign(data.color);
        this.renderAll();
        this.showToast('Opponent resigned!', 'success');
        break;
      }
    }
  }

  isMyTurn() {
    if (this.game.winner) return false;
    if (this.mode === 'online' && !this.network.connected) {
      // Allow moving on board only once connected (or in practice mode)
      return false;
    }
    return this.game.turn === this.myColor;
  }

  handleSquareClick(r, c) {
    if (this.game.winner) return;

    if (this.mode === 'online' && !this.network.connected) {
      this.showToast('Waiting for opponent to join the room first (or click Practice vs. Bot).', 'info');
      return;
    }

    if (!this.isMyTurn()) return;

    // Check if clicked square is a legal move destination for currently selected piece
    const matchingMove = this.legalMovesForSelected.find(
      (m) => m.to[0] === r && m.to[1] === c
    );

    if (matchingMove) {
      if (matchingMove.promotion) {
        this.openPromotionModal(matchingMove.from, matchingMove.to);
      } else {
        this.executePlayerMove(matchingMove.from, matchingMove.to);
      }
      return;
    }

    // Otherwise check if clicked square contains one of our own pieces
    const clickedPiece = this.game.board[r][c];
    if (clickedPiece && clickedPiece.color === this.myColor) {
      if (
        this.selectedSquare &&
        this.selectedSquare[0] === r &&
        this.selectedSquare[1] === c
      ) {
        // Deselect
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
      } else {
        this.selectedSquare = [r, c];
        this.legalMovesForSelected = this.game.getMovesFrom(r, c);
      }
      this.renderBoard();
      return;
    }

    // Deselect
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.renderBoard();
  }

  openPromotionModal(from, to) {
    this.pendingPromotionMove = { from, to };
    this.promotionChoices.innerHTML = '';
    const promoTypes = [PIECES.QUEEN, PIECES.ROOK, PIECES.BISHOP, PIECES.KNIGHT];

    for (const type of promoTypes) {
      const btn = document.createElement('button');
      btn.className = 'promo-choice-btn';
      btn.innerHTML = `${getPieceSVG(type, this.myColor)}<span>${PIECE_NAMES[type]}</span>`;
      btn.addEventListener('click', () => {
        this.promotionModal.classList.add('hidden');
        this.executePlayerMove(from, to, type);
        this.pendingPromotionMove = null;
      });
      this.promotionChoices.appendChild(btn);
    }

    this.promotionModal.classList.remove('hidden');
  }

  executePlayerMove(from, to, promotionPiece = PIECES.QUEEN) {
    const moveRecord = this.game.makeMove(from, to, promotionPiece);
    if (!moveRecord) return;

    this.selectedSquare = null;
    this.legalMovesForSelected = [];

    if (this.mode === 'online' && this.network.connected) {
      this.network.send({
        type: 'MOVE',
        from,
        to,
        promotionPiece,
      });
    }

    this.renderAll();

    if (this.mode === 'bot' && !this.game.winner && this.game.turn !== this.myColor) {
      this.scheduleBotMove();
    }
  }

  /**
   * Tactical Bot that strictly obeys Fog of War (only sees its own visible squares!)
   */
  scheduleBotMove() {
    const botColor = oppositeColor(this.myColor);
    setTimeout(() => {
      if (this.game.winner || this.game.turn !== botColor) return;
      const allMoves = this.game.getAllMoves(botColor);
      if (allMoves.length === 0) return;

      const pieceValues = { k: 1000, q: 9, r: 5, b: 3, n: 3, p: 1 };

      // Score moves based on captures & center control
      let bestScore = -Infinity;
      let bestMoves = [];

      for (const m of allMoves) {
        let score = 0;
        const target = this.game.board[m.to[0]][m.to[1]];
        if (target) {
          score += (pieceValues[target.type] || 1) * 12;
        }
        if (m.promotion) score += 8;
        // Slight center preference
        const centerDist = Math.abs(3.5 - m.to[0]) + Math.abs(3.5 - m.to[1]);
        score += (7 - centerDist) * 0.3;
        score += Math.random() * 0.8;

        if (score > bestScore) {
          bestScore = score;
          bestMoves = [m];
        }
      }

      const chosen = bestMoves[0];
      this.game.makeMove(chosen.from, chosen.to, PIECES.QUEEN);
      this.renderAll();
    }, 450);
  }

  renderAll() {
    this.renderBoard();
    this.renderHUD();
    this.renderMoveHistory();
    this.renderCaptured();
  }

  renderBoard() {
    // Compute squares visible to `this.myColor`
    // Note: when the game is over (a King is captured), reveal the entire board!
    const revealAll = Boolean(this.game.winner) || this.fogPeekDebug;
    const visibleSquares = this.game.getVisibleSquares(this.myColor);

    this.visibleCountBadge.textContent = `${visibleSquares.size} / 64 squares visible`;

    // Render rank & file coordinate labels
    const rows = this.boardFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const cols = this.boardFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    this.rankLabelsEl.innerHTML = rows.map((r) => `<span>${8 - r}</span>`).join('');
    this.fileLabelsEl.innerHTML = cols.map((c) => `<span>${files[c]}</span>`).join('');

    this.boardEl.innerHTML = '';
    const lastMove = this.game.history[this.game.history.length - 1] || null;

    for (const r of rows) {
      for (const c of cols) {
        const sqKey = `${r},${c}`;
        const isLight = (r + c) % 2 === 0;
        const isVisible = visibleSquares.has(sqKey);

        const sqEl = document.createElement('div');
        sqEl.className = `square ${isLight ? 'sq-light' : 'sq-dark'}`;
        sqEl.dataset.row = r;
        sqEl.dataset.col = c;
        sqEl.dataset.coord = coordsToAlgebraic(r, c);

        if (!isVisible && !revealAll) {
          sqEl.classList.add('sq-fog');
        } else if (!isVisible && revealAll) {
          sqEl.classList.add('sq-fog-peek');
        } else {
          sqEl.classList.add('sq-visible');
        }

        // Selected square highlight
        if (
          this.selectedSquare &&
          this.selectedSquare[0] === r &&
          this.selectedSquare[1] === c
        ) {
          sqEl.classList.add('sq-selected');
        }

        // Last move highlight ONLY if the square is currently visible (or game over)
        if (lastMove && (isVisible || revealAll)) {
          if (
            (lastMove.from[0] === r && lastMove.from[1] === c) ||
            (lastMove.to[0] === r && lastMove.to[1] === c)
          ) {
            sqEl.classList.add('sq-last-move');
          }
        }

        // Render piece ONLY if visible (or if it's our own piece, which is always visible, or revealAll)
        const piece = this.game.board[r][c];
        if (piece && (isVisible || revealAll || piece.color === this.myColor)) {
          const pieceWrapper = document.createElement('div');
          pieceWrapper.className = 'piece-container';
          pieceWrapper.innerHTML = getPieceSVG(piece.type, piece.color);
          sqEl.appendChild(pieceWrapper);
        }

        // Legal move target indicators
        const moveOption = this.legalMovesForSelected.find(
          (m) => m.to[0] === r && m.to[1] === c
        );
        if (moveOption) {
          sqEl.classList.add('sq-legal-target');
          const marker = document.createElement('div');
          marker.className = moveOption.capture
            ? 'legal-capture-ring'
            : 'legal-move-dot';
          sqEl.appendChild(marker);
        }

        sqEl.addEventListener('click', () => this.handleSquareClick(r, c));
        this.boardEl.appendChild(sqEl);
      }
    }
  }

  renderHUD() {
    const myColorName = this.myColor === COLORS.WHITE ? 'White' : 'Black';
    this.myRoleBadge.textContent = `Playing as ${myColorName}`;
    this.myRoleBadge.className = `role-badge role-${this.myColor}`;

    if (this.game.winner) {
      const winnerName = this.game.winner === COLORS.WHITE ? 'White' : 'Black';
      const didIWin = this.game.winner === this.myColor;
      this.turnBanner.textContent = `${winnerName} wins (${this.game.winReason})!`;
      this.turnBanner.className = `turn-banner ${didIWin ? 'banner-win' : 'banner-loss'}`;

      this.gameOverTitle.textContent = didIWin ? 'Victory!' : 'Defeat';
      this.gameOverSubtitle.textContent = `${winnerName} won by ${this.game.winReason}. The fog has been lifted.`;
      this.gameOverBanner.classList.remove('hidden');
      return;
    }

    this.gameOverBanner.classList.add('hidden');

    if (this.mode === 'online' && !this.network.connected) {
      this.turnBanner.textContent = 'Waiting for opponent to join room...';
      this.turnBanner.className = 'turn-banner banner-waiting';
      return;
    }

    if (this.game.turn === this.myColor) {
      this.turnBanner.textContent = `Your Turn (${myColorName})`;
      this.turnBanner.className = 'turn-banner banner-my-turn';
    } else {
      const oppName = this.myColor === COLORS.WHITE ? 'Black' : 'White';
      this.turnBanner.textContent = `Opponent's Turn (${oppName})`;
      this.turnBanner.className = 'turn-banner banner-opp-turn';
    }
  }

  renderMoveHistory() {
    const visibleSquares = this.game.getVisibleSquares(this.myColor);
    const revealAll = Boolean(this.game.winner);

    if (this.game.history.length === 0) {
      this.moveListEl.innerHTML = `<div class="empty-moves">No moves played yet. Fog obscures all squares beyond your pieces' sight.</div>`;
      return;
    }

    const pairs = [];
    for (let i = 0; i < this.game.history.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: this.game.history[i],
        black: this.game.history[i + 1] || null,
      });
    }

    this.moveListEl.innerHTML = pairs
      .map((pair) => {
        const wText = this.game.formatMoveForViewer(
          pair.white,
          revealAll ? null : this.myColor,
          visibleSquares
        );
        const bText = pair.black
          ? this.game.formatMoveForViewer(
              pair.black,
              revealAll ? null : this.myColor,
              visibleSquares
            )
          : '';
        return `<div class="move-row">
          <span class="move-num">${pair.num}.</span>
          <span class="move-cell">${wText}</span>
          <span class="move-cell">${bText}</span>
        </div>`;
      })
      .join('');

    this.moveListEl.scrollTop = this.moveListEl.scrollHeight;
  }

  renderCaptured() {
    // this.game.captured.w = white pieces that were captured
    // this.game.captured.b = black pieces that were captured
    this.capturedWhiteEl.innerHTML = this.game.captured.w
      .map((type) => `<span class="captured-icon">${getPieceSVG(type, 'w')}</span>`)
      .join('');
    this.capturedBlackEl.innerHTML = this.game.captured.b
      .map((type) => `<span class="captured-icon">${getPieceSVG(type, 'b')}</span>`)
      .join('');
  }

  showToast(message, type = 'info') {
    this.toastEl.textContent = message;
    this.toastEl.className = `toast toast-${type}`;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastEl.classList.add('hidden');
    }, 3800);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.fogChessApp = new FogChessApp();
});
