import logger from '../utils/logger.js';
import { getChannelColor } from '../merger/channelColors.js';

/**
 * Setup API routes
 * @param {Object} fastify - Fastify instance
 * @param {Object} deps - Dependencies (twitchClient, messageBuffer, sseManager, etc)
 */
export function setupRoutes(fastify, { server, twitchClient, messageBuffer, sseManager, channelColors }) {

  // Health check
  fastify.get('/api/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime()
    };
  });

  // Get LivePix URLs (for mobile/IRL alerts)
  fastify.get('/api/livepix/urls', async (request, reply) => {
    const config = await import('../utils/config.js');
    const urls = config.default.livepix.urls || [];
    return {
      urls,
      enabled: urls.length > 0,
      count: urls.length
    };
  });

  // Status of connections
  fastify.get('/api/status', async (request, reply) => {
    return {
      twitch: {
        connected: twitchClient.isConnected(),
        channels: twitchClient.getChannels()
      },
      buffer: messageBuffer.getStats(),
      sse: sseManager.getStats()
    };
  });

  // SSE stream endpoint
  fastify.get('/api/chat/stream', async (request, reply) => {
    return sseManager.handleConnection(request, reply);
  });

  // Get message history
  fastify.get('/api/messages/history', async (request, reply) => {
    const { limit = 100, channels, exclude } = request.query;

    let messages = messageBuffer.getAll();

    // Apply channel filter
    if (channels) {
      const channelList = channels.split(',').map(c => c.trim().toLowerCase());
      messages = messageBuffer.getFiltered(channelList);
    }

    // Apply exclude filter
    if (exclude) {
      const excludeList = exclude.split(',').map(c => c.trim().toLowerCase());
      messages = messageBuffer.getExcluding(excludeList);
    }

    // Limit results
    const limitNum = parseInt(limit, 10);
    const limitedMessages = messages.slice(-limitNum);

    return {
      messages: limitedMessages,
      total: messages.length,
      returned: limitedMessages.length
    };
  });

  // Get message history for specific channel
  fastify.get('/api/messages/history/:channel', async (request, reply) => {
    const { channel } = request.params;
    const { limit = 100 } = request.query;

    const messages = messageBuffer.getByChannel(channel.toLowerCase());
    const limitNum = parseInt(limit, 10);
    const limitedMessages = messages.slice(-limitNum);

    return {
      channel,
      messages: limitedMessages,
      total: messages.length,
      returned: limitedMessages.length
    };
  });

  // List active channels
  fastify.get('/api/channels', async (request, reply) => {
    const channels = twitchClient.getChannels();

    return {
      channels: channels.map(channel => ({
        name: channel,
        color: channelColors.get(channel),
        connected: twitchClient.isConnected(),
        messageCount: messageBuffer.getByChannel(channel).length
      }))
    };
  });

  // Add channel
  fastify.post('/api/channels', async (request, reply) => {
    const { channel, channels: channelList } = request.body;

    const channelsToAdd = channelList || [channel];

    if (!channelsToAdd || channelsToAdd.length === 0) {
      return reply.code(400).send({ error: 'Channel or channels required' });
    }

    channelsToAdd.forEach(ch => {
      const channelName = ch.trim().toLowerCase();
      twitchClient.addChannel(channelName);

      // Update channel colors map
      if (!channelColors.has(channelName)) {
        channelColors.set(channelName, getChannelColor(channelName));
      }
    });

    return {
      success: true,
      channels: twitchClient.getChannels()
    };
  });

  // Remove channel
  fastify.delete('/api/channels/:name', async (request, reply) => {
    const { name } = request.params;
    const channelName = name.toLowerCase();

    twitchClient.removeChannel(channelName);

    return {
      success: true,
      channels: twitchClient.getChannels()
    };
  });

  // Get channel stats
  fastify.get('/api/channels/:name/stats', async (request, reply) => {
    const { name } = request.params;
    const channelName = name.toLowerCase();

    const messages = messageBuffer.getByChannel(channelName);

    return {
      channel: channelName,
      messageCount: messages.length,
      color: channelColors.get(channelName),
      connected: twitchClient.getChannels().includes(channelName)
    };
  });

  // Get channel colors map
  fastify.get('/api/channels/colors', async (request, reply) => {
    const colorMap = {};
    channelColors.forEach((color, channel) => {
      colorMap[channel] = color;
    });

    return { colors: colorMap };
  });

  // Sync endpoint - Get missed messages by sequence number
  fastify.get('/api/messages/sync', async (request, reply) => {
    const { lastSequence } = request.query;

    if (!lastSequence) {
      return reply.code(400).send({ error: 'lastSequence parameter is required' });
    }

    const lastSeq = parseInt(lastSequence, 10);
    if (isNaN(lastSeq)) {
      return reply.code(400).send({ error: 'lastSequence must be a valid number' });
    }

    const missedMessages = messageBuffer.getAfterSequence(lastSeq);
    const currentSequence = server ? server.getCurrentSequence() : messageBuffer.getCurrentSequence();

    return {
      currentSequence,
      lastSequence: lastSeq,
      missedCount: missedMessages.length,
      messages: missedMessages
    };
  });

  // Get messages by sequence range
  fastify.get('/api/messages/range', async (request, reply) => {
    const { from, to } = request.query;

    if (!from || !to) {
      return reply.code(400).send({ error: 'from and to parameters are required' });
    }

    const fromSeq = parseInt(from, 10);
    const toSeq = parseInt(to, 10);

    if (isNaN(fromSeq) || isNaN(toSeq)) {
      return reply.code(400).send({ error: 'from and to must be valid numbers' });
    }

    if (fromSeq > toSeq) {
      return reply.code(400).send({ error: 'from must be less than or equal to to' });
    }

    const messages = messageBuffer.getBySequenceRange(fromSeq, toSeq);

    return {
      from: fromSeq,
      to: toSeq,
      count: messages.length,
      messages
    };
  });

  logger.info('API routes registered');
}
