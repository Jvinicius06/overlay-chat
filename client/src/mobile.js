import { SSEClient } from './services/sseClient.js';
import { MessageStore } from './utils/messageStore.js';
import { createMobileMessage } from './utils/chatRenderer.js';
import './styles/mobile.css';

const SERVER_URL = 'http://localhost:3000';
const RENDER_BUFFER_SIZE = 200; // Number of messages to render at once for performance

class MobileChat {
  constructor() {
    this.messageStore = new MessageStore(); // No limit - infinite history
    this.container = null;
    this.statusEl = null;
    this.channelsEl = null;
    this.messageCountEl = null;
    this.scrollButton = null;
    this.sseClient = null;
    this.autoScroll = true;
    this.activeChannels = [];
    this.renderedMessageIds = new Set(); // Track which messages are already rendered
    this.lastScrollTop = 0; // Track last scroll position to detect manual scrolling
  }

  /**
   * Initialize mobile chat
   */
  init() {
    console.log('[Mobile] Initializing...');

    // Set body class
    document.body.classList.add('mobile-mode');

    // Create UI
    this.createUI();

    // Subscribe to message store changes
    this.messageStore.subscribe((messages) => {
      this.renderMessages(messages);
      this.updateMessageCount(messages.length);
    });

    // Connect to SSE
    this.connectSSE();

    // Handle scroll to detect manual scrolling
    this.attachScrollListener();

    // Handle page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[Mobile] Page hidden');
      } else {
        console.log('[Mobile] Page visible');
        if (!this.sseClient.isConnected()) {
          this.sseClient.connect();
        }
      }
    });

    // Handle online/offline
    window.addEventListener('online', () => {
      console.log('[Mobile] Network online');
      this.updateStatus('connected');
      if (!this.sseClient.isConnected()) {
        this.sseClient.connect();
      }
    });

    window.addEventListener('offline', () => {
      console.log('[Mobile] Network offline');
      this.updateStatus('disconnected');
    });

    // Prevent zoom on double-tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  }

  /**
   * Create UI elements
   */
  createUI() {
    const app = document.createElement('div');
    app.className = 'chat-mobile';

    // Header
    const header = document.createElement('div');
    header.className = 'mobile-header';

    const title = document.createElement('h1');
    title.className = 'mobile-title';
    title.textContent = 'Twitch Chat';
    header.appendChild(title);

    this.channelsEl = document.createElement('div');
    this.channelsEl.className = 'mobile-channels';
    header.appendChild(this.channelsEl);

    app.appendChild(header);

    // Messages container
    this.container = document.createElement('div');
    this.container.className = 'mobile-messages';
    app.appendChild(this.container);

    // Status bar
    const statusBar = document.createElement('div');
    statusBar.className = 'mobile-status';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'mobile-status-indicator';
    this.statusEl.innerHTML = `
      <span class="mobile-status-dot disconnected"></span>
      <span>Connecting...</span>
    `;
    statusBar.appendChild(this.statusEl);

    this.messageCountEl = document.createElement('div');
    this.messageCountEl.className = 'mobile-message-count';
    this.messageCountEl.textContent = '0 messages';
    statusBar.appendChild(this.messageCountEl);

    app.appendChild(statusBar);

    // Scroll to bottom button
    this.scrollButton = document.createElement('button');
    this.scrollButton.className = 'scroll-to-bottom'; // Start visible for testing
    this.scrollButton.innerHTML = '↓';
    this.scrollButton.addEventListener('click', () => {
      this.scrollToBottom();
    });
    app.appendChild(this.scrollButton);

    document.body.appendChild(app);
  }

  /**
   * Connect to SSE stream
   */
  connectSSE() {
    this.sseClient = new SSEClient(`${SERVER_URL}/api/chat/stream`, {
      onMessage: (message) => {
        console.log('[Mobile] Message received:', message);
        this.messageStore.addMessage(message);
        // Auto-scroll is handled in renderMessages()
      },

      onHeartbeat: (data) => {
        console.log('[Mobile] Heartbeat:', data);
        if (data.activeChannels) {
          this.updateChannels(data.activeChannels);
        }
      },

      onConnected: () => {
        console.log('[Mobile] Connected to SSE');
        this.updateStatus('connected');
      },

      onDisconnected: () => {
        console.log('[Mobile] Disconnected from SSE');
        this.updateStatus('reconnecting');
      },

      onError: (error) => {
        console.error('[Mobile] Error:', error);
        this.updateStatus('disconnected');
      }
    });

    this.sseClient.connect();
  }

  /**
   * Attach scroll listener using polling (native events don't work)
   */
  attachScrollListener() {
    // Use polling to detect manual scroll (every 50ms)
    setInterval(() => {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      const delta = currentScroll - this.lastScrollTop;

      // Detect any scroll change
      if (delta !== 0 && Math.abs(delta) >= 1) {
        // If scrolling up while autoScroll is on, disable it immediately
        if (delta < 0 && this.autoScroll) {
          this.autoScroll = false;
          this.updateScrollButton();
        }

        this.handleScroll();
      }
    }, 50);
  }

  /**
   * Update connection status
   */
  updateStatus(status) {
    const dot = this.statusEl.querySelector('.mobile-status-dot');
    dot.className = `mobile-status-dot ${status}`;

    const text = this.statusEl.querySelector('span:last-child');
    switch (status) {
      case 'connected':
        text.textContent = 'Connected';
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
   * Update channel tags in header
   */
  updateChannels(channels) {
    this.activeChannels = channels;
    this.channelsEl.innerHTML = '';

    // Fetch channel colors
    fetch(`${SERVER_URL}/api/channels/colors`)
      .then(res => res.json())
      .then(data => {
        channels.forEach(channel => {
          const tag = document.createElement('span');
          tag.className = 'mobile-channel-tag';
          tag.textContent = `#${channel}`;
          const color = data.colors[channel] || '#888';
          tag.style.color = color;
          tag.style.borderColor = color;
          this.channelsEl.appendChild(tag);
        });
      })
      .catch(err => console.error('[Mobile] Failed to fetch channel colors:', err));
  }

  /**
   * Update message count
   */
  updateMessageCount(count) {
    this.messageCountEl.textContent = `${count} messages`;
  }

  /**
   * Render messages - Optimized incremental rendering
   */
  renderMessages(messages) {
    // Incremental rendering: Only add new messages that aren't already rendered
    let newMessagesAdded = 0;
    messages.forEach(message => {
      if (!this.renderedMessageIds.has(message.id)) {
        const messageEl = createMobileMessage(message);
        this.container.appendChild(messageEl);
        this.renderedMessageIds.add(message.id);
        newMessagesAdded++;
      }
    });

    // Auto-scroll if enabled (always follow newest messages)
    // Use requestAnimationFrame to ensure DOM is updated before scrolling
    if (this.autoScroll && newMessagesAdded > 0) {
      requestAnimationFrame(() => {
        this.scrollToBottomInstant();
      });
    }

    // Update button visibility after render
    requestAnimationFrame(() => {
      this.updateScrollButton();
    });
  }

  /**
   * Handle scroll events
   */
  handleScroll() {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Update last scroll position
    this.lastScrollTop = currentScrollTop;

    // Check if user is at bottom
    const atBottom = this.isAtBottom();

    // If user scrolled to bottom, re-enable auto-scroll
    if (atBottom && !this.autoScroll) {
      this.autoScroll = true;
    }

    // Update button visibility
    this.updateScrollButton();
  }

  /**
   * Check if scroll is at bottom (latest messages)
   */
  isAtBottom() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;

    // If all content fits on screen (no scrollbar needed), consider it at bottom
    if (scrollHeight <= clientHeight) {
      return true;
    }

    // Calculate how far from bottom we are
    const scrollBottom = scrollTop + clientHeight;
    const distanceFromBottom = scrollHeight - scrollBottom;
    return distanceFromBottom <= 50;
  }

  /**
   * Update scroll button visibility
   */
  updateScrollButton() {
    const atBottom = this.isAtBottom();
    const shouldHide = atBottom && this.autoScroll;

    // Show button if: not at bottom OR auto-scroll is disabled
    // Hide button if: at bottom AND auto-scroll is enabled
    if (shouldHide) {
      this.scrollButton.classList.add('hidden');
    } else {
      this.scrollButton.classList.remove('hidden');
    }
  }

  /**
   * Scroll to bottom - smooth (user clicked button)
   */
  scrollToBottom() {
    this.autoScroll = true;
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
    // Button will be hidden when scroll completes and handleScroll is triggered
  }

  /**
   * Scroll to bottom - instant (no animation)
   */
  scrollToBottomInstant() {
    // Only scroll if autoScroll is enabled
    if (!this.autoScroll) {
      return;
    }

    window.scrollTo(0, document.documentElement.scrollHeight);
    this.lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  const mobileChat = new MobileChat();
  mobileChat.init();
});
