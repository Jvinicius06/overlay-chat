import puppeteer from 'puppeteer';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

/**
 * LivePix Audio Capture using Puppeteer
 * Opens LivePix URLs in headless browser and captures audio when it plays
 */
export class LivePixAudioCapture extends EventEmitter {
  constructor(urls = []) {
    super();
    this.urls = urls;
    this.browser = null;
    this.pages = [];
    this.isRunning = false;
    this.audioCache = new Map(); // Cache para evitar duplicatas
    this.reloadTimers = new Map(); // Timers para reload de páginas
  }

  /**
   * Start audio capture
   */
  async start() {
    if (this.isRunning) {
      logger.warn('[AudioCapture] Already running');
      return;
    }

    if (!this.urls || this.urls.length === 0) {
      logger.warn('[AudioCapture] No LivePix URLs configured, skipping audio capture');
      return;
    }

    try {
      logger.info('[AudioCapture] Starting Puppeteer browser...');

      // Launch browser with minimal resources
      this.browser = await puppeteer.launch({
        headless: true, // Run without UI
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--mute-audio', // Mute browser audio (we're capturing, not playing)
          '--autoplay-policy=no-user-gesture-required' // Allow autoplay
        ]
      });

      logger.info(`[AudioCapture] Opening ${this.urls.length} LivePix page(s)...`);

      // Open each LivePix URL in a separate tab
      for (let i = 0; i < this.urls.length; i++) {
        const url = this.urls[i];
        await this.openPage(url, i);
      }

