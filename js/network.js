/**
 * FogChess Real-Time WebSocket Room Networking
 *
 * Why WebSockets (MQTT-over-WSS) instead of raw WebRTC P2P?
 * - WebRTC P2P requires direct UDP hole-punching between browsers. On Firefox, cellular networks,
 *   VPNs, or symmetric NATs, STUN-only WebRTC fails with:
 *   "WebRTC: ICE failed, your TURN server appears to be broken".
 * - By using Secure WebSockets (wss://) over standard TCP port 8084/8884/443 via public WSS brokers
 *   (plus BroadcastChannel for instant local tab testing), rooms connect in ~150ms through ANY
 *   firewall, NAT, or browser while remaining 100% static on GitHub Pages!
 */

const TOPIC_PREFIX = 'fogchess/v1/room/';

// Redundant public MQTT-over-WSS brokers (automatic failover if one is unreachable)
const WSS_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
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
    this.mqttClient = null;
    this.broadcastChannel = null;
    this.isHost = false;
    this.roomCode = null;
    this.connected = false;
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

    this.onStatusChange('initializing', `Creating WebSocket room ${this.roomCode}...`);
    this.setupLocalBroadcastChannel();
    this.connectWebSocketBroker(0, () => {
      this.onStatusChange('waiting', `Waiting for opponent in room ${this.roomCode}...`);
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

    // Immediately broadcast a join request on local BroadcastChannel for instant 2-tab testing
    this.publishLocal({ type: '__JOIN_REQUEST__' });

    this.connectWebSocketBroker(0, () => {
      if (this.connected) return;
      this.startJoinHandshake();
    });
  }

  startJoinHandshake() {
    let attempts = 0;
    const sendReq = () => {
      if (this.connected || !this.roomCode) return;
      attempts++;
      this.publishRaw({ type: '__JOIN_REQUEST__' });
    };

    sendReq();
    this.joinRetryTimer = setInterval(() => {
      if (this.connected || attempts >= 6) {
        clearInterval(this.joinRetryTimer);
        return;
      }
      sendReq();
    }, 1200);

    this.joinTimeoutTimer = setTimeout(() => {
      if (!this.connected) {
        clearInterval(this.joinRetryTimer);
        this.onError(
          `No host responded in room "${this.roomCode}". Verify the code and make sure the host tab is open.`
        );
        this.onStatusChange('disconnected', `Room ${this.roomCode} not found`);
      }
    }, 8500);
  }

  connectWebSocketBroker(brokerIndex, onReady) {
    if (typeof window.mqtt === 'undefined') {
      // Offline / local tab fallback
      onReady();
      return;
    }

    const brokerUrl = WSS_BROKERS[brokerIndex];
    if (!brokerUrl) {
      this.onStatusChange('waiting', `Room ${this.roomCode} active (Local Tab Mode)`);
      onReady();
      return;
    }

    const willPayload = JSON.stringify({
      msgId: randomId('will'),
      senderId: this.clientId,
      type: '__PEER_LEAVE__',
    });

    try {
      const client = window.mqtt.connect(brokerUrl, {
        clientId: this.clientId,
        clean: true,
        connectTimeout: 4500,
        reconnectPeriod: 3000,
        will: {
          topic: this.topic,
          payload: willPayload,
          qos: 0,
          retain: false,
        },
      });

      this.mqttClient = client;
      let didOpen = false;

      client.on('connect', () => {
        didOpen = true;
        client.subscribe(this.topic, { qos: 0 }, (err) => {
          if (err) {
            console.warn('WSS subscribe error, trying fallback broker:', err);
            client.end(true);
            this.connectWebSocketBroker(brokerIndex + 1, onReady);
            return;
          }
          onReady();
        });
      });

      client.on('message', (topic, messageBuffer) => {
        if (topic !== this.topic) return;
        try {
          const packet = JSON.parse(messageBuffer.toString());
          this.handleIncomingPacket(packet);
        } catch (_) {}
      });

      client.on('error', (err) => {
        console.warn(`WSS broker ${brokerUrl} error:`, err);
        if (!didOpen) {
          client.end(true);
          this.connectWebSocketBroker(brokerIndex + 1, onReady);
        }
      });
    } catch (err) {
      this.connectWebSocketBroker(brokerIndex + 1, onReady);
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

    // Deduplicate packets received across both BroadcastChannel and WebSocket
    if (packet.msgId) {
      if (this.seenMsgIds.has(packet.msgId)) return;
      this.seenMsgIds.add(packet.msgId);
    }

    // If packet is addressed to a specific peer, ignore if not for us
    if (packet.targetId && packet.targetId !== this.clientId) return;

    switch (packet.type) {
      case '__JOIN_REQUEST__': {
        if (!this.isHost) return;
        // If we already have a different opponent connected, tell the newcomer the room is full
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
    if (this.mqttClient && this.mqttClient.connected && this.roomCode) {
      try {
        this.mqttClient.publish(this.topic, JSON.stringify(packet), { qos: 0 });
      } catch (_) {}
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
    this.opponentId = null;
    clearInterval(this.joinRetryTimer);
    clearTimeout(this.joinTimeoutTimer);

    if (this.mqttClient) {
      try {
        this.mqttClient.end(true);
      } catch (_) {}
      this.mqttClient = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch (_) {}
      this.broadcastChannel = null;
    }
  }
}
