import { SSEClient } from './services/sseClient.js';
import { MessageStore } from './utils/messageStore.js';
import { createMobileMessage } from './utils/chatRenderer.js';
import { config } from './config.js';
import './styles/mobile.css';

const SERVER_URL = config.apiUrl;
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
    this.isSyncing = false; // Track if currently syncing missed messages
    this.SEQUENCE_STORAGE_KEY = 'mobile_last_sequence'; // LocalStorage key

    // Audio controls
    this.currentAudio = null; // Currently playing audio
    this.lastAudioData = null; // Last audio data for replay
    this.audioQueue = []; // Queue of audio to play
    this.isPlayingAudio = false; // Flag to track if audio is currently playing
    this.skipButtonEl = null; // Skip/Next button (shows queue size)
    this.replayButtonEl = null; // Replay button (always visible)
    this.audioUnlocked = false; // Flag to track if audio context is unlocked
    this.audioMonitorInterval = null; // Interval to monitor audio playback
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

    // Create audio controls
    this.createAudioControls();

    // Load LivePix audio (via server-side Puppeteer capture)
    this.loadLivePixAudio();

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
   * Load LivePix audio via SSE (server-side Puppeteer capture)
   */
  async loadLivePixAudio() {
    try {
      const response = await fetch(`${SERVER_URL}/api/livepix/urls`);
      const data = await response.json();

      if (data.enabled && data.urls && data.urls.length > 0) {
        console.log(`[Mobile] LivePix audio enabled (${data.count} source(s))`);

        // Create audio unlock button (required for mobile browsers)
        this.createAudioUnlockButton();

        // Connect to audio SSE stream
        this.connectAudioStream();

        console.log(`[Mobile] Audio stream connection initiated`);
      } else {
        console.log('[Mobile] LivePix not configured (LIVEPIX_URLS not set in .env)');
      }
    } catch (error) {
      console.error('[Mobile] Failed to initialize audio:', error);
    }
  }

  /**
   * Connect to audio SSE stream
   */
  connectAudioStream() {
    try {
      this.audioSSE = new EventSource(`${SERVER_URL}/api/audio/stream`);

      this.audioSSE.addEventListener('connected', (e) => {
        const data = JSON.parse(e.data);
        console.log('[Mobile] Audio stream connected:', data);
      });

      this.audioSSE.addEventListener('audio', (e) => {
        const data = JSON.parse(e.data);
        console.log('[Mobile] Audio received:', {
          source: data.source,
          size: data.size,
          url: data.url
        });

        // Add to queue
        this.enqueueAudio(data.audio, data.contentType);
      });

      this.audioSSE.addEventListener('heartbeat', (e) => {
        const data = JSON.parse(e.data);
        console.log('[Mobile] Audio stream heartbeat:', data);
      });

      this.audioSSE.onerror = (error) => {
        console.error('[Mobile] Audio stream error:', error);
        // Auto-reconnect after 5 seconds
        setTimeout(() => {
          console.log('[Mobile] Reconnecting audio stream...');
          this.connectAudioStream();
        }, 5000);
      };

    } catch (error) {
      console.error('[Mobile] Failed to connect to audio stream:', error);
    }
  }

  /**
   * Enqueue audio for playback
   */
  enqueueAudio(base64Audio, contentType = 'audio/mpeg') {
    // Check if audio context is unlocked
    if (!this.audioUnlocked) {
      console.warn('[Mobile] ⚠️ Audio blocked - user needs to click unlock button first');
      // Save for later playback after user unlocks
      this.lastAudioData = { base64Audio, contentType };
      return;
    }

    // Add to queue
    this.audioQueue.push({ base64Audio, contentType });
    console.log(`[Mobile] Audio added to queue (queue size: ${this.audioQueue.length})`);

    // Update skip button visibility (will show "Play" button)
    this.updateSkipButton();

    // NO auto-play - user must click button to play
  }

  /**
   * Play next audio in queue
   */
  playNextInQueue() {
    // If already playing or queue is empty, do nothing
    if (this.isPlayingAudio || this.audioQueue.length === 0) {
      this.updateSkipButton(); // Update button even if not playing
      return;
    }

    // Get next audio from queue
    const audioData = this.audioQueue.shift();
    console.log(`[Mobile] Playing next audio from queue (remaining: ${this.audioQueue.length})`);

    // Play it (updateSkipButton will be called after isPlayingAudio=true)
    this.playAudioFromBase64(audioData.base64Audio, audioData.contentType);
  }

  /**
   * Play audio from base64 string
   */
  playAudioFromBase64(base64Audio, contentType = 'audio/mpeg') {
    try {
      // Mark as playing
      this.isPlayingAudio = true;

      // Stop current audio if playing
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      // Convert base64 to Blob
      const byteCharacters = atob(base64Audio);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });

      // Create object URL
      const audioUrl = URL.createObjectURL(blob);

      // Save audio data for replay
      this.lastAudioData = { base64Audio, contentType, audioUrl };

      // Create and play audio element
      const audio = new Audio(audioUrl);
      audio.volume = 1.0; // Max volume
      this.currentAudio = audio;

      // Show skip button
      this.showSkipButton();

      audio.play().then(() => {
        console.log('[Mobile] ✅ Audio playing');
        // Start monitoring audio playback (for Safari/iOS compatibility)
        this.startAudioMonitoring();
      }).catch((error) => {
        console.error('[Mobile] ❌ Failed to play audio:', error);
        this.hideSkipButton();
        this.isPlayingAudio = false;
        // Try next in queue
        this.playNextInQueue();
      });

      // Clean up when audio ends
      const handleAudioEnded = () => {
        console.log('[Mobile] Audio ended event fired');
        this.stopAudioMonitoring();
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.isPlayingAudio = false;
        this.hideSkipButton();
        console.log('[Mobile] Playing next in queue...');

        // Play next audio in queue
        this.playNextInQueue();
      };

      // Use both addEventListener and direct property (Safari compatibility)
      audio.addEventListener('ended', handleAudioEnded);
      audio.onended = handleAudioEnded;

      // Handle audio errors
      audio.addEventListener('error', (e) => {
        console.error('[Mobile] Audio error occurred:', e);
        this.stopAudioMonitoring();
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.isPlayingAudio = false;
        this.hideSkipButton();

        // Try next in queue
        this.playNextInQueue();
      });

    } catch (error) {
      console.error('[Mobile] Error playing audio:', error);
      this.isPlayingAudio = false;
      this.hideSkipButton();

      // Try next in queue
      this.playNextInQueue();
    }
  }

  /**
   * Create audio controls UI
   */
  createAudioControls() {
    // Create Skip/Next button (shows when playing or queue has items)
    this.skipButtonEl = document.createElement('button');
    this.skipButtonEl.className = 'skip-audio-btn hidden';
    this.skipButtonEl.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 4 15 12 5 20 5 4"></polygon>
        <line x1="19" y1="5" x2="19" y2="19"></line>
      </svg>
      <span class="skip-text">Skip</span>
      <span class="queue-badge hidden">0</span>
    `;
    this.skipButtonEl.addEventListener('click', () => {
      this.skipAudio();
    });
    document.body.appendChild(this.skipButtonEl);

    // Create Replay button (fixed top-right, always visible)
    this.replayButtonEl = document.createElement('button');
    this.replayButtonEl.className = 'replay-audio-btn';
    this.replayButtonEl.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="1 4 1 10 7 10"></polyline>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
      </svg>
      Replay
    `;
    this.replayButtonEl.addEventListener('click', () => {
      this.replayAudio();
    });
    document.body.appendChild(this.replayButtonEl);
  }

  /**
   * Update skip button based on playing state and queue size
   */
  updateSkipButton() {
    if (!this.skipButtonEl) return;

    const queueSize = this.audioQueue.length;
    const badge = this.skipButtonEl.querySelector('.queue-badge');
    const text = this.skipButtonEl.querySelector('.skip-text');

    // Show button if audio is playing OR queue has items
    if (this.isPlayingAudio || queueSize > 0) {
      this.skipButtonEl.classList.remove('hidden');

      // Update badge
      if (badge) {
        if (queueSize > 0) {
          badge.classList.remove('hidden');
          badge.textContent = queueSize;
        } else {
          badge.classList.add('hidden');
        }
      }

      // Update text based on state
      if (text) {
        if (this.isPlayingAudio && queueSize > 0) {
          text.textContent = 'Next';
        } else if (this.isPlayingAudio) {
          text.textContent = 'Skip';
        } else {
          text.textContent = 'Play';
        }
      }

      console.log(`[Mobile] Skip button visible (playing: ${this.isPlayingAudio}, queue: ${queueSize})`);
    } else {
      // Hide button
      this.skipButtonEl.classList.add('hidden');
      console.log('[Mobile] Skip button hidden');
    }
  }

  /**
   * Show skip button (legacy compatibility)
   */
  showSkipButton() {
    this.updateSkipButton();
  }

  /**
   * Hide skip button (legacy compatibility)
   */
  hideSkipButton() {
    this.updateSkipButton();
  }

  /**
   * Start monitoring audio playback (Safari/iOS compatibility)
   * Polls every 500ms to check if audio has ended
   */
  startAudioMonitoring() {
    // Clear any existing monitor
    this.stopAudioMonitoring();

    let checkCount = 0;
    this.audioMonitorInterval = setInterval(() => {
      checkCount++;

      if (!this.currentAudio) {
        console.log('[Mobile] Audio monitor: No current audio, stopping monitor');
        this.stopAudioMonitoring();
        return;
      }

      const duration = this.currentAudio.duration;
      const currentTime = this.currentAudio.currentTime;
      const paused = this.currentAudio.paused;
      const ended = this.currentAudio.ended;

      // Log every 10 checks (every 5 seconds)
      if (checkCount % 10 === 0) {
        console.log(`[Mobile] Audio monitor: ${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s (paused: ${paused}, ended: ${ended})`);
      }

      // Check if audio has ended
      if (ended || (duration > 0 && currentTime >= duration - 0.1)) {
        console.log('[Mobile] Audio monitor detected end, triggering cleanup...');
        this.stopAudioMonitoring();

        // Manually trigger end handling if event didn't fire
        if (this.currentAudio && this.isPlayingAudio) {
          this.currentAudio = null;
          this.isPlayingAudio = false;
          this.hideSkipButton();
          console.log('[Mobile] Audio monitor: Playing next in queue...');
          this.playNextInQueue();
        }
      }
    }, 500); // Check every 500ms

    console.log('[Mobile] Audio monitoring started');
  }

  /**
   * Stop monitoring audio playback
   */
  stopAudioMonitoring() {
    if (this.audioMonitorInterval) {
      clearInterval(this.audioMonitorInterval);
      this.audioMonitorInterval = null;
      console.log('[Mobile] Audio monitoring stopped');
    }
  }

  /**
   * Skip current audio and play next in queue
   * If no audio playing but queue has items, play next
   */
  skipAudio() {
    console.log(`[Mobile] Skip/Next clicked (playing: ${this.isPlayingAudio}, queue: ${this.audioQueue.length})`);

    // If currently playing, stop it
    if (this.currentAudio && this.isPlayingAudio) {
      console.log('[Mobile] Stopping current audio...');
      this.stopAudioMonitoring();
      this.currentAudio.pause();
      this.currentAudio = null;
      this.isPlayingAudio = false;
    }

    // Play next in queue (if available)
    if (this.audioQueue.length > 0) {
      this.playNextInQueue();
    } else {
      console.log('[Mobile] No audio in queue');
      this.updateSkipButton();
    }
  }

  /**
   * Replay last audio (add to front of queue)
   */
  replayAudio() {
    if (this.lastAudioData) {
      console.log('[Mobile] Replaying last audio (adding to front of queue)');
      // Add to front of queue
      this.audioQueue.unshift({
        base64Audio: this.lastAudioData.base64Audio,
        contentType: this.lastAudioData.contentType
      });

      // Update button to show queue
      this.updateSkipButton();

      console.log(`[Mobile] Replay added to queue (queue size: ${this.audioQueue.length}) - click Play to start`);
    } else {
      console.log('[Mobile] No audio to replay');
    }
  }

  /**
   * Create floating container for LivePix iframes
   */
  createLivePixFloatingContainer(urls) {
    const container = document.createElement('div');
    container.className = 'livepix-floating-container';
    container.id = 'livepix-container';

    // Header with controls
    const header = document.createElement('div');
    header.className = 'livepix-header';
    header.innerHTML = `
      <div class="livepix-header-title">
        <span>📺</span>
        <span>LivePix (${urls.length})</span>
      </div>
      <div class="livepix-controls">
        <button class="livepix-btn" onclick="window.toggleLivePixContainer()" title="Minimize">_</button>
        <button class="livepix-btn" onclick="window.closeLivePixContainer()" title="Close">×</button>
      </div>
    `;
    container.appendChild(header);

    // Iframe wrapper
    const iframeWrapper = document.createElement('div');
    iframeWrapper.className = 'livepix-iframe-wrapper';

    // Add all LivePix iframes with full permissions for Safari iOS
    urls.forEach((url, index) => {
      const iframe = document.createElement('iframe');
      iframe.className = 'livepix-floating-iframe';
      iframe.src = url;

      // Full permissions for Safari iOS - Allow all features
      iframe.allow = 'autoplay; camera; microphone; geolocation; payment; fullscreen; picture-in-picture; accelerometer; gyroscope; magnetometer; clipboard-read; clipboard-write; display-capture; encrypted-media; midi; screen-wake-lock; usb; web-share; xr-spatial-tracking';

      // Additional attributes for Safari iOS compatibility
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute('allowpaymentrequest', 'true');
      iframe.setAttribute('loading', 'eager');
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      iframe.setAttribute('credentialless', 'false'); // Ensure credentials are sent
      iframe.crossOrigin = 'use-credentials'; // Send cookies with iframe request

      // IMPORTANT: NO sandbox attribute - it would block everything!

      iframe.style.display = index === 0 ? 'block' : 'none'; // Only show first one
      iframeWrapper.appendChild(iframe);
      console.log(`[Mobile] LivePix iframe ${index + 1} added with full iOS permissions:`, url);
    });

    container.appendChild(iframeWrapper);

    // Make header draggable
    this.makeElementDraggable(container, header);

    document.body.appendChild(container);
    console.log('[Mobile] Floating LivePix container created');
  }

  /**
   * Make an element draggable by a handle
   */
  makeElementDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let isDragging = false;

    handle.addEventListener('touchstart', dragStart, { passive: false });
    handle.addEventListener('touchmove', dragMove, { passive: false });
    handle.addEventListener('touchend', dragEnd, { passive: false });

    function dragStart(e) {
      isDragging = true;
      e.preventDefault();

      const touch = e.touches[0];
      pos3 = touch.clientX;
      pos4 = touch.clientY;
    }

    function dragMove(e) {
      if (!isDragging) return;
      e.preventDefault();

      const touch = e.touches[0];
      pos1 = pos3 - touch.clientX;
      pos2 = pos4 - touch.clientY;
      pos3 = touch.clientX;
      pos4 = touch.clientY;

      // Get current position
      const rect = element.getBoundingClientRect();
      let newTop = rect.top - pos2;
      let newLeft = rect.left - pos1;

      // Constrain to viewport
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      newLeft = Math.max(0, Math.min(newLeft, maxX));
      newTop = Math.max(0, Math.min(newTop, maxY));

      element.style.top = newTop + 'px';
      element.style.left = newLeft + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }

    function dragEnd(e) {
      isDragging = false;
    }
  }

  /**
   * Create audio unlock button for mobile browsers
   * Mobile browsers require user interaction before playing audio
   */
  createAudioUnlockButton() {
    const button = document.createElement('button');
    button.className = 'audio-unlock-button';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
      <span>Toque para ativar áudio</span>
    `;

    button.addEventListener('click', async () => {
      console.log('[Mobile] User clicked audio unlock button');

      try {
        // Use Web Audio API to unlock audio context (more reliable than data URL)
        // This is REQUIRED on iOS/Safari before any audio can play
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();

        // Create a silent buffer and play it
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);

        console.log('[Mobile] ✅ Audio context unlocked - ready to receive audio from server');

        // Mark audio as unlocked
        this.audioUnlocked = true;

        // If there's a pending audio, add it to queue (NO auto-play)
        if (this.lastAudioData && this.lastAudioData.base64Audio) {
          console.log('[Mobile] Enqueuing pending audio...');
          this.audioQueue.push({
            base64Audio: this.lastAudioData.base64Audio,
            contentType: this.lastAudioData.contentType
          });
          // Update button to show queue with "Play" button
          this.updateSkipButton();
          console.log('[Mobile] Audio ready in queue - click Play button to start');
        }

      } catch (e) {
        console.error('[Mobile] ❌ Could not unlock audio:', e);
      }

      // Hide the button after first interaction
      button.classList.add('unlocked');
      setTimeout(() => {
        button.remove();
      }, 300);

      console.log('[Mobile] Audio unlock completed - audio from SSE will now play automatically');
    });

    document.body.appendChild(button);
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
    // Load last sequence from localStorage
    const storedSequence = localStorage.getItem(this.SEQUENCE_STORAGE_KEY);
    const lastSequence = storedSequence ? parseInt(storedSequence, 10) : null;

    this.sseClient = new SSEClient(`${SERVER_URL}/api/chat/stream`, {
      onMessage: (message) => {
        console.log('[Mobile] Message received:', message);
        this.messageStore.addMessage(message);

        // Save sequence to localStorage
        if (message.sequence !== undefined) {
          localStorage.setItem(this.SEQUENCE_STORAGE_KEY, message.sequence.toString());
        }
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
      },

      onGapDetected: (lastSeq, currentSeq) => {
        console.warn('[Mobile] Gap detected:', lastSeq, '->', currentSeq);
        this.handleGapDetected(lastSeq, currentSeq);
      }
    });

    // Set last sequence if we have one from storage
    if (lastSequence !== null) {
      this.sseClient.setLastSequence(lastSequence);
      console.log('[Mobile] Loaded last sequence from storage:', lastSequence);
    }

    this.sseClient.connect();
  }

  /**
   * Handle gap detection - fetch missed messages
   */
  async handleGapDetected(lastSeq, currentSeq) {
    if (this.isSyncing) {
      console.log('[Mobile] Already syncing, skipping duplicate gap recovery');
      return;
    }

    this.isSyncing = true;
    this.updateStatus('reconnecting'); // Show syncing status

    try {
      const missingCount = currentSeq - lastSeq - 1;
      console.log(`[Mobile] Fetching ${missingCount} missed messages (${lastSeq + 1} to ${currentSeq - 1})`);

      const response = await fetch(`${SERVER_URL}/api/messages/sync?lastSequence=${lastSeq}`);
      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        console.log(`[Mobile] Recovered ${data.messages.length} missed messages`);
        this.messageStore.addMessages(data.messages);

        // Show notification to user
        this.showSyncNotification(data.messages.length);
      } else {
        console.log('[Mobile] No missed messages to recover');
      }
    } catch (error) {
      console.error('[Mobile] Error fetching missed messages:', error);
    } finally {
      this.isSyncing = false;
      this.updateStatus('connected');
    }
  }

  /**
   * Show sync notification to user
   */
  showSyncNotification(count) {
    const notification = document.createElement('div');
    notification.className = 'sync-notification';
    notification.textContent = `✓ Recovered ${count} missed message${count > 1 ? 's' : ''}`;
    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
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

// Global functions for LivePix container controls
window.toggleLivePixContainer = function() {
  const container = document.getElementById('livepix-container');
  if (container) {
    container.classList.toggle('minimized');
    console.log('[Mobile] LivePix container toggled');
  }
};

window.closeLivePixContainer = function() {
  const container = document.getElementById('livepix-container');
  if (container) {
    container.classList.add('hidden');
    console.log('[Mobile] LivePix container closed');
  }
};

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  const mobileChat = new MobileChat();
  mobileChat.init();
});
