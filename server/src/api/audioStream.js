import logger from '../utils/logger.js';

/**
 * Audio Stream Manager for SSE
 * Manages SSE connections and broadcasts audio to all connected clients
 */
export class AudioStreamManager {
  constructor() {
    this.clients = new Map(); // Map of connection ID -> { reply, lastPing }
    this.nextClientId = 1;

    // Heartbeat to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 15000); // Every 15 seconds

    logger.info('[AudioStream] Manager initialized');
  }

  /**
   * Handle new SSE connection
   */
  async handleConnection(request, reply) {
    const clientId = this.nextClientId++;

    logger.info(`[AudioStream] Client ${clientId} connected`);

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Store client
    this.clients.set(clientId, {
      reply,
      lastPing: Date.now()
    });

    // Send initial connection message
    this.sendEvent(clientId, 'connected', {
      clientId,
      timestamp: Date.now(),
      message: 'Audio stream connected'
    });

    // Handle client disconnect
    request.raw.on('close', () => {
      this.clients.delete(clientId);
      logger.info(`[AudioStream] Client ${clientId} disconnected (total: ${this.clients.size})`);
    });

    request.raw.on('error', (error) => {
      logger.error(`[AudioStream] Client ${clientId} error:`, error);
      this.clients.delete(clientId);
    });

    // Keep connection open
    return reply;
  }

  /**
   * Broadcast audio to all connected clients
   */
  broadcast(audioData) {
    if (this.clients.size === 0) {
      logger.debug('[AudioStream] No clients connected, skipping broadcast');
      return;
    }

    logger.info(`[AudioStream] Broadcasting audio to ${this.clients.size} client(s)`);

    const disconnected = [];

    for (const [clientId, client] of this.clients) {
      try {
        this.sendEvent(clientId, 'audio', audioData);
      } catch (error) {
        logger.error(`[AudioStream] Error sending to client ${clientId}:`, error);
        disconnected.push(clientId);
      }
    }

    // Remove disconnected clients
    disconnected.forEach(id => this.clients.delete(id));
  }

  /**
   * Send event to specific client
   */
  sendEvent(clientId, event, data) {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const payload = JSON.stringify(data);
    const message = `event: ${event}\ndata: ${payload}\n\n`;

    try {
      client.reply.raw.write(message);
      client.lastPing = Date.now();
    } catch (error) {
      logger.error(`[AudioStream] Failed to send to client ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }

  /**
   * Send heartbeat to all clients
   */
  sendHeartbeat() {
    const now = Date.now();
    const disconnected = [];

    for (const [clientId, client] of this.clients) {
      // Check if client is stale (no activity in 60 seconds)
      if (now - client.lastPing > 60000) {
        logger.warn(`[AudioStream] Client ${clientId} stale, removing`);
        disconnected.push(clientId);
        continue;
      }

      try {
        this.sendEvent(clientId, 'heartbeat', {
          timestamp: now,
          clients: this.clients.size
        });
      } catch (error) {
        logger.error(`[AudioStream] Heartbeat failed for client ${clientId}:`, error);
        disconnected.push(clientId);
      }
    }

    // Remove disconnected clients
    disconnected.forEach(id => this.clients.delete(id));

    if (this.clients.size > 0) {
      logger.debug(`[AudioStream] Heartbeat sent to ${this.clients.size} client(s)`);
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      clients: this.clients.size,
      uptime: process.uptime()
    };
  }

  /**
   * Shutdown manager
   */
  shutdown() {
    logger.info('[AudioStream] Shutting down...');

    // Clear interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    for (const [clientId, client] of this.clients) {
      try {
        this.sendEvent(clientId, 'shutdown', {
          message: 'Server shutting down'
        });
        client.reply.raw.end();
      } catch (error) {
        logger.error(`[AudioStream] Error closing client ${clientId}:`, error);
      }
    }

    this.clients.clear();
    logger.info('[AudioStream] Shutdown complete');
  }
}
