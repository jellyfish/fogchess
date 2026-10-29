/**
 * FogChess P2P Room Networking (PeerJS / WebRTC + Local BroadcastChannel fallback)
 * Works 100% statically on GitHub Pages with no custom backend server required.
 */

const PEER_PREFIX = 'fogchess-v1-room-';

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class RoomNetwork {
  constructor({ onStatusChange, onPeerConnected, onMessage, onPeerDisconnected, onError }) {
    this.peer = null;
    this.conn = null;
    this.broadcastChannel = null;
    this.isHost = false;
    this.roomCode = null;
    this.connected = false;

    this.onStatusChange = onStatusChange || (() => {});
    this.onPeerConnected = onPeerConnected || (() => {});
    this.onMessage = onMessage || (() => {});
    this.onPeerDisconnected = onPeerDisconnected || (() => {});
    this.onError = onError || (() => {});
  }

  /**
   * Host a new room with the given 6-char roomCode.
   */
  hostRoom(roomCode) {
    this.cleanup();
    this.isHost = true;
    this.roomCode = roomCode.toUpperCase().trim();
    const peerId = `${PEER_PREFIX}${this.roomCode}`;

    this.onStatusChange('initializing', `Creating room ${this.roomCode}...`);
    this.setupLocalBroadcastFallback(this.roomCode);

    if (typeof window.Peer === 'undefined') {
      // PeerJS CDN not loaded (e.g. offline mode); rely on local tab BroadcastChannel
      this.onStatusChange('waiting', `Waiting for opponent in room ${this.roomCode} (Local Tab Mode)...`);
      return;
    }

    try {
      this.peer = new window.Peer(peerId, {
        debug: 1,
      });

      this.peer.on('open', () => {
        this.onStatusChange('waiting', `Waiting for opponent to join ${this.roomCode}...`);
      });

      this.peer.on('connection', (conn) => {
        // Only allow 1 active opponent connection
        if (this.conn && this.conn.open) {
          conn.on('open', () => {
            conn.send({ type: 'ROOM_FULL' });
            setTimeout(() => conn.close(), 300);
          });
          return;
        }
        this.bindConnection(conn);
      });

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          this.onError(`Room code ${this.roomCode} is already in use. Try generating a new code.`);
        } else {
          console.warn('PeerJS warning/error:', err);
          this.onError(`Network notice: ${err.message || err.type}`);
        }
      });
    } catch (err) {
      this.onStatusChange('waiting', `Room ${this.roomCode} ready (Local Tab Mode)`);
    }
  }

  /**
   * Join an existing hosted room by 6-char roomCode.
   */
  joinRoom(roomCode) {
    this.cleanup();
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase().trim();
    const hostPeerId = `${PEER_PREFIX}${this.roomCode}`;

    this.onStatusChange('connecting', `Connecting to room ${this.roomCode}...`);
    this.setupLocalBroadcastFallback(this.roomCode);

    // Ping BroadcastChannel first in case the host is in another tab on the same browser
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: '__BC_JOIN_REQUEST__' });
    }

    if (typeof window.Peer === 'undefined') {
      return;
    }

    try {
      this.peer = new window.Peer({ debug: 1 });

      this.peer.on('open', () => {
        if (this.connected) return; // Already connected via BroadcastChannel
        const conn = this.peer.connect(hostPeerId, { reliable: true });
        this.bindConnection(conn);
      });

      this.peer.on('error', (err) => {
        if (this.connected) return;
        if (err.type === 'peer-unavailable') {
          this.onError(`Room "${this.roomCode}" was not found. Check the code and ensure the host tab is open.`);
        } else {
          this.onError(`Connection error: ${err.message || err.type}`);
        }
      });
    } catch (err) {
      console.warn('PeerJS join fallback:', err);
    }
  }

  bindConnection(conn) {
    this.conn = conn;

    conn.on('open', () => {
      if (this.connected) return;
      this.connected = true;
      this.onStatusChange('connected', `Connected to room ${this.roomCode}`);
      this.onPeerConnected();
    });

    conn.on('data', (data) => {
      if (data && data.type === 'ROOM_FULL') {
        this.onError('This room already has two players.');
        this.cleanup();
        return;
      }
      this.onMessage(data);
    });

    conn.on('close', () => {
      this.connected = false;
      this.onStatusChange('disconnected', 'Opponent disconnected.');
      this.onPeerDisconnected();
    });

    conn.on('error', (err) => {
      this.onError(`Connection error: ${err.message || err}`);
    });
  }

  /**
   * Sets up a local BroadcastChannel so two tabs in the same browser can also connect
   * instantaneously (even offline or behind strict firewalls).
   */
  setupLocalBroadcastFallback(roomCode) {
    if (typeof BroadcastChannel === 'undefined') return;
    this.broadcastChannel = new BroadcastChannel(`${PEER_PREFIX}${roomCode}`);
    this.broadcastChannel.onmessage = (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === '__BC_JOIN_REQUEST__' && this.isHost) {
        this.broadcastChannel.postMessage({ type: '__BC_JOIN_ACK__' });
        if (!this.connected) {
          this.connected = true;
          this.onStatusChange('connected', `Connected to room ${this.roomCode} (Local Tab)`);
          this.onPeerConnected();
        }
      } else if (msg.type === '__BC_JOIN_ACK__' && !this.isHost) {
        if (!this.connected) {
          this.connected = true;
          this.onStatusChange('connected', `Connected to room ${this.roomCode} (Local Tab)`);
          this.onPeerConnected();
        }
      } else if (msg.type === '__BC_LEAVE__') {
        this.connected = false;
        this.onStatusChange('disconnected', 'Opponent left the room.');
        this.onPeerDisconnected();
      } else if (msg.type === '__BC_DATA__') {
        // Avoid duplicate delivery if PeerJS DataChannel is already open
        if (!this.conn || !this.conn.open) {
          this.onMessage(msg.payload);
        }
      }
    };
  }

  send(payload) {
    if (this.conn && this.conn.open) {
      this.conn.send(payload);
    } else if (this.broadcastChannel && this.connected) {
      this.broadcastChannel.postMessage({ type: '__BC_DATA__', payload });
    }
  }

  cleanup() {
    this.connected = false;
    if (this.conn) {
      try {
        this.conn.close();
      } catch (_) {}
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (_) {}
      this.peer = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: '__BC_LEAVE__' });
        this.broadcastChannel.close();
      } catch (_) {}
      this.broadcastChannel = null;
    }
  }
}
