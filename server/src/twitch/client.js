import WebSocket from 'ws';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import { parseMessage, isPing, getPongResponse } from './parser.js';

const TWITCH_IRC_WS = 'wss://irc-ws.chat.twitch.tv:443';

/**
 * Twitch IRC WebSocket Client (Anonymous/Read-Only)
 */
export class TwitchClient extends EventEmitter {
  constructor(channels = []) {
    super();
    this.channels = channels.map(c => c.toLowerCase());
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.reconnectTimer = null;
  }

  /**
   * Connect to Twitch IRC
   */
  connect() {
    logger.info('Connecting to Twitch IRC...');

    this.ws = new WebSocket(TWITCH_IRC_WS);

    this.ws.on('open', () => this.handleOpen());
    this.ws.on('message', (data) => this.handleMessage(data));
    this.ws.on('error', (error) => this.handleError(error));
    this.ws.on('close', () => this.handleClose());
  }

  /**
   * Handle WebSocket open
   */
  handleOpen() {
    logger.info('Connected to Twitch IRC');

    // Anonymous login (no OAuth token needed for read-only)
    this.ws.send('NICK justinfan12345');

    // Request capabilities for tags (to get user colors, badges, emotes, etc)
    this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');

    // Join channels
    this.channels.forEach(channel => {
      this.ws.send(`JOIN #${channel}`);
      logger.info(`Joining channel: #${channel}`);
    });

    this.connected = true;
    this.reconnectAttempts = 0;
    this.emit('connected');
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    const rawMessage = data.toString();
    const lines = rawMessage.split('\r\n').filter(Boolean);

    lines.forEach(line => {
      // Handle PING/PONG
      if (isPing(line)) {
        this.ws.send(getPongResponse(line));
        return;
      }

      // Parse PRIVMSG (chat messages)
      const message = parseMessage(line);
      if (message) {
        this.emit('message', message);
      }
    });
  }

  /**
   * Handle errors
   */
  handleError(error) {
    logger.error({ error }, 'Twitch WebSocket error');
    this.emit('error', error);
  }

  /**
   * Handle WebSocket close
   */
  handleClose() {
    logger.warn('Disconnected from Twitch IRC');
    this.connected = false;
    this.emit('disconnected');

    // Attempt reconnection with exponential backoff
    this.attemptReconnect();
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Giving up.');
      this.emit('reconnect-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Add a channel to monitor
   * @param {string} channel - Channel name to join
   */
  addChannel(channel) {
    channel = channel.toLowerCase();

    if (this.channels.includes(channel)) {
      logger.warn(`Channel ${channel} already being monitored`);
      return;
    }

    this.channels.push(channel);

    if (this.connected && this.ws) {
      this.ws.send(`JOIN #${channel}`);
      logger.info(`Joined channel: #${channel}`);
    }
  }

  /**
   * Remove a channel from monitoring
   * @param {string} channel - Channel name to leave
   */
  removeChannel(channel) {
    channel = channel.toLowerCase();

    const index = this.channels.indexOf(channel);
    if (index === -1) {
      logger.warn(`Channel ${channel} not found`);
      return;
    }

    this.channels.splice(index, 1);

    if (this.connected && this.ws) {
      this.ws.send(`PART #${channel}`);
      logger.info(`Left channel: #${channel}`);
    }
  }

  /**
   * Disconnect from Twitch IRC
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    logger.info('Disconnected from Twitch IRC');
  }

  /**
   * Get list of channels being monitored
   * @returns {string[]}
   */
  getChannels() {
    return [...this.channels];
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }
}
