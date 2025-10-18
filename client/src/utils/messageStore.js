/**
 * Simple message store for managing chat messages with sequence-aware ordering
 */
export class MessageStore {
  constructor(maxMessages = null) {
    this.maxMessages = maxMessages;
    this.messages = [];
    this.listeners = new Set();
    this.messageIds = new Set(); // Track message IDs to prevent duplicates
  }

  /**
   * Add a message to the store (with automatic ordering by sequence)
   */
  addMessage(message) {
    // Prevent duplicate messages
    if (this.messageIds.has(message.id)) {
      console.log('[MessageStore] Skipping duplicate message:', message.id);
      return;
    }

    this.messageIds.add(message.id);

    // If message has sequence number, insert in order
    if (message.sequence !== undefined) {
      this.insertBySequence(message);
    } else {
      // Fallback: just append
      this.messages.push(message);
    }

    // Keep only the last N messages (if maxMessages is set)
    if (this.maxMessages !== null && this.messages.length > this.maxMessages) {
      const removed = this.messages.slice(0, this.messages.length - this.maxMessages);
      removed.forEach(msg => this.messageIds.delete(msg.id));
      this.messages = this.messages.slice(-this.maxMessages);
    }

    this.notifyListeners();
  }

  /**
   * Insert message in correct position based on sequence number
   */
  insertBySequence(message) {
    // Find insertion point using binary search
    let left = 0;
    let right = this.messages.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.messages[mid].sequence < message.sequence) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // Insert at the correct position
    this.messages.splice(left, 0, message);
  }

  /**
   * Add multiple messages at once (bulk insert, optimized)
   */
  addMessages(messages) {
    let hasNew = false;

    messages.forEach(message => {
      if (!this.messageIds.has(message.id)) {
        this.messageIds.add(message.id);

        if (message.sequence !== undefined) {
          this.insertBySequence(message);
        } else {
          this.messages.push(message);
        }

        hasNew = true;
      }
    });

    // Keep only the last N messages (if maxMessages is set)
    if (this.maxMessages !== null && this.messages.length > this.maxMessages) {
      const removed = this.messages.slice(0, this.messages.length - this.maxMessages);
      removed.forEach(msg => this.messageIds.delete(msg.id));
      this.messages = this.messages.slice(-this.maxMessages);
    }

    if (hasNew) {
      this.notifyListeners();
    }
  }

  /**
   * Get all messages
   */
  getMessages() {
    return [...this.messages];
  }

  /**
   * Clear all messages
   */
  clear() {
    this.messages = [];
    this.messageIds.clear();
    this.notifyListeners();
  }

  /**
   * Get last sequence number in store
   */
  getLastSequence() {
    if (this.messages.length === 0) return null;
    const lastMsg = this.messages[this.messages.length - 1];
    return lastMsg.sequence !== undefined ? lastMsg.sequence : null;
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener) {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.messages));
  }
}
