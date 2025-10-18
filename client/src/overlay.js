import { SSEClient } from './services/sseClient.js';
import { MessageStore } from './utils/messageStore.js';
import { createOverlayMessage } from './utils/chatRenderer.js';
import { config } from './config.js';
import './styles/overlay.css';

const SERVER_URL = config.apiUrl;
const MAX_MESSAGES = 50; // Show last 50 messages in overlay

class OverlayChat {
  constructor() {
    this.messageStore = new MessageStore(MAX_MESSAGES);
    this.container = null;
    this.statusEl = null;
    this.sseClient = null;
    this.isSyncing = false; // Track if currently syncing missed messages
    this.SEQUENCE_STORAGE_KEY = 'overlay_last_sequence'; // LocalStorage key
    this.renderedMessageIds = new Set(); // Track which messages are already rendered
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
    // Load last sequence from localStorage
    const storedSequence = localStorage.getItem(this.SEQUENCE_STORAGE_KEY);
    const lastSequence = storedSequence ? parseInt(storedSequence, 10) : null;

    this.sseClient = new SSEClient(`${SERVER_URL}/api/chat/stream`, {
      onMessage: (message) => {
        console.log('[Overlay] Message received:', message);
        this.messageStore.addMessage(message);

        // Save sequence to localStorage
        if (message.sequence !== undefined) {
          localStorage.setItem(this.SEQUENCE_STORAGE_KEY, message.sequence.toString());
        }
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
      },

      onGapDetected: (lastSeq, currentSeq) => {
        console.warn('[Overlay] Gap detected:', lastSeq, '->', currentSeq);
        this.handleGapDetected(lastSeq, currentSeq);
      }
    });

    // Set last sequence if we have one from storage
    if (lastSequence !== null) {
      this.sseClient.setLastSequence(lastSequence);
      console.log('[Overlay] Loaded last sequence from storage:', lastSequence);
    }

    this.sseClient.connect();
  }

  /**
   * Handle gap detection - fetch missed messages
   */
  async handleGapDetected(lastSeq, currentSeq) {
    if (this.isSyncing) {
      console.log('[Overlay] Already syncing, skipping duplicate gap recovery');
      return;
    }

    this.isSyncing = true;
    this.updateStatus('reconnecting'); // Show syncing status

    try {
      const missingCount = currentSeq - lastSeq - 1;
      console.log(`[Overlay] Fetching ${missingCount} missed messages (${lastSeq + 1} to ${currentSeq - 1})`);

      const response = await fetch(`${SERVER_URL}/api/messages/sync?lastSequence=${lastSeq}`);
      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        console.log(`[Overlay] Recovered ${data.messages.length} missed messages`);
        this.messageStore.addMessages(data.messages);
      } else {
        console.log('[Overlay] No missed messages to recover');
      }
    } catch (error) {
      console.error('[Overlay] Error fetching missed messages:', error);
    } finally {
      this.isSyncing = false;
      this.updateStatus('connected');
    }
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
   * Render messages to the UI (incremental rendering)
   */
  renderMessages(messages) {
    // Get current message IDs in the DOM
    const currentMessageIds = new Set(
      Array.from(this.container.children).map(el => el.dataset.messageId)
    );

    // Remove messages that are no longer in the list
    const messageIds = new Set(messages.map(m => m.id));
    Array.from(this.container.children).forEach(el => {
      if (!messageIds.has(el.dataset.messageId)) {
        el.remove();
        this.renderedMessageIds.delete(el.dataset.messageId);
      }
    });

    // Add new messages
    let hasNewMessages = false;
    messages.forEach(message => {
      if (!this.renderedMessageIds.has(message.id)) {
        const messageEl = createOverlayMessage(message);
        messageEl.dataset.messageId = message.id;

        // Add animation class only to new messages
        messageEl.classList.add('new-message-animation');

        this.container.appendChild(messageEl);
        this.renderedMessageIds.add(message.id);
        hasNewMessages = true;

        // Remove animation class after animation completes
        setTimeout(() => {
          messageEl.classList.remove('new-message-animation');
        }, 500);
      }
    });

    // Auto-scroll to bottom if needed
    if (hasNewMessages) {
      this.scrollToLatestInstant();
    }
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
