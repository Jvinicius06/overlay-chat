import logger from '../utils/logger.js';

/**
 * Unified circular buffer for messages from multiple channels
 */
export class MergedCircularBuffer {
  constructor(maxSize = 1000, ttlMs = 600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.messages = [];
    this.channelIndex = new Map(); // channel -> array of indices
  }

  /**
   * Add a message to the buffer
   * @param {Object} message - Message object
   */
  add(message) {
    // Remove old messages based on TTL
    this.cleanup();

    // If buffer is full, remove oldest message
    if (this.messages.length >= this.maxSize) {
      this.removeOldest();
    }

    // Add message to buffer
    this.messages.push(message);
    const index = this.messages.length - 1;

    // Update channel index
    if (!this.channelIndex.has(message.channel)) {
      this.channelIndex.set(message.channel, []);
    }
    this.channelIndex.get(message.channel).push(index);

    logger.debug(`Added message to buffer: ${message.channel} - ${message.username}: ${message.message}`);
  }

  /**
   * Remove oldest message from buffer
   */
  removeOldest() {
    if (this.messages.length === 0) return;

    const removed = this.messages.shift();

    // Rebuild channel index (decrement all indices)
    this.rebuildChannelIndex();

    logger.debug(`Removed oldest message: ${removed.channel} - ${removed.username}`);
  }

  /**
   * Clean up expired messages based on TTL
   */
  cleanup() {
    const now = Date.now();
    const expiredThreshold = now - this.ttlMs;

    const originalLength = this.messages.length;

    // Remove messages older than TTL
    this.messages = this.messages.filter(msg => msg.timestamp > expiredThreshold);

    if (this.messages.length < originalLength) {
      this.rebuildChannelIndex();
      logger.debug(`Cleaned up ${originalLength - this.messages.length} expired messages`);
    }
  }

  /**
   * Rebuild channel index after removals
   */
  rebuildChannelIndex() {
    this.channelIndex.clear();

    this.messages.forEach((msg, index) => {
      if (!this.channelIndex.has(msg.channel)) {
        this.channelIndex.set(msg.channel, []);
      }
      this.channelIndex.get(msg.channel).push(index);
    });
  }

  /**
   * Get all messages (chronologically ordered)
   * @returns {Array}
   */
  getAll() {
    return [...this.messages];
  }

  /**
   * Get messages from a specific channel
   * @param {string} channel - Channel name
   * @returns {Array}
   */
  getByChannel(channel) {
    const indices = this.channelIndex.get(channel) || [];
    return indices.map(i => this.messages[i]).filter(Boolean);
  }

  /**
   * Get messages after a specific timestamp
   * @param {number} timestamp - Unix timestamp in ms
   * @returns {Array}
   */
  getAfterTimestamp(timestamp) {
    return this.messages.filter(msg => msg.timestamp > timestamp);
  }

  /**
   * Get messages after a specific ID
   * @param {string} lastId - Last event ID
   * @returns {Array}
   */
  getAfterId(lastId) {
    if (!lastId) return this.getAll();

    // Extract timestamp from ID (format: timestamp-channel-random)
    const parts = lastId.split('-');
    const timestamp = parseInt(parts[0], 10);

    if (isNaN(timestamp)) return this.getAll();

    // Return messages after this timestamp
    // Note: might include the same message if timestamps collide
    return this.messages.filter(msg => msg.timestamp >= timestamp && msg.id !== lastId);
  }

  /**
   * Get messages after a specific sequence number
   * @param {number} sequence - Last sequence number
   * @returns {Array}
   */
  getAfterSequence(sequence) {
    if (!sequence || isNaN(sequence)) return this.getAll();
    return this.messages.filter(msg => msg.sequence > sequence);
  }

  /**
   * Get messages within a sequence range (inclusive)
   * @param {number} fromSeq - Start sequence (inclusive)
   * @param {number} toSeq - End sequence (inclusive)
   * @returns {Array}
   */
  getBySequenceRange(fromSeq, toSeq) {
    if (isNaN(fromSeq) || isNaN(toSeq)) return [];
    return this.messages.filter(msg => msg.sequence >= fromSeq && msg.sequence <= toSeq);
  }

  /**
   * Get current sequence number (highest in buffer)
   * @returns {number}
   */
  getCurrentSequence() {
    if (this.messages.length === 0) return 0;
    // Get the highest sequence number in the buffer
    return Math.max(...this.messages.map(msg => msg.sequence || 0));
  }

  /**
   * Get filtered messages by channel list
   * @param {string[]} channels - Array of channel names to include
   * @returns {Array}
   */
  getFiltered(channels) {
    if (!channels || channels.length === 0) {
      return this.getAll();
    }

    const channelSet = new Set(channels.map(c => c.toLowerCase()));
    return this.messages.filter(msg => channelSet.has(msg.channel));
  }

  /**
   * Get messages excluding specific channels
   * @param {string[]} excludeChannels - Array of channel names to exclude
   * @returns {Array}
   */
  getExcluding(excludeChannels) {
    if (!excludeChannels || excludeChannels.length === 0) {
      return this.getAll();
    }

    const excludeSet = new Set(excludeChannels.map(c => c.toLowerCase()));
    return this.messages.filter(msg => !excludeSet.has(msg.channel));
  }

  /**
   * Get buffer stats
   * @returns {Object}
   */
  getStats() {
    const stats = {
      totalMessages: this.messages.length,
      maxSize: this.maxSize,
      currentSequence: this.getCurrentSequence(),
      channels: {}
    };

    this.channelIndex.forEach((indices, channel) => {
      stats.channels[channel] = indices.length;
    });

    return stats;
  }

  /**
   * Clear all messages
   */
  clear() {
    this.messages = [];
    this.channelIndex.clear();
    logger.info('Buffer cleared');
  }
}
