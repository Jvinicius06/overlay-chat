/**
 * Simple message store for managing chat messages
 */
export class MessageStore {
  constructor(maxMessages = null) {
    this.maxMessages = maxMessages;
    this.messages = [];
    this.listeners = new Set();
  }

  /**
   * Add a message to the store
   */
  addMessage(message) {
    this.messages.push(message);

    // Keep only the last N messages (if maxMessages is set)
    if (this.maxMessages !== null && this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    this.notifyListeners();
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
    this.notifyListeners();
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
