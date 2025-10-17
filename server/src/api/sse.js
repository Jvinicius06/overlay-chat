import logger from '../utils/logger.js';

/**
 * SSE Client Manager
 */
export class SSEManager {
  constructor(messageBuffer, config) {
    this.messageBuffer = messageBuffer;
    this.config = config;
    this.clients = new Set();
  }

  /**
   * Handle SSE connection
   * @param {Object} request - Fastify request
   * @param {Object} reply - Fastify reply
   */
  async handleConnection(request, reply) {
    const { channels, exclude, lastEventId } = request.query;

    logger.info({
      channels,
      exclude,
      lastEventId,
      ip: request.ip
    }, 'New SSE client connected');

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Create client object
    const client = {
      id: this.generateClientId(),
      reply,
      channels: channels ? channels.split(',').map(c => c.trim().toLowerCase()) : null,
      exclude: exclude ? exclude.split(',').map(c => c.trim().toLowerCase()) : null,
      lastEventId: lastEventId || null,
      connected: true
    };

    this.clients.add(client);

    // Send retry interval
    reply.raw.write(`retry: ${this.config.sse.retryMs}\n\n`);

    // Send missed messages if lastEventId is provided
    if (lastEventId) {
      this.sendMissedMessages(client);
    }

    // Start heartbeat
    const heartbeatInterval = setInterval(() => {
      if (!client.connected) {
        clearInterval(heartbeatInterval);
        return;
      }

      this.sendHeartbeat(client);
    }, this.config.sse.heartbeatInterval);

    // Handle client disconnect
    request.raw.on('close', () => {
      client.connected = false;
      this.clients.delete(client);
      clearInterval(heartbeatInterval);
      logger.info({ clientId: client.id }, 'SSE client disconnected');
    });

    request.raw.on('error', (err) => {
      logger.error({ clientId: client.id, error: err }, 'SSE client error');
      client.connected = false;
      this.clients.delete(client);
      clearInterval(heartbeatInterval);
    });
  }

  /**
   * Send missed messages to a reconnecting client
   * @param {Object} client - SSE client
   */
  sendMissedMessages(client) {
    try {
      const missedMessages = this.messageBuffer.getAfterId(client.lastEventId);
      const filteredMessages = this.filterMessages(missedMessages, client);

      logger.info({
        clientId: client.id,
        count: filteredMessages.length
      }, 'Sending missed messages');

      filteredMessages.forEach(msg => {
        this.sendMessage(client, msg);
      });
    } catch (err) {
      logger.error({ error: err }, 'Error sending missed messages');
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param {Object} message - Message object
   */
  broadcast(message) {
    this.clients.forEach(client => {
      if (!client.connected) return;

      // Apply channel filters
      if (!this.shouldSendToClient(message, client)) return;

      this.sendMessage(client, message);
    });
  }

  /**
   * Check if message should be sent to client based on filters
   * @param {Object} message - Message object
   * @param {Object} client - SSE client
   * @returns {boolean}
   */
  shouldSendToClient(message, client) {
    // If client has channel filter, check if message channel is included
    if (client.channels && !client.channels.includes(message.channel)) {
      return false;
    }

    // If client has exclude filter, check if message channel is excluded
    if (client.exclude && client.exclude.includes(message.channel)) {
      return false;
    }

    return true;
  }

  /**
   * Filter messages based on client filters
   * @param {Array} messages - Array of messages
   * @param {Object} client - SSE client
   * @returns {Array}
   */
  filterMessages(messages, client) {
    return messages.filter(msg => this.shouldSendToClient(msg, client));
  }

  /**
   * Send a message to a specific client
   * @param {Object} client - SSE client
   * @param {Object} message - Message object
   */
  sendMessage(client, message) {
    if (!client.connected) return;

    try {
      const data = JSON.stringify(message);
      client.reply.raw.write(`id: ${message.id}\n`);
      client.reply.raw.write(`event: message\n`);
      client.reply.raw.write(`data: ${data}\n\n`);
    } catch (err) {
      logger.error({ clientId: client.id, error: err }, 'Error sending message to client');
      client.connected = false;
      this.clients.delete(client);
    }
  }

  /**
   * Send heartbeat to client
   * @param {Object} client - SSE client
   */
  sendHeartbeat(client) {
    if (!client.connected) return;

    try {
      const data = JSON.stringify({
        timestamp: Date.now(),
        activeChannels: Array.from(this.messageBuffer.channelIndex.keys())
      });

      client.reply.raw.write(`event: heartbeat\n`);
      client.reply.raw.write(`data: ${data}\n\n`);
    } catch (err) {
      logger.error({ clientId: client.id, error: err }, 'Error sending heartbeat');
      client.connected = false;
      this.clients.delete(client);
    }
  }

  /**
   * Generate unique client ID
   * @returns {string}
   */
  generateClientId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get number of connected clients
   * @returns {number}
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Get stats about connected clients
   * @returns {Object}
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      clients: Array.from(this.clients).map(client => ({
        id: client.id,
        channels: client.channels,
        exclude: client.exclude,
        connected: client.connected
      }))
    };
  }
}