      this.isRunning = true;
      logger.info('[AudioCapture] Audio capture started successfully');

    } catch (error) {
      logger.error('[AudioCapture] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Open a LivePix page and set up audio capture
   */
  async openPage(url, index) {
    try {
      const page = await this.browser.newPage();

      // Set viewport (mobile size to save resources)
      await page.setViewport({ width: 375, height: 667 });

      // Enable request interception to capture audio files
      await page.setRequestInterception(true);

      // Intercept network requests
      page.on('request', (request) => {
        const requestUrl = request.url();
        const resourceType = request.resourceType();


        // Only allow document, script, xhr, fetch, and media
        if (['document', 'script', 'xhr', 'fetch', 'media', 'websocket'].includes(resourceType)) {
          request.continue();
        } else {
          // Block images, stylesheets, fonts to save bandwidth
          request.abort();
        }
      });

      // Capture audio responses
      page.on('response', async (response) => {
        try {
          const responseUrl = response.url();
          const contentType = response.headers()['content-type'] || '';

          // Check if it's an audio file
          const isAudio = contentType.includes('audio/') ||
            responseUrl.match(/\.(mp3|wav|ogg|m4a|aac|webm)(\?.*)?$/i);

          const status = response.status();

          console.log(`[AudioCapture ${index}] Response: ${responseUrl} [${status}]`);

          // Log all audio-related responses for debugging
          if (isAudio) {
            console.log(`[AudioCapture ${index}] Audio response [${status}]:`, {
              url: responseUrl,
              contentType,
              status
            });
          }

          // Handle 304 Not Modified - audio is cached, nothing to do
          if (isAudio && status === 304) {
            logger.debug(`[AudioCapture ${index}] Audio cached on server [304]: ${responseUrl}`);
            return;
          }

          // Process audio: 200 (OK) or 206 (Partial Content)
          if (isAudio && (status === 200 || status === 206)) {
            logger.info(`[AudioCapture ${index}] Audio detected [${status}]: ${responseUrl}`);

            // Check cache to avoid duplicates
            const cacheKey = this.getCacheKey(responseUrl);
            const now = Date.now();
            const cached = this.audioCache.get(cacheKey);

            // Only process if not cached or cache expired (30 seconds)
            if (!cached || (now - cached) > 30000) {
              this.audioCache.set(cacheKey, now);

              // Get audio buffer
              const buffer = await response.buffer();

              // Filter out small chunks from 206 Partial Content (< 1KB)
              if (buffer.length < 1000) {
                logger.debug(`[AudioCapture ${index}] Skipped small chunk [${status}]: ${buffer.length} bytes`);
                return;
              }

              const base64Audio = buffer.toString('base64');

              // Emit audio event
              this.emit('audio', {
                url: responseUrl,
                audio: base64Audio,
                contentType: contentType || 'audio/mpeg',
                size: buffer.length,
                timestamp: now,
                source: index,
                statusCode: status
              });

              logger.info(`[AudioCapture ${index}] Audio captured [${status}]: ${buffer.length} bytes`);

              // Schedule page reload after 3 seconds to clear cache
              this.schedulePageReload(index);
            } else {
              logger.debug(`[AudioCapture ${index}] Audio cached locally, skipping duplicate`);
            }
          }
        } catch (error) {
          logger.error(`[AudioCapture ${index}] Error capturing audio:`, error);
        }
      });

      // Inject JavaScript to log audio playback attempts
      await page.evaluateOnNewDocument(() => {
        // Override HTMLAudioElement.play() to log
        const originalPlay = HTMLAudioElement.prototype.play;
        HTMLAudioElement.prototype.play = function () {
          console.log('[LivePix] Audio play() called:', this.src);
          return originalPlay.apply(this, arguments);
        };

        // Override Web Audio API
        if (window.AudioContext || window.webkitAudioContext) {
          console.log('[LivePix] AudioContext available');
        }
      });

      // Listen to console logs from the page
      page.on('console', (msg) => {
        if (msg.text().includes('[LivePix]')) {
          logger.debug(`[AudioCapture ${index}] ${msg.text()}`);
        }
      });

      // Navigate to LivePix URL
      logger.info(`[AudioCapture ${index}] Loading ${url}...`);
      await page.goto(url, {
        waitUntil: 'networkidle2', // Wait for network to be idle
        timeout: 30000
      });

      // Keep page alive and monitor
      this.pages.push({ page, url, index });

      logger.info(`[AudioCapture ${index}] Page loaded successfully`);

    } catch (error) {
      logger.error(`[AudioCapture ${index}] Error opening page:`, error);
    }
  }

  /**
   * Schedule page reload after 3 seconds to clear browser cache
   */
  schedulePageReload(index) {
    // Cancel any existing timer for this page
    const existingTimer = this.reloadTimers.get(index);
    if (existingTimer) {
      clearTimeout(existingTimer);
      logger.debug(`[AudioCapture ${index}] Cancelled previous reload timer`);
    }

    // Schedule new reload
    const timer = setTimeout(async () => {
      try {
        const pageData = this.pages.find(p => p.index === index);
        if (pageData && pageData.page) {
          logger.info(`[AudioCapture ${index}] Reloading page to clear cache...`);
          await pageData.page.reload({
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          logger.info(`[AudioCapture ${index}] Page reloaded successfully`);
        }
      } catch (error) {
        logger.error(`[AudioCapture ${index}] Error reloading page:`, error);
      } finally {
        this.reloadTimers.delete(index);
      }
    }, 3000);

    this.reloadTimers.set(index, timer);
    logger.debug(`[AudioCapture ${index}] Scheduled page reload in 3 seconds`);
  }

  /**
   * Get cache key for audio URL
   */
  getCacheKey(url) {
    // Remove query params and timestamps for caching
    return url.split('?')[0];
  }

  /**
   * Stop audio capture
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('[AudioCapture] Stopping audio capture...');

    try {
      // Clear all reload timers
      for (const timer of this.reloadTimers.values()) {
        clearTimeout(timer);
      }
      this.reloadTimers.clear();

      // Close all pages
      for (const { page } of this.pages) {
        await page.close();
      }
      this.pages = [];

      // Close browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.isRunning = false;
      this.audioCache.clear();

      logger.info('[AudioCapture] Audio capture stopped');

    } catch (error) {
      logger.error('[AudioCapture] Error stopping:', error);
    }
  }

  /**
   * Check if audio capture is running
   */
  isActive() {
    return this.isRunning && this.browser && this.browser.isConnected();
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      running: this.isRunning,
      urls: this.urls.length,
      pages: this.pages.length,
      cacheSize: this.audioCache.size
    };
  }
}
