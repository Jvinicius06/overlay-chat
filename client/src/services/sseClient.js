/**
 * SSE Client with automatic reconnection
 */
export class SSEClient {
  constructor(url, options = {}) {
    this.url = url;
    this.eventSource = null;
    this.lastEventId = null;
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
  }

  /**
   * Connect to SSE endpoint
   */
  connect() {
    console.log('[SSE] Connecting...');

    // Build URL with lastEventId if available
    let url = this.url;
    if (this.lastEventId) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}lastEventId=${this.lastEventId}`;
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
        this.onMessage(message);
      } catch (err) {
        console.error('[SSE] Failed to parse message:', err);
      }
    });

    this.eventSource.addEventListener('heartbeat', (event) => {
      try {
        const data = JSON.parse(event.data);
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
}
