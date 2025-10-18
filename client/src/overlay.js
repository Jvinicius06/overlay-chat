import { SSEClient } from './services/sseClient.js';
import { MessageStore } from './utils/messageStore.js';
import { createOverlayMessage } from './utils/chatRenderer.js';
import { config } from './config.js';
import './styles/overlay.css';

const SERVER_URL = config.apiUrl;
const MAX_MESSAGES = 20; // Show last 20 messages in overlay

class OverlayChat {
  constructor() {
    this.messageStore = new MessageStore(MAX_MESSAGES);
    this.container = null;
    this.statusEl = null;
    this.sseClient = null;
  }

  /**
   * Initialize overlay
   */
  init() {
    console.log('[Overlay] Initializing...');

    // Set body class
    document.body.classList.add('overlay-mode');

    // Create UI
    this.createUI();

    // Subscribe to message store changes
    this.messageStore.subscribe((messages) => {
      this.renderMessages(messages);
    });

    // Connect to SSE
    this.connectSSE();

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[Overlay] Page hidden');
      } else {
        console.log('[Overlay] Page visible');
        // Reconnect if needed
        if (!this.sseClient.isConnected()) {
          this.sseClient.connect();
        }
      }
    });

    // Handle online/offline
    window.addEventListener('online', () => {
      console.log('[Overlay] Network online');
      this.updateStatus('connected');
      if (!this.sseClient.isConnected()) {
        this.sseClient.connect();
      }
    });

    window.addEventListener('offline', () => {
      console.log('[Overlay] Network offline');
      this.updateStatus('disconnected');
    });
  }

  /**
   * Create UI elements
   */
  createUI() {
    // Create main container
    const app = document.createElement('div');
    app.className = 'chat-overlay';

    // Create messages container
    this.container = document.createElement('div');
    this.container.className = 'messages-container';
    app.appendChild(this.container);

    // Create status indicator
    this.statusEl = document.createElement('div');
    this.statusEl.className = 'connection-status disconnected';
    this.statusEl.innerHTML = `
      <span class="status-dot disconnected"></span>
      <span>Connecting...</span>
    `;
    app.appendChild(this.statusEl);

    document.body.appendChild(app);
  }

  /**
   * Connect to SSE stream
   */
  connectSSE() {
    this.sseClient = new SSEClient(`${SERVER_URL}/api/chat/stream`, {
      onMessage: (message) => {
        console.log('[Overlay] Message received:', message);
        this.messageStore.addMessage(message);
        // Auto-scroll is handled in renderMessages()
      },

      onHeartbeat: (data) => {
        console.log('[Overlay] Heartbeat:', data);
      },

      onConnected: () => {
        console.log('[Overlay] Connected to SSE');
        this.updateStatus('connected');
      },

      onDisconnected: () => {
        console.log('[Overlay] Disconnected from SSE');
        this.updateStatus('reconnecting');
      },

      onError: (error) => {
        console.error('[Overlay] Error:', error);
        this.updateStatus('disconnected');
      }
    });

    this.sseClient.connect();
  }

  /**
   * Update connection status
   */
  updateStatus(status) {
    this.statusEl.className = `connection-status ${status}`;

    const dot = this.statusEl.querySelector('.status-dot');
    dot.className = `status-dot ${status}`;

    const text = this.statusEl.querySelector('span:last-child');
    switch (status) {
      case 'connected':
        text.textContent = 'Live';
        break;
      case 'reconnecting':
        text.textContent = 'Reconnecting...';
        break;
      case 'disconnected':
        text.textContent = 'Disconnected';
        break;
    }
  }

  /**
   * Render messages to the UI
   */
  renderMessages(messages) {
    // Store current scroll position before rendering
    const previousScrollHeight = this.container.scrollHeight;
    const previousScrollTop = this.container.scrollTop;

    // Clear container
    this.container.innerHTML = '';

    // Render each message
    messages.forEach(message => {
      const messageEl = createOverlayMessage(message);
      this.container.appendChild(messageEl);
    });

    // Calculate new dimensions
    const newScrollHeight = this.container.scrollHeight;
    const scrollDifference = newScrollHeight - previousScrollHeight;

    if (this.autoScroll) {
      // Auto-scroll mode: stay at bottom (latest messages)
      this.scrollToLatestInstant();
    } else {
      // Manual mode: adjust scroll to keep same message visible
      // This compensates both for new messages AND removed messages
      this.container.scrollTop = previousScrollTop + scrollDifference;
    }

    // Update button visibility after render
    this.updateScrollButton();
  }

  /**
   * Handle scroll events
   */
  handleScroll() {
    // If user manually scrolled away from bottom, disable auto-scroll
    if (!this.isAtBottom()) {
      this.autoScroll = false;
    }

    // Update button visibility
    this.updateScrollButton();
  }

  /**
   * Check if scroll is at bottom (latest messages)
   */
  isAtBottom() {
    const { scrollTop, scrollHeight, clientHeight } = this.container;
    const scrollBottom = scrollHeight + scrollTop - clientHeight;
    return Math.abs(scrollBottom) < 50;
  }

  /**
   * Update scroll button visibility
   */
  updateScrollButton() {
    if (this.isAtBottom()) {
      this.scrollButton.classList.add('hidden');
    } else {
      this.scrollButton.classList.remove('hidden');
    }
  }

  /**
   * Scroll to latest messages (bottom in reversed layout) - smooth
   */
  scrollToLatest() {
    this.container.scrollTo({
      top: this.container.scrollHeight - this.container.clientHeight,
      behavior: 'smooth'
    });
    this.autoScroll = true;
    this.updateScrollButton();
  }

  /**
   * Scroll to latest messages - instant (no animation)
   */
  scrollToLatestInstant() {
    this.container.scrollTop = this.container.scrollHeight - this.container.clientHeight;
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  const overlay = new OverlayChat();
  overlay.init();
});
