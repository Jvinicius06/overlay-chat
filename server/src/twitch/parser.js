/**
 * Parse Twitch IRC tags
 * @param {string} tagsStr - Raw tags string from IRC message
 * @returns {Object} Parsed tags object
 */
export function parseTags(tagsStr) {
  const tags = {};
  if (!tagsStr) return tags;

  tagsStr.split(';').forEach(tag => {
    const [key, value] = tag.split('=');
    tags[key] = value || '';
  });

  return tags;
}

/**
 * Parse IRC PRIVMSG into structured message object
 * @param {string} rawMessage - Raw IRC message
 * @returns {Object|null} Parsed message or null if not PRIVMSG
 */
export function parseMessage(rawMessage) {
  // Example IRC message:
  // @badge-info=;badges=;color=#FF0000;display-name=User;emotes=;id=abc123;mod=0;
  // room-id=12345;subscriber=0;tmi-sent-ts=1234567890;turbo=0;user-id=98765;user-type=
  // :user!user@user.tmi.twitch.tv PRIVMSG #channel :Hello World

  const match = rawMessage.match(/^(@([^ ]+) )?:([^!]+)![^@]+@[^ ]+ PRIVMSG #([^ ]+) :(.*)$/);

  if (!match) return null;

  const [, , tagsStr, username, channel, message] = match;
  const tags = parseTags(tagsStr);

  // Parse emotes from tags
  const emotes = parseEmotes(tags.emotes, message);

  // Parse badges
  const badges = parseBadges(tags.badges);

  return {
    username: tags['display-name'] || username,
    userId: tags['user-id'] || '',
    channel: channel.toLowerCase(),
    message,
    timestamp: parseInt(tags['tmi-sent-ts'] || Date.now(), 10),
    color: tags.color || '#FFFFFF',
    badges,
    emotes,
    isModerator: tags.mod === '1',
    isSubscriber: tags.subscriber === '1',
    isVip: badges.some(b => b.type === 'vip')
  };
}

/**
 * Parse emotes from tags
 * @param {string} emotesStr - Emotes string from tags
 * @param {string} message - The message text
 * @returns {Array} Array of emote objects
 */
function parseEmotes(emotesStr, message) {
  if (!emotesStr) return [];

  const emotes = [];

  emotesStr.split('/').forEach(emoteData => {
    const [emoteId, positions] = emoteData.split(':');
    if (!positions) return;

    positions.split(',').forEach(pos => {
      const [start, end] = pos.split('-').map(Number);
      const emoteName = message.substring(start, end + 1);

      emotes.push({
        id: emoteId,
        name: emoteName,
        positions: [[start, end]],
        url: `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/1.0`
      });
    });
  });

  return emotes;
}

/**
 * Parse badges from tags
 * @param {string} badgesStr - Badges string from tags
 * @returns {Array} Array of badge objects
 */
function parseBadges(badgesStr) {
  if (!badgesStr) return [];

  return badgesStr.split(',').map(badge => {
    const [type, version] = badge.split('/');
    return { type, version: version || '1' };
  });
}

/**
 * Check if message is a PING
 * @param {string} rawMessage - Raw IRC message
 * @returns {boolean}
 */
export function isPing(rawMessage) {
  return rawMessage.startsWith('PING');
}

/**
 * Get PONG response for PING
 * @param {string} rawMessage - Raw PING message
 * @returns {string} PONG response
 */
export function getPongResponse(rawMessage) {
  return rawMessage.replace('PING', 'PONG');
}
