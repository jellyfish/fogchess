/**
 * FogChess Real-Time WebSocket Room Networking (v5)
 *
 * Uses parallel Secure WebSockets (MQTT-over-WSS) across port 443 and 8084/8884 brokers.
 * Supports seamless reconnection & state recovery: whichever player is already in the room
 * responds to a joining/rejoining peer and syncs the live match state without wiping the game.
 */

const TOPIC_PREFIX = 'fogchess/v1/room/';

const WSS_BROKERS = [
  'wss://mqtt.eclipseprojects.io:443/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function randomId(prefix = 'p') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function getOrCreateTabClientId() {
  try {
    const existing = sessionStorage.getItem('fogchess_tab_client_id');
    if (existing) return existing;
    const created = randomId('player');
    sessionStorage.setItem('fogchess_tab_client_id', created);
    return created;
  } catch (_) {
    return randomId('player');
  }
}

export class RoomNetwork {
  constructor({ onStatusChange, onPeerConnected, onMessage, onPeerDisconnected, onError }) {
    this.clientId = getOrCreateTabClientId();
    this.opponentId = null;
    this.mqttClients = [];
    this.broadcastChannel = null;
    this.isHost = false;
    this.roomCode = null;
    this.connected = false;
    this.brokerReady = false;
    this.joinRetryTimer = null;
    this.joinTimeoutTimer = null;
    this.seenMsgIds = new Set();

    this.onStatusChange = onStatusChange || (() => {});
    this.onPeerConnected = onPeerConnected || (() => {});
    this.onMessage = onMessage || (() => {});
    this.onPeerDisconnected = onPeerDisconnected || (() => {});
    this.onError = onError || (() => {});

    window.addEventListener('beforeunload', () => {
      if (this.roomCode && this.connected) {
        this.publishRaw({ type: '__PEER_LEAVE__' });
      }
    });
  }

  get topic() {
    return `${TOPIC_PREFIX}${this.roomCode}`;
  }

  /**
   * Host a new room with the given 6-char roomCode.
   */
  hostRoom(roomCode) {
    this.cleanup(false);
    this.isHost = true;
    this.roomCode = roomCode.toUpperCase().trim();

    this.onStatusChange('initializing', `Connecting to room ${this.roomCode}...`);
    this.setupLocalBroadcastChannel();
    this.connectWebSocketPool(() => {
      if (!this.connected) {
        this.onStatusChange('waiting', `Waiting for opponent in room ${this.roomCode}...`);
      }
    });
  }

  /**
   * Join or rejoin an existing room by 6-char roomCode.
   */
  joinRoom(roomCode) {
    this.cleanup(false);
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase().trim();

    this.onStatusChange('connecting', `Joining room ${this.roomCode}...`);
    this.setupLocalBroadcastChannel();

    this.publishLocal({ type: '__JOIN_REQUEST__' });

    this.connectWebSocketPool(() => {
      if (this.connected) return;
      this.startJoinHandshake();
    });
  }

  startJoinHandshake() {
    clearInterval(this.joinRetryTimer);
    clearTimeout(this.joinTimeoutTimer);

    let attempts = 0;
    const sendReq = () => {
      if (this.connected || !this.roomCode) return;
      attempts++;
      this.publishRaw({ type: '__JOIN_REQUEST__' });
    };

    sendReq();
    this.joinRetryTimer = setInterval(() => {
      if (this.connected || attempts >= 8) {
        clearInterval(this.joinRetryTimer);
        return;
      }
      sendReq();
    }, 1000);

    this.joinTimeoutTimer = setTimeout(() => {
      if (!this.connected) {
        clearInterval(this.joinRetryTimer);
        // If no existing peer answered, promote this client to waiting room member so if the other
        // player joins/rejoins next, this client will answer them!
        this.isHost = true;
        this.onStatusChange('waiting', `Waiting for opponent in room ${this.roomCode}...`);
      }
    }, 6500);
  }

