/**
 * FogChess Real-Time WebSocket Room Networking (v3)
 *
 * Uses parallel Secure WebSockets (MQTT-over-WSS) across port 443 and 8084/8884 brokers
 * with automatic message deduplication so laptop <-> phone connections work even when
 * mobile carriers restrict non-443 ports.
 */

const TOPIC_PREFIX = 'fogchess/v1/room/';

// Connect to multiple public WSS brokers in parallel (includes port 443 for strict mobile networks).
// Since both clients connect to all reachable brokers and deduplicate by `msgId`,
// any single common reachable broker bridges the laptop and phone!
const WSS_BROKERS = [
  'wss://mqtt.eclipseprojects.io:443/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function randomId(prefix = 'p') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export class RoomNetwork {
  constructor({ onStatusChange, onPeerConnected, onMessage, onPeerDisconnected, onError }) {
    this.clientId = randomId('player');
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
    this.cleanup();
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
   * Join an existing hosted room by 6-char roomCode.
   */
  joinRoom(roomCode) {
    this.cleanup();
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase().trim();

    this.onStatusChange('connecting', `Joining room ${this.roomCode}...`);
    this.setupLocalBroadcastChannel();

    // Also ping local BroadcastChannel for instant same-browser 2-tab testing
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
        this.onError(
          `Could not find host in room "${this.roomCode}". Check the code and ensure the host screen is open.`
        );
        this.onStatusChange('disconnected', `Room ${this.roomCode} not found`);
      }
    }, 9500);
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
                // Newly connected secondary broker: immediately send a join request on it too!
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

    // Deduplicate packets received across multiple brokers / BroadcastChannel
    if (packet.msgId) {
      if (this.seenMsgIds.has(packet.msgId)) return;
      this.seenMsgIds.add(packet.msgId);
    }

    // If packet is addressed to a specific peer, ignore if not for us
    if (packet.targetId && packet.targetId !== this.clientId) return;

    switch (packet.type) {
      case '__JOIN_REQUEST__': {
        if (!this.isHost) return;
        if (this.connected && this.opponentId && this.opponentId !== packet.senderId) {
          this.publishRaw({
            type: '__ROOM_FULL__',
            targetId: packet.senderId,
          });
          return;
        }

        const isNewConnection = !this.connected || this.opponentId !== packet.senderId;
        this.opponentId = packet.senderId;
        this.connected = true;

        this.publishRaw({
          type: '__JOIN_ACK__',
          targetId: packet.senderId,
        });

        if (isNewConnection) {
          this.onStatusChange('connected', `Connected to room ${this.roomCode}`);
          this.onPeerConnected();
        }
        break;
      }

      case '__JOIN_ACK__': {
        if (this.isHost || this.connected) return;
        this.opponentId = packet.senderId;
        this.connected = true;
        clearInterval(this.joinRetryTimer);
        clearTimeout(this.joinTimeoutTimer);

        this.onStatusChange('connected', `Connected to room ${this.roomCode}`);
        this.onPeerConnected();
        break;
      }

      case '__ROOM_FULL__': {
        if (this.isHost || this.connected) return;
        clearInterval(this.joinRetryTimer);
        clearTimeout(this.joinTimeoutTimer);
        this.onError(`Room ${this.roomCode} already has two players.`);
        this.cleanup();
        break;
      }

      case '__PEER_LEAVE__': {
        if (this.opponentId && packet.senderId !== this.opponentId) return;
        this.connected = false;
        this.opponentId = null;
        this.onStatusChange('disconnected', 'Opponent left the room.');
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

  cleanup() {
    if (this.connected && this.roomCode) {
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
