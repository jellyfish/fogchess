import {
  FogChessGame,
  COLORS,
  PIECES,
  POWERUP_DEFS,
  MAX_INVENTORY_SLOTS,
  coordsToAlgebraic,
  oppositeColor,
} from './chess.js?v=5';
import { RoomNetwork, generateRoomCode } from './network.js?v=5';
import { getPieceSVG, PIECE_NAMES } from './pieces.js?v=5';

class FogChessApp {
  constructor() {
    this.game = new FogChessGame();
    this.mode = 'online'; // 'online' | 'bot'
    this.myColor = COLORS.WHITE;
    this.hostColorPref = 'w';
    this.boardFlipped = false;
    this.selectedSquare = null; // [r, c]
    this.legalMovesForSelected = [];
    this.pendingPromotionMove = null;
    this.fogPeekDebug = false;
    this.hasSyncedInitialState = false;

    // Powerup targeting state:
    // null or { slotIndex, powerupId, step, firstSquare?: [r, c] }
    this.targetingState = null;

    this.network = new RoomNetwork({
      onStatusChange: (state, text) => this.handleNetworkStatus(state, text),
      onPeerConnected: (info) => this.handlePeerConnected(info),
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
    this.checkAlertBadge = document.getElementById('check-alert-badge');
    this.visibleCountBadge = document.getElementById('visible-count-badge');
    this.moveListEl = document.getElementById('move-list');
    this.capturedWhiteEl = document.getElementById('captured-white');
    this.capturedBlackEl = document.getElementById('captured-black');

    // Powerup Inventory & Targeting Bar
    this.myInventoryEl = document.getElementById('my-inventory-slots');
    this.oppInventoryEl = document.getElementById('opp-inventory-slots');
    this.targetingBannerEl = document.getElementById('targeting-banner');
    this.targetingTextEl = document.getElementById('targeting-text');
    this.cancelTargetingBtn = document.getElementById('btn-cancel-targeting');

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
      const oldCode = this.network.roomCode;
      this.network.cleanup(true);
      this.clearRoomSnapshot(oldCode);
      this.activeRoomPanel.classList.add('hidden');
      this.lobbySetupPanel.classList.remove('hidden');
      window.history.replaceState({}, '', window.location.pathname);
      this.handleNetworkStatus('idle', 'Not in a room');
      this.resetMatch(COLORS.WHITE);
    });

    this.practiceBotBtn.addEventListener('click', () => {
      this.network.cleanup(true);
      this.mode = 'bot';
      this.activeRoomPanel.classList.add('hidden');
      this.lobbySetupPanel.classList.remove('hidden');
      this.peekFogBtn.classList.remove('hidden');
      this.handleNetworkStatus('bot', 'Practice vs. Powerup Bot');
      this.resetMatch(COLORS.WHITE);
      this.showToast('Started Powerup Chess vs. Bot! Land on rainbow ? boxes to grab items.', 'success');
    });

    this.cancelTargetingBtn.addEventListener('click', () => {
      this.targetingState = null;
      this.renderAll();
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
      this.saveRoomSnapshot();
      if (this.mode === 'online' && this.network.connected) {
        this.network.send({ type: 'RESIGN', color: this.myColor });
      }
      this.renderAll();
    });

    const triggerRematch = () => {
      const nextColor = oppositeColor(this.myColor);
      this.resetMatch(nextColor);
      this.saveRoomSnapshot();
      if (this.mode === 'online' && this.network.connected) {
        this.network.send({
          type: 'NEW_REMATCH',
          yourColor: oppositeColor(nextColor),
          state: this.game.serializeState(),
        });
      }
      this.showToast('New match started! Colors swapped.', 'success');
    };

    this.rematchBtn.addEventListener('click', triggerRematch);
    this.bannerRematchBtn.addEventListener('click', triggerRematch);
  }

  saveRoomSnapshot() {
    if (this.mode !== 'online' || !this.network.roomCode) return;
    try {
      const payload = {
        roomCode: this.network.roomCode,
        myColor: this.myColor,
        state: this.game.serializeState(),
      };
      sessionStorage.setItem(`fogchess_room_${this.network.roomCode}`, JSON.stringify(payload));
    } catch (_) {}
  }

