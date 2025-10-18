/**
 * SSE Client with automatic reconnection and gap detection
 */
export class SSEClient {
  constructor(url, options = {}) {
    this.url = url;
    this.eventSource = null;
    this.lastEventId = null;
    this.lastSequence = null; // Last sequence number received
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.reconnectTimer = null;
    this.connected = false;

    // Callbacks
    this.onMessage = options.onMessage || (() => {});
    this.onHeartbeat = options.onHeartbeat || (() => {});
    this.onConnected = options.onConnected || (() => {});
    this.onDisconnected = options.onDisconnected || (() => {});
    this.onError = options.onError || (() => {});
    this.onGapDetected = options.onGapDetected || (() => {}); // Callback when gap is detected
  }

  /**
   * Connect to SSE endpoint
   */
  connect() {
    console.log('[SSE] Connecting...');

    // Build URL with lastSequence and/or lastEventId if available
    let url = this.url;
    const params = [];

    if (this.lastSequence !== null) {
      params.push(`lastSequence=${this.lastSequence}`);
    }

    if (this.lastEventId) {
      params.push(`lastEventId=${this.lastEventId}`);
    }

    if (params.length > 0) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${params.join('&')}`;
    }

    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('open', () => {
      console.log('[SSE] Connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.onConnected();
    });

    this.eventSource.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        this.lastEventId = event.lastEventId;

        // Gap detection: check if there's a missing sequence
        if (message.sequence !== undefined) {
          if (this.lastSequence !== null) {
            const expectedSequence = this.lastSequence + 1;
            if (message.sequence > expectedSequence) {
              // Gap detected!
              const missingCount = message.sequence - expectedSequence;
              console.warn(`[SSE] Gap detected! Expected ${expectedSequence}, got ${message.sequence}. Missing ${missingCount} message(s)`);
              this.onGapDetected(this.lastSequence, message.sequence);
            }
          }
          this.lastSequence = message.sequence;
        }

        this.onMessage(message);
      } catch (err) {
        console.error('[SSE] Failed to parse message:', err);
      }
    });

    this.eventSource.addEventListener('heartbeat', (event) => {
      try {
        const data = JSON.parse(event.data);

        // Check for gaps in heartbeat (server might have progressed while we had no messages)
        if (data.currentSequence !== undefined && this.lastSequence !== null) {
          if (data.currentSequence > this.lastSequence + 1) {
            console.warn(`[SSE] Gap detected in heartbeat! Last received: ${this.lastSequence}, Server at: ${data.currentSequence}`);
            this.onGapDetected(this.lastSequence, data.currentSequence);
          }
        }

        this.onHeartbeat(data);
      } catch (err) {
        console.error('[SSE] Failed to parse heartbeat:', err);
      }
    });

    this.eventSource.addEventListener('error', (event) => {
      console.error('[SSE] Connection error');
      this.connected = false;
      this.onDisconnected();

      // Close current connection
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      // Attempt reconnection
      this.attemptReconnect();
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnection attempts reached');
      this.onError(new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from SSE
   */
  disconnect() {
    console.log('[SSE] Disconnecting...');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get last sequence number
   */
  getLastSequence() {
    return this.lastSequence;
  }

  /**
   * Set last sequence number (useful when loading from storage)
   */
  setLastSequence(sequence) {
    this.lastSequence = sequence;
  }
}