  connectWebSocketPool(onFirstBrokerReady) {
    if (typeof window.mqtt === 'undefined') {
      this.onError('WebSocket library failed to load. Please refresh the page.');
      return;
    }

    let firstReadyFired = false;
    let failedCount = 0;

    const willPayload = JSON.stringify({
      msgId: randomId('will'),
      senderId: this.clientId,
      type: '__PEER_LEAVE__',
    });

    for (const brokerUrl of WSS_BROKERS) {
      try {
        const client = window.mqtt.connect(brokerUrl, {
          clientId: `${this.clientId}_${Math.random().toString(36).slice(2, 6)}`,
          clean: true,
          connectTimeout: 5000,
          reconnectPeriod: 4000,
          will: {
            topic: this.topic,
            payload: willPayload,
            qos: 0,
            retain: false,
          },
        });

        this.mqttClients.push(client);

        client.on('connect', () => {
          if (!this.roomCode) return;
          client.subscribe(this.topic, { qos: 0 }, (err) => {
            if (!err) {
              this.brokerReady = true;
              if (!firstReadyFired) {
                firstReadyFired = true;
                onFirstBrokerReady();
              } else if (!this.isHost && !this.connected) {
                this.publishRaw({ type: '__JOIN_REQUEST__' });
              }
            }
          });
        });

        client.on('message', (topic, messageBuffer) => {
          if (topic !== this.topic) return;
          try {
            const packet = JSON.parse(messageBuffer.toString());
            this.handleIncomingPacket(packet);
          } catch (_) {}
        });

        client.on('error', () => {
          failedCount++;
          if (failedCount >= WSS_BROKERS.length && !this.brokerReady) {
            this.onError('Unable to reach WebSocket relay servers. Check your network connection.');
          }
        });
      } catch (_) {
        failedCount++;
      }
    }
  }

  setupLocalBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined' || !this.roomCode) return;
    this.broadcastChannel = new BroadcastChannel(this.topic);
    this.broadcastChannel.onmessage = (event) => {
      if (event.data) {
        this.handleIncomingPacket(event.data);
      }
    };
  }

  handleIncomingPacket(packet) {
    if (!packet || !packet.senderId || packet.senderId === this.clientId) return;

    if (packet.msgId) {
      if (this.seenMsgIds.has(packet.msgId)) return;
      this.seenMsgIds.add(packet.msgId);
    }

    if (packet.targetId && packet.targetId !== this.clientId) return;

    switch (packet.type) {
      case '__JOIN_REQUEST__': {
        // Any established peer in the room (whether original host or remaining player after a drop)
        // can accept a joining/rejoining opponent and sync state!
        const isReconnectOrNew = !this.connected || this.opponentId !== packet.senderId;
        this.opponentId = packet.senderId;
        this.connected = true;
        clearInterval(this.joinRetryTimer);
        clearTimeout(this.joinTimeoutTimer);

        this.publishRaw({
          type: '__JOIN_ACK__',
          targetId: packet.senderId,
        });

        if (isReconnectOrNew) {
          this.onStatusChange('connected', `Connected to room ${this.roomCode}`);
          this.onPeerConnected({ isResponder: true });
        }
        break;
      }

      case '__JOIN_ACK__': {
        const isNewAck = !this.connected || this.opponentId !== packet.senderId;
        this.opponentId = packet.senderId;
        this.connected = true;
        clearInterval(this.joinRetryTimer);
        clearTimeout(this.joinTimeoutTimer);

        if (isNewAck) {
          this.onStatusChange('connected', `Connected to room ${this.roomCode}`);
          this.onPeerConnected({ isResponder: false });
        }
        break;
      }

      case '__PEER_LEAVE__': {
        if (this.opponentId && packet.senderId !== this.opponentId) return;
        this.connected = false;
        this.opponentId = null;
        this.onStatusChange('waiting', `Opponent disconnected — waiting for rejoin in ${this.roomCode}...`);
        this.onPeerDisconnected();
        break;
      }

      case '__APP_MSG__': {
        if (this.opponentId && packet.senderId !== this.opponentId) return;
        this.onMessage(packet.payload);
        break;
      }
    }
  }

  publishLocal(fields) {
    const packet = {
      msgId: randomId('m'),
      senderId: this.clientId,
      ...fields,
    };
    this.seenMsgIds.add(packet.msgId);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch (_) {}
    }
    return packet;
  }

  publishRaw(fields) {
    const packet = this.publishLocal(fields);
    if (!this.roomCode) return;
    const serialized = JSON.stringify(packet);

    for (const client of this.mqttClients) {
      if (client && client.connected) {
        try {
          client.publish(this.topic, serialized, { qos: 0 });
        } catch (_) {}
      }
    }
  }

  send(payload) {
    if (!this.connected) return;
    this.publishRaw({
      type: '__APP_MSG__',
      targetId: this.opponentId,
      payload,
    });
  }

  cleanup(notifyLeave = true) {
    if (notifyLeave && this.connected && this.roomCode) {
      this.publishRaw({ type: '__PEER_LEAVE__' });
    }
    this.connected = false;
    this.brokerReady = false;
    this.opponentId = null;
    clearInterval(this.joinRetryTimer);
    clearTimeout(this.joinTimeoutTimer);

    for (const client of this.mqttClients) {
      try {
        client.end(true);
      } catch (_) {}
    }
    this.mqttClients = [];

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch (_) {}
      this.broadcastChannel = null;
    }
  }
}
