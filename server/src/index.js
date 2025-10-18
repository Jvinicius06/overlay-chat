import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './utils/config.js';
import logger from './utils/logger.js';
import { TwitchClient } from './twitch/client.js';
import { MergedCircularBuffer } from './buffer/mergedBuffer.js';
import { SSEManager } from './api/sse.js';
import { setupRoutes } from './api/routes.js';
import { getChannelColor } from './merger/channelColors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main application
 */
class OverlayChatServer {
  constructor() {
    this.fastify = null;
    this.twitchClient = null;
    this.messageBuffer = null;
    this.sseManager = null;
    this.channelColors = new Map();
  }

  /**
   * Initialize the server
   */
  async init() {
    logger.info('Starting Overlay Chat Server...');
    logger.info(`Environment: ${config.server.env}`);
    logger.info(`Channels to monitor: ${config.twitch.channels.join(', ')}`);

    // Initialize Fastify
    this.fastify = Fastify({
      logger: false, // We use our own logger
      trustProxy: true
    });

    // Register CORS
    await this.fastify.register(cors, {
      origin: '*' // Allow all origins for proprietary use
    });

    // Serve static files (built client) in production
    const publicPath = join(__dirname, '..', 'public');
    await this.fastify.register(fastifyStatic, {
      root: publicPath,
      prefix: '/'
    });
    logger.info(`Static files served from: ${publicPath}`);

    // Initialize message buffer
    this.messageBuffer = new MergedCircularBuffer(
      config.messageBuffer.maxSize,
      config.messageBuffer.ttlMs
    );
    logger.info('Message buffer initialized');

    // Initialize SSE manager
    this.sseManager = new SSEManager(this.messageBuffer, config);
    logger.info('SSE manager initialized');

    // Initialize channel colors
    config.twitch.channels.forEach(channel => {
      this.channelColors.set(channel, getChannelColor(channel));
    });

    // Initialize Twitch client
    this.twitchClient = new TwitchClient(config.twitch.channels);

    // Handle Twitch messages
    this.twitchClient.on('message', (message) => {
      this.handleTwitchMessage(message);
    });

    // Handle Twitch events
    this.twitchClient.on('connected', () => {
      logger.info('Twitch client connected');
    });

    this.twitchClient.on('disconnected', () => {
      logger.warn('Twitch client disconnected');
    });

    this.twitchClient.on('error', (error) => {
      logger.error({ error }, 'Twitch client error');
    });

    // Setup API routes
    setupRoutes(this.fastify, {
      twitchClient: this.twitchClient,
      messageBuffer: this.messageBuffer,
      sseManager: this.sseManager,
      channelColors: this.channelColors
    });

    // Connect to Twitch
    this.twitchClient.connect();

    // Start HTTP server
    await this.fastify.listen({
      port: config.server.port,
      host: config.server.host
    });

    logger.info(`Server listening on http://${config.server.host}:${config.server.port}`);
    logger.info(`SSE endpoint: http://localhost:${config.server.port}/api/chat/stream`);
  }

  /**
   * Handle incoming Twitch message
   * @param {Object} message - Parsed Twitch message
   */
  handleTwitchMessage(message) {
    // Get channel color
    const channelColor = this.channelColors.get(message.channel) || getChannelColor(message.channel);

    // Create unified message object with ID
    const unifiedMessage = {
      id: `${message.timestamp}-${message.channel}-${this.generateRandomId()}`,
      channel: message.channel,
      channelColor,
      ...message
    };

    // Add to buffer
    this.messageBuffer.add(unifiedMessage);

    // Broadcast to all SSE clients
    this.sseManager.broadcast(unifiedMessage);

    logger.debug({
      channel: message.channel,
      user: message.username,
      message: message.message
    }, 'Message processed');
  }

  /**
   * Generate random ID
   * @returns {string}
   */
  generateRandomId() {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down server...');

    if (this.twitchClient) {
      this.twitchClient.disconnect();
    }

    if (this.fastify) {
      await this.fastify.close();
    }

    logger.info('Server shut down');
    process.exit(0);
  }
}

// Create and start server
const server = new OverlayChatServer();

// Handle shutdown signals
process.on('SIGINT', () => server.shutdown());
process.on('SIGTERM', () => server.shutdown());

// Start server
server.init().catch(err => {
  logger.error({ error: err }, 'Failed to start server');
  process.exit(1);
});