  loadRoomSnapshot(code) {
    if (!code) return null;
    try {
      const raw = sessionStorage.getItem(`fogchess_room_${code.toUpperCase()}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  clearRoomSnapshot(code) {
    if (!code) return;
    try {
      sessionStorage.removeItem(`fogchess_room_${code.toUpperCase()}`);
    } catch (_) {}
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
    this.hasSyncedInitialState = false;
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
    this.saveRoomSnapshot();
  }

  startJoiningRoom(code) {
    this.mode = 'online';
    this.hasSyncedInitialState = false;
    this.fogPeekDebug = false;
    this.peekFogBtn.classList.add('hidden');

    // If this tab was previously in this room (e.g. accidental page reload), restore its snapshot first!
    const snapshot = this.loadRoomSnapshot(code);
    if (snapshot && snapshot.state) {
      this.game.loadState(snapshot.state);
      this.myColor = snapshot.myColor || COLORS.WHITE;
      this.boardFlipped = this.myColor === COLORS.BLACK;
      this.renderAll();
    }

    this.lobbySetupPanel.classList.add('hidden');
    this.activeRoomPanel.classList.remove('hidden');
    this.roomCodeBadge.textContent = code;
    this.openSecondTabBtn.classList.add('hidden');

    const url = new URL(window.location.href);
    url.searchParams.set('room', code);
    window.history.replaceState({}, '', url.toString());

    this.network.joinRoom(code);
  }

  resetMatch(myColor, initialItems = null) {
    this.game.reset(initialItems);
    this.myColor = myColor;
    this.boardFlipped = myColor === COLORS.BLACK;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.pendingPromotionMove = null;
    this.targetingState = null;
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

  /**
   * When a peer connects/reconnects, DO NOT wipe an existing match!
   * Instead, synchronize the current board & powerup state (`SYNC_MATCH_STATE`).
   */
  handlePeerConnected({ isResponder } = {}) {
    if (isResponder) {
      this.showToast('Opponent connected — syncing live match state!', 'success');
      this.network.send({
        type: 'SYNC_MATCH_STATE',
        yourColor: oppositeColor(this.myColor),
        state: this.game.serializeState(),
      });
    } else {
      // Joining / rejoining client announces readiness and shares its history count in case
      // the other player is the one who lost state.
      this.network.send({
        type: 'PEER_JOINED_READY',
        historyLength: this.game.history.length,
        myColor: this.myColor,
        state: this.game.isMatchInProgress() ? this.game.serializeState() : null,
      });
    }
  }

  handlePeerDisconnected() {
    this.showToast('Opponent disconnected. Their game state is preserved if they rejoin!', 'error');
  }

  handleNetworkMessage(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'PEER_JOINED_READY': {
        // If the joining player actually has a further-progressed match state than ours
        // (e.g. if our tab refreshed and lost state), adopt their state!
        if (
          data.state &&
          (data.historyLength || 0) > this.game.history.length
        ) {
          this.game.loadState(data.state);
          this.myColor = oppositeColor(data.myColor || COLORS.WHITE);
          this.boardFlipped = this.myColor === COLORS.BLACK;
          this.saveRoomSnapshot();
          this.renderAll();
          this.showToast('Restored in-progress match state from opponent!', 'success');
        } else {
          // Send our authoritative match state (whether at turn 1 or turn 30) to the joining player
          this.network.send({
            type: 'SYNC_MATCH_STATE',
            yourColor: oppositeColor(this.myColor),
            state: this.game.serializeState(),
          });
        }
        break;
      }

      case 'SYNC_MATCH_STATE': {
        if (!data.state) break;
        const incomingLen = data.state.history?.length || 0;
        const myLen = this.game.history.length;

        // If we somehow have more moves than the incoming sync, push our state back instead of overwriting!
        if (myLen > incomingLen) {
          this.network.send({
            type: 'SYNC_MATCH_STATE',
            yourColor: oppositeColor(this.myColor),
            state: this.game.serializeState(),
          });
          break;
        }

        this.game.loadState(data.state);
        this.myColor = data.yourColor || COLORS.BLACK;
        this.boardFlipped = this.myColor === COLORS.BLACK;
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
        this.targetingState = null;
        this.saveRoomSnapshot();
        this.renderAll();

        if (!this.hasSyncedInitialState) {
          this.hasSyncedInitialState = true;
          const colorLabel = this.myColor === COLORS.WHITE ? 'White' : 'Black';
          const statusMsg =
            incomingLen > 0
              ? `Rejoined in-progress match as ${colorLabel} (Move ${this.game.fullMoveNumber})!`
              : `Connected! You are playing as ${colorLabel}.`;
          this.showToast(statusMsg, 'success');
        }
        break;
      }

      case 'NEW_REMATCH': {
        if (data.state) {
          this.game.loadState(data.state);
        } else {
          this.game.reset();
        }
        this.myColor = data.yourColor;
        this.boardFlipped = this.myColor === COLORS.BLACK;
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
        this.targetingState = null;
        this.promotionModal.classList.add('hidden');
        this.gameOverBanner.classList.add('hidden');
        this.saveRoomSnapshot();
        this.renderAll();
        this.showToast(
          `Rematch started! You are playing as ${this.myColor === COLORS.WHITE ? 'White' : 'Black'}.`,
          'success'
        );
        break;
      }

      case 'USE_POWERUP': {
        const oppColor = oppositeColor(this.myColor);
        const res = this.game.usePowerup(oppColor, data.slotIndex, data.params || {});
        if (res.ok) {
          this.showToast(`Opponent used ${POWERUP_DEFS[data.powerupId]?.name || 'a powerup'}! ${res.summary}`, 'info');
        }
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
        this.saveRoomSnapshot();
        this.renderAll();
        break;
      }

      case 'MOVE': {
        const moveRec = this.game.makeMove(data.from, data.to, data.promotionPiece, {
          awardedPowerup: data.awardedPowerup,
          spawnedItem: data.spawnedItem ?? null,
        });
        if (moveRec?.pickedUpBox && moveRec.grantedPowerup) {
          this.showToast('Opponent collected a Mystery [?] Powerup Box!', 'info');
        }
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
        this.saveRoomSnapshot();
        this.renderAll();
        break;
      }

      case 'RESIGN': {
        this.game.resign(data.color);
        this.saveRoomSnapshot();
        this.renderAll();
        this.showToast('Opponent resigned!', 'success');
        break;
      }
    }
  }

  isMyTurn() {
    if (this.game.winner) return false;
    if (this.mode === 'online' && !this.network.connected) {
      return false;
    }
    return this.game.turn === this.myColor;
  }

  /**
   * Called when player clicks "Use" on a powerup slot in their inventory.
   * Players can use up to 2 powerups on a single turn!
   */
  initiatePowerupSlot(slotIndex) {
    if (!this.isMyTurn()) {
      this.showToast('Wait for your turn to activate a powerup!', 'info');
      return;
    }
    if (this.game.powerupsUsedThisTurn >= MAX_INVENTORY_SLOTS) {
      this.showToast('You have already used 2 powerups this turn! Now make your move.', 'info');
      return;
    }

    const powerupId = this.game.inventories[this.myColor][slotIndex];
    const def = POWERUP_DEFS[powerupId];
    if (!def) return;

    this.selectedSquare = null;
    this.legalMovesForSelected = [];

    if (def.targetType === 'none') {
      const duration = Math.floor(Math.random() * 3) + 1;
      this.commitPowerupUse(slotIndex, powerupId, { duration });
      return;
    }

    this.targetingState = {
      slotIndex,
      powerupId,
      step: 1,
      firstSquare: null,
    };
    this.renderAll();
  }

  commitPowerupUse(slotIndex, powerupId, params) {
    const res = this.game.usePowerup(this.myColor, slotIndex, params);
    if (!res.ok) {
      this.showToast(res.reason || 'Invalid target for powerup.', 'error');
      return false;
    }

    this.targetingState = null;
    this.saveRoomSnapshot();

    if (this.mode === 'online' && this.network.connected) {
      this.network.send({
        type: 'USE_POWERUP',
        slotIndex,
        powerupId,
        params,
      });
    }

    this.showToast(res.summary, 'success');
    this.renderAll();
    return true;
  }

  isValidPowerupTarget(r, c, visibleSquares) {
    if (!this.targetingState) return false;
    const def = POWERUP_DEFS[this.targetingState.powerupId];
    if (!def) return false;

    const key = `${r},${c}`;
    const piece = this.game.board[r][c];
    const oppColor = oppositeColor(this.myColor);

    switch (def.targetType) {
      case 'empty_square':
        return (
          !piece &&
          !this.game.isWall(r, c) &&
          !this.game.itemBoxes.has(key)
        );

      case 'friendly_non_king':
        if (!piece || piece.color !== this.myColor || piece.type === PIECES.KING) {
          return false;
        }
        if (this.targetingState.powerupId === 'feather' && this.game.isFrozen(r, c)) {
          return false;
        }
        return true;

      case 'enemy_non_king':
        return (
          Boolean(piece) &&
          piece.color === oppColor &&
          piece.type !== PIECES.KING &&
          visibleSquares.has(key)
        );

      case 'two_friendly_non_king': {
        if (!piece || piece.color !== this.myColor || piece.type === PIECES.KING) {
          return false;
        }
        if (this.targetingState.step === 2 && this.targetingState.firstSquare) {
          const [r1, c1] = this.targetingState.firstSquare;
          if (r1 === r && c1 === c) return false;
          const p1 = this.game.board[r1][c1];
          const promoRank = this.myColor === COLORS.WHITE ? 0 : 7;
          if (
            (p1.type === PIECES.PAWN && r === promoRank) ||
            (piece.type === PIECES.PAWN && r1 === promoRank)
          ) {
            return false;
          }
        }
        return true;
      }

      default:
        return false;
    }
  }

  handleSquareClick(r, c) {
    if (this.game.winner) return;

    if (this.mode === 'online' && !this.network.connected) {
      this.showToast('Waiting for opponent to join the room first (or click Practice vs. Bot).', 'info');
      return;
    }

    if (!this.isMyTurn()) return;

    // 1. Powerup Targeting mode:
    if (this.targetingState) {
      const visibleSquares = this.game.getVisibleSquares(this.myColor);
      if (!this.isValidPowerupTarget(r, c, visibleSquares)) {
        this.showToast('Select a highlighted valid target square (or click Cancel).', 'info');
        return;
      }

      const { slotIndex, powerupId, step, firstSquare } = this.targetingState;
      const def = POWERUP_DEFS[powerupId];

      if (def.targetType === 'two_friendly_non_king') {
        if (step === 1) {
          this.targetingState.firstSquare = [r, c];
          this.targetingState.step = 2;
          this.renderAll();
          return;
        } else {
          this.commitPowerupUse(slotIndex, powerupId, {
            squareA: firstSquare,
            squareB: [r, c],
          });
          return;
        }
      }

      this.commitPowerupUse(slotIndex, powerupId, { square: [r, c] });
      return;
    }

    // 2. Normal Chess Move handling:
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

    const clickedPiece = this.game.board[r][c];
    if (clickedPiece && clickedPiece.color === this.myColor) {
      if (this.game.isFrozen(r, c)) {
        this.showToast('❄️ That piece is frozen in ice for this turn!', 'info');
        return;
      }
      if (
        this.selectedSquare &&
        this.selectedSquare[0] === r &&
        this.selectedSquare[1] === c
      ) {
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
      } else {
        this.selectedSquare = [r, c];
        this.legalMovesForSelected = this.game.getMovesFrom(r, c);
      }
      this.renderBoard();
      return;
    }

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
    this.targetingState = null;
    this.saveRoomSnapshot();

    if (moveRecord.pickedUpBox) {
      if (moveRecord.grantedPowerup) {
        const def = POWERUP_DEFS[moveRecord.grantedPowerup];
        this.showToast(`🎁 Unlocked Powerup: ${def.icon} ${def.name}!`, 'success');
      } else if (moveRecord.inventoryWasFull) {
        this.showToast('🎁 Item Box consumed, but your inventory was already full (2/2)!', 'info');
      }
    }

    if (this.mode === 'online' && this.network.connected) {
      this.network.send({
        type: 'MOVE',
        from,
        to,
        promotionPiece,
        awardedPowerup: moveRecord.grantedPowerup,
        spawnedItem: moveRecord.spawnedItem,
      });
    }

    this.renderAll();

    if (this.mode === 'bot' && !this.game.winner && this.game.turn !== this.myColor) {
      this.scheduleBotMove();
    }
  }

  scheduleBotMove() {
    const botColor = oppositeColor(this.myColor);
    setTimeout(() => {
      if (this.game.winner || this.game.turn !== botColor) return;

      this.tryBotUsePowerup(botColor);

      const allMoves = this.game.getAllMoves(botColor);
      if (allMoves.length === 0) return;

      const pieceValues = { k: 1000, q: 9, r: 5, b: 3, n: 3, p: 1 };
      let bestScore = -Infinity;
      let bestMove = allMoves[0];

      for (const m of allMoves) {
        let score = 0;
        const toKey = `${m.to[0]},${m.to[1]}`;
        const target = this.game.board[m.to[0]][m.to[1]];

        if (target) {
          score += (pieceValues[target.type] || 1) * 14;
        }
        if (this.game.itemBoxes.has(toKey) && this.game.inventories[botColor].length < 2) {
          score += 18;
        }
        if (m.promotion) score += 10;

        const centerDist = Math.abs(3.5 - m.to[0]) + Math.abs(3.5 - m.to[1]);
        score += (7 - centerDist) * 0.35;
        score += Math.random() * 1.1;

        if (score > bestScore) {
          bestScore = score;
          bestMove = m;
        }
      }

      const moveRec = this.game.makeMove(bestMove.from, bestMove.to, PIECES.QUEEN);
      if (moveRec?.pickedUpBox && moveRec.grantedPowerup) {
        this.showToast('Bot collected a Mystery [?] Powerup Box!', 'info');
      }
      this.renderAll();
    }, 520);
  }

  tryBotUsePowerup(botColor) {
    const inv = this.game.inventories[botColor];
    if (!inv || inv.length === 0 || this.game.powerupsUsedThisTurn >= MAX_INVENTORY_SLOTS) return;

    if (inv.length < 2 && Math.random() > 0.65) return;

    const powerupId = inv[0];
    const humanColor = this.myColor;

    switch (powerupId) {
      case 'fog': {
        const duration = Math.floor(Math.random() * 3) + 1;
        const res = this.game.usePowerup(botColor, 0, { duration });
        if (res.ok) this.showToast(`Bot used ${res.summary}`, 'info');
        break;
      }

      case 'freeze': {
        const candidates = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = this.game.board[r][c];
            if (p && p.color === humanColor && p.type !== PIECES.KING && !this.game.isFrozen(r, c)) {
              candidates.push([r, c, p.type]);
            }
          }
        }
        if (candidates.length > 0) {
          const weights = { q: 9, r: 5, b: 3, n: 3, p: 1 };
          candidates.sort((a, b) => (weights[b[2]] || 1) - (weights[a[2]] || 1));
          const [r, c] = candidates[0];
          const res = this.game.usePowerup(botColor, 0, { square: [r, c] });
          if (res.ok) this.showToast(`Bot used ${res.summary}`, 'info');
        }
        break;
      }

      case 'shield':
      case 'feather': {
        const candidates = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = this.game.board[r][c];
            if (p && p.color === botColor && p.type !== PIECES.KING && !this.game.isFrozen(r, c)) {
              candidates.push([r, c, p.type]);
            }
          }
        }
        if (candidates.length > 0) {
          const weights = { q: 9, r: 5, n: 4, b: 3, p: 2 };
          candidates.sort((a, b) => (weights[b[2]] || 1) - (weights[a[2]] || 1));
          const [r, c] = candidates[0];
          const res = this.game.usePowerup(botColor, 0, { square: [r, c] });
          if (res.ok) this.showToast(`Bot used ${res.summary}`, 'info');
        }
        break;
      }

      case 'wall': {
        const emptyCenter = [];
        for (let r = 2; r <= 5; r++) {
          for (let c = 2; c <= 5; c++) {
            const key = `${r},${c}`;
            if (!this.game.board[r][c] && !this.game.isWall(r, c) && !this.game.itemBoxes.has(key)) {
              emptyCenter.push([r, c]);
            }
          }
        }
        if (emptyCenter.length > 0) {
          const chosen = emptyCenter[Math.floor(Math.random() * emptyCenter.length)];
          const res = this.game.usePowerup(botColor, 0, { square: chosen });
          if (res.ok) this.showToast(`Bot used ${res.summary}`, 'info');
        }
        break;
      }

      case 'swap': {
        const ownPieces = [];
        for (let r = 1; r <= 6; r++) {
          for (let c = 0; c < 8; c++) {
            const p = this.game.board[r][c];
            if (p && p.color === botColor && p.type !== PIECES.KING) {
              ownPieces.push([r, c]);
            }
          }
        }
        if (ownPieces.length >= 2) {
          const a = ownPieces[0];
          const b = ownPieces[ownPieces.length - 1];
          const res = this.game.usePowerup(botColor, 0, { squareA: a, squareB: b });
          if (res.ok) this.showToast(`Bot used ${res.summary}`, 'info');
        }
        break;
      }
    }
  }

  renderAll() {
    this.renderBoard();
    this.renderInventory();
    this.renderHUD();
    this.renderMoveHistory();
    this.renderCaptured();
  }

  renderInventory() {
    const myInv = this.game.inventories[this.myColor] || [];
    const oppColor = oppositeColor(this.myColor);
    const oppInv = this.game.inventories[oppColor] || [];
    const canActivateNow =
      this.isMyTurn() &&
      this.game.powerupsUsedThisTurn < MAX_INVENTORY_SLOTS &&
      !this.game.winner;

    let mySlotsHTML = '';
    for (let i = 0; i < 2; i++) {
      const powerupId = myInv[i];
      if (powerupId && POWERUP_DEFS[powerupId]) {
        const def = POWERUP_DEFS[powerupId];
        const isTargetingThis = this.targetingState && this.targetingState.slotIndex === i;
        mySlotsHTML += `
          <div class="powerup-slot slot-filled ${isTargetingThis ? 'slot-targeting' : ''}">
            <div class="slot-icon">${def.icon}</div>
            <div class="slot-info">
              <div class="slot-name">${def.name}</div>
              <div class="slot-desc">${def.shortDesc}</div>
            </div>
            <button
              class="btn btn-xs ${isTargetingThis ? 'btn-accent' : 'btn-primary'} btn-use-powerup"
              data-slot="${i}"
              ${!canActivateNow ? 'disabled' : ''}
            >
              ${isTargetingThis ? 'Targeting...' : 'Use'}
            </button>
          </div>
        `;
      } else {
        mySlotsHTML += `
          <div class="powerup-slot slot-empty">
            <div class="slot-empty-box">?</div>
            <div class="slot-info">
              <div class="slot-name">Empty Slot</div>
              <div class="slot-desc">Land on a rainbow ? square to unlock</div>
            </div>
          </div>
        `;
      }
    }
    this.myInventoryEl.innerHTML = mySlotsHTML;

    this.myInventoryEl.querySelectorAll('.btn-use-powerup').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.slot, 10);
        this.initiatePowerupSlot(idx);
      });
    });

    let oppSlotsHTML = '';
    for (let i = 0; i < 2; i++) {
      const hasItem = Boolean(oppInv[i]);
      oppSlotsHTML += `
        <div class="opp-mystery-pill ${hasItem ? 'opp-pill-filled' : 'opp-pill-empty'}" title="${hasItem ? 'Opponent holds a mystery powerup' : 'Empty slot'}">
          <span class="opp-pill-q">${hasItem ? '?' : '–'}</span>
        </div>
      `;
    }
    this.oppInventoryEl.innerHTML = oppSlotsHTML;

    if (this.targetingState) {
      const def = POWERUP_DEFS[this.targetingState.powerupId];
      let prompt = `${def.icon} ${def.name}: `;
      if (def.targetType === 'empty_square') {
        prompt += 'Click any highlighted empty square to drop a Stone Wall.';
      } else if (def.targetType === 'friendly_non_king') {
        prompt += 'Click one of your highlighted non-King pieces.';
      } else if (def.targetType === 'enemy_non_king') {
        prompt += 'Click a highlighted enemy non-King piece to freeze.';
      } else if (def.targetType === 'two_friendly_non_king') {
        prompt +=
          this.targetingState.step === 1
            ? 'Click the 1st friendly non-King piece to swap.'
            : 'Now click the 2nd friendly non-King piece to complete the swap.';
      }
      this.targetingTextEl.textContent = prompt;
      this.targetingBannerEl.classList.remove('hidden');
    } else {
      this.targetingBannerEl.classList.add('hidden');
    }
  }

  renderBoard() {
    const revealAll = Boolean(this.game.winner) || this.fogPeekDebug;
    const visibleSquares = this.game.getVisibleSquares(this.myColor);
    const amIFogged = this.game.isPlayerFogged(this.myColor);
    const oppColor = oppositeColor(this.myColor);
    const isOppFogged = this.game.isPlayerFogged(oppColor);

    const whiteInCheck = this.game.isKingInCheck(COLORS.WHITE);
    const blackInCheck = this.game.isKingInCheck(COLORS.BLACK);

    if (amIFogged) {
      const t = this.game.fogTurns[this.myColor];
      this.visibleCountBadge.textContent = `🌫️ Blinded by Fog (${t} turn${t > 1 ? 's' : ''} left) • ${visibleSquares.size}/64 visible`;
      this.visibleCountBadge.className = 'sight-badge badge-fog-active';
    } else if (isOppFogged) {
      const t = this.game.fogTurns[oppColor];
      this.visibleCountBadge.textContent = `🌫️ Opponent Blinded (${t} turn${t > 1 ? 's' : ''}) • Full Vision`;
      this.visibleCountBadge.className = 'sight-badge badge-opp-fogged';
    } else {
      this.visibleCountBadge.textContent = `Full Board Vision • ${this.game.itemBoxes.size}/3 ? Boxes on board`;
      this.visibleCountBadge.className = 'sight-badge';
    }

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

        if (
          this.selectedSquare &&
          this.selectedSquare[0] === r &&
          this.selectedSquare[1] === c
        ) {
          sqEl.classList.add('sq-selected');
        }

        if (
          this.targetingState?.firstSquare &&
          this.targetingState.firstSquare[0] === r &&
          this.targetingState.firstSquare[1] === c
        ) {
          sqEl.classList.add('sq-selected');
        }

        if (lastMove && (isVisible || revealAll)) {
          if (
            (lastMove.from[0] === r && lastMove.from[1] === c) ||
            (lastMove.to[0] === r && lastMove.to[1] === c)
          ) {
            sqEl.classList.add('sq-last-move');
          }
        }

        // 1. Render Rainbow '?' Item Box if present and square is visible
        if (this.game.itemBoxes.has(sqKey) && (isVisible || revealAll)) {
          const itemBoxEl = document.createElement('div');
          itemBoxEl.className = 'item-box-cube';
          itemBoxEl.title = 'Mystery Powerup Box — Land here to collect!';
          itemBoxEl.innerHTML = `<span class="item-box-q">?</span>`;
          sqEl.appendChild(itemBoxEl);
        }

        // 2. Render Stone Wall if present and square is visible
        if (this.game.isWall(r, c) && (isVisible || revealAll)) {
          const wallLeft = Math.ceil((this.game.walls.get(sqKey) || 1) / 2);
          const wallEl = document.createElement('div');
          wallEl.className = 'wall-obstacle';
          wallEl.title = `Impassable Stone Wall (${wallLeft} round${wallLeft > 1 ? 's' : ''} left)`;
          wallEl.innerHTML = `<span class="wall-icon">🧱</span><span class="effect-timer">${wallLeft}</span>`;
          sqEl.appendChild(wallEl);
        }

        // 3. Render Piece if present and visible
        const piece = this.game.board[r][c];
        if (piece && (isVisible || revealAll || piece.color === this.myColor)) {
          const pieceWrapper = document.createElement('div');
          pieceWrapper.className = 'piece-container';

          // Highlight King in Check!
          const isThisKingInCheck =
            piece.type === PIECES.KING &&
            ((piece.color === COLORS.WHITE && whiteInCheck) ||
              (piece.color === COLORS.BLACK && blackInCheck));

          if (isThisKingInCheck) {
            sqEl.classList.add('sq-in-check');
          }

          if (this.game.isShielded(r, c)) {
            pieceWrapper.classList.add('piece-shielded');
            sqEl.classList.add('sq-has-shield');
          }
          if (this.game.isFrozen(r, c)) {
            pieceWrapper.classList.add('piece-frozen');
            sqEl.classList.add('sq-has-freeze');
          }
          if (this.game.hasFeather(r, c)) {
            pieceWrapper.classList.add('piece-feathered');
          }

          pieceWrapper.innerHTML = getPieceSVG(piece.type, piece.color);
          sqEl.appendChild(pieceWrapper);

          const badges = [];
          if (isThisKingInCheck) badges.push('⚠️');
          if (this.game.isShielded(r, c)) badges.push('⭐');
          if (this.game.isFrozen(r, c)) badges.push('❄️');
          if (this.game.hasFeather(r, c)) badges.push('🪶');
          if (badges.length > 0) {
            const badgeEl = document.createElement('div');
            badgeEl.className = 'piece-status-badge';
            badgeEl.textContent = badges.join('');
            sqEl.appendChild(badgeEl);
          }
        }

        // 4. Powerup Targeting Highlight
        if (this.targetingState && this.isValidPowerupTarget(r, c, visibleSquares)) {
          sqEl.classList.add('sq-powerup-target');
          const ring = document.createElement('div');
          ring.className = 'powerup-target-ring';
          sqEl.appendChild(ring);
        }

        // 5. Legal Move Target Indicators
        const moveOption = this.legalMovesForSelected.find(
          (m) => m.to[0] === r && m.to[1] === c
        );
        if (moveOption) {
          sqEl.classList.add('sq-legal-target');
          const marker = document.createElement('div');
          marker.className = moveOption.capture
            ? 'legal-capture-ring'
            : moveOption.featherJump
            ? 'legal-feather-dot'
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
    const oppColor = oppositeColor(this.myColor);
    const oppColorName = oppColor === COLORS.WHITE ? 'White' : 'Black';

    this.myRoleBadge.textContent = `Playing as ${myColorName}`;
    this.myRoleBadge.className = `role-badge role-${this.myColor}`;

    const amIInCheck = this.game.isKingInCheck(this.myColor);
    const isOppInCheck = this.game.isKingInCheck(oppColor);

    if (this.checkAlertBadge) {
      if (amIInCheck) {
        this.checkAlertBadge.textContent = '⚠️ YOUR KING IS IN CHECK!';
        this.checkAlertBadge.className = 'check-badge check-danger';
      } else if (isOppInCheck) {
        this.checkAlertBadge.textContent = `⚔️ ${oppColorName} King in Check`;
        this.checkAlertBadge.className = 'check-badge check-opp';
      } else {
        this.checkAlertBadge.className = 'check-badge hidden';
      }
    }

    if (this.game.winner) {
      const winnerName = this.game.winner === COLORS.WHITE ? 'White' : 'Black';
      const didIWin = this.game.winner === this.myColor;
      this.turnBanner.textContent = `${winnerName} wins (${this.game.winReason})!`;
      this.turnBanner.className = `turn-banner ${didIWin ? 'banner-win' : 'banner-loss'}`;

      this.gameOverTitle.textContent = didIWin ? 'Victory!' : 'Defeat';
      this.gameOverSubtitle.textContent = `${winnerName} won by ${this.game.winReason}.`;
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
      const remainingPowerupUses = MAX_INVENTORY_SLOTS - this.game.powerupsUsedThisTurn;
      const heldCount = this.game.inventories[this.myColor].length;
      const canPowerup = heldCount > 0 && remainingPowerupUses > 0;
      const checkPrefix = amIInCheck ? '⚠️ CHECK! — ' : '';
      const hint = canPowerup ? ` — You can use ${ heldCount === 2 && remainingPowerupUses === 2 ? 'up to 2 Powerups' : 'a Powerup' } before moving!` : '';
      this.turnBanner.textContent = `${checkPrefix}Your Turn (${myColorName})${hint}`;
      this.turnBanner.className = `turn-banner ${amIInCheck ? 'banner-in-check' : 'banner-my-turn'}`;
    } else {
      const checkPrefix = amIInCheck ? '⚠️ Your King is in Check! — ' : isOppInCheck ? `⚔️ ${oppColorName} is in Check — ` : '';
      this.turnBanner.textContent = `${checkPrefix}Opponent's Turn (${oppColorName})`;
      this.turnBanner.className = 'turn-banner banner-opp-turn';
    }
  }

  renderMoveHistory() {
    const visibleSquares = this.game.getVisibleSquares(this.myColor);
    const revealAll = Boolean(this.game.winner);

    if (this.game.history.length === 0) {
      this.moveListEl.innerHTML = `<div class="empty-moves">No moves yet. Land on rainbow <strong>?</strong> squares to collect Mario Kart-style powerups!</div>`;
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
    }, 4200);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.fogChessApp = new FogChessApp();
});
