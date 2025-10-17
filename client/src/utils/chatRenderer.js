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
