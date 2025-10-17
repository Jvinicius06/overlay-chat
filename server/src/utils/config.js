import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file manually (simple dotenv alternative)
function loadEnv() {
  try {
    const envPath = join(__dirname, '../../.env');
    const envFile = readFileSync(envPath, 'utf8');

    envFile.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();

      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch (err) {
    // .env file is optional
  }
}

loadEnv();

const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },

  twitch: {
    channels: (process.env.TWITCH_CHANNELS || '')
      .split(',')
      .map(c => c.trim().toLowerCase())
      .filter(Boolean),
    reconnect: {
      maxAttempts: 10,
      baseDelay: 1000,
      maxDelay: 30000
    }
  },

  messageBuffer: {
    maxSize: parseInt(process.env.MAX_BUFFER_SIZE || '1000', 10),
    ttlMs: parseInt(process.env.MESSAGE_TTL_MS || '600000', 10)
  },

  sse: {
    heartbeatInterval: parseInt(process.env.SSE_HEARTBEAT_INTERVAL || '15000', 10),
    retryMs: parseInt(process.env.SSE_RETRY_MS || '3000', 10)
  }
};

export default config;
