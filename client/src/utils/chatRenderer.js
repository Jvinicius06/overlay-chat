/**
 * Chat renderer utilities
 */

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Parse and render message with emotes
 */
export function renderMessageContent(message) {
  let content = escapeHtml(message.message);

  // Replace emotes with images if available
  if (message.emotes && message.emotes.length > 0) {
    // Sort emotes by position (reverse order to maintain indices)
    const sortedEmotes = [...message.emotes].sort((a, b) => {
      return b.positions[0][0] - a.positions[0][0];
    });

    sortedEmotes.forEach(emote => {
      emote.positions.forEach(([start, end]) => {
        const emoteName = message.message.substring(start, end + 1);
        const emoteImg = `<img src="${emote.url}" alt="${emoteName}" class="emote" title="${emoteName}" />`;
        content = content.substring(0, start) + emoteImg + content.substring(end + 1);
      });
    });
  }

  return content;
}

/**
 * Create channel badge element for overlay mode
 */
export function createChannelBadge(channel, channelColor) {
  const badge = document.createElement('span');
  badge.className = 'channel-badge';
  badge.textContent = channel;
  badge.style.backgroundColor = channelColor;
  badge.style.color = getContrastColor(channelColor);
  return badge;
}

/**
 * Create username element
 */
export function createUsername(message) {
  const username = document.createElement('span');
  username.className = 'username';
  username.textContent = message.username;
  username.style.color = message.color || '#ffffff';
  return username;
}

/**
 * Get contrasting color (black or white) for background
 */
function getContrastColor(hexColor) {
  // Convert hex to RGB
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Create overlay message element
 */
export function createOverlayMessage(message) {
  const messageEl = document.createElement('div');
  messageEl.className = 'message';

  const header = document.createElement('div');
  header.className = 'message-header';

  // Channel badge
  const badge = createChannelBadge(message.channel, message.channelColor);
  header.appendChild(badge);

  // Username
  const username = createUsername(message);
  header.appendChild(username);

  messageEl.appendChild(header);

  // Message content
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = renderMessageContent(message);
  messageEl.appendChild(content);

  return messageEl;
}

/**
 * Get Twitch badge URL
 */
function getTwitchBadgeUrl(type, version = '1') {
  // Common badge mappings
  const badgeUrls = {
    'broadcaster': 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1',
    'moderator': 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1',
    'vip': 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/1',
    'subscriber': `https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/${version}`,
    'premium': 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a598-423e-86d0-f9fb98ca1933/1',
    'turbo': 'https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/1',
    'partner': 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1',
    'staff': 'https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/1',
    'admin': 'https://static-cdn.jtvnw.net/badges/v1/9ef7e029-4cdf-4d4d-a0d5-e2b3fb2568af/1',
    'global_mod': 'https://static-cdn.jtvnw.net/badges/v1/9384c43e-4ce7-4e94-b2a1-b93656896eba/1'
  };

  return badgeUrls[type] || null;
}

/**
 * Create Twitch badges container
 */
function createBadges(badges) {
  if (!badges || badges.length === 0) return null;

  const badgesContainer = document.createElement('span');
  badgesContainer.className = 'twitch-badges';

  badges.forEach(badge => {
    const badgeUrl = getTwitchBadgeUrl(badge.type, badge.version);
    if (badgeUrl) {
      const badgeImg = document.createElement('img');
      badgeImg.src = badgeUrl;
      badgeImg.alt = badge.type;
      badgeImg.title = badge.type.replace('_', ' ');
      badgeImg.className = 'twitch-badge';
      badgesContainer.appendChild(badgeImg);
    }
  });

  return badgesContainer.children.length > 0 ? badgesContainer : null;
}

/**
 * Create mobile message element
 */
export function createMobileMessage(message) {
  const messageEl = document.createElement('div');
  messageEl.className = 'mobile-message';
  messageEl.style.borderLeftColor = message.channelColor;

  const header = document.createElement('div');
  header.className = 'mobile-message-header';

  // Channel badge
  const badge = document.createElement('span');
  badge.className = 'mobile-channel-badge';
  badge.textContent = message.channel;
  badge.style.backgroundColor = message.channelColor;
  badge.style.color = getContrastColor(message.channelColor);
  header.appendChild(badge);

  // Twitch badges (moderator, subscriber, VIP, etc.)
  if (message.badges && message.badges.length > 0) {
    const badgesEl = createBadges(message.badges);
    if (badgesEl) {
      header.appendChild(badgesEl);
    }
  }

  // Username
  const username = document.createElement('span');
  username.className = 'mobile-username';
  username.textContent = message.username;
  username.style.color = message.color || '#ffffff';
  header.appendChild(username);

  // Timestamp
  const timestamp = document.createElement('span');
  timestamp.className = 'mobile-timestamp';
  timestamp.textContent = formatTimestamp(message.timestamp);
  header.appendChild(timestamp);

  messageEl.appendChild(header);

  // Message content
  const content = document.createElement('div');
  content.className = 'mobile-content';
  content.innerHTML = renderMessageContent(message);
  messageEl.appendChild(content);

  return messageEl;
}
