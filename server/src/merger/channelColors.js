// Predefined color palette for channels
const CHANNEL_COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33F5',
  '#F5FF33', '#33FFF5', '#FF8333', '#8333FF',
  '#33FF83', '#F533FF', '#FFD633', '#33D6FF'
];

// Simple hash function for deterministic color assignment
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/**
 * Get or assign a color for a channel
 * @param {string} channelName - The channel name
 * @returns {string} Hex color code
 */
export function getChannelColor(channelName) {
  const hash = hashString(channelName);
  return CHANNEL_COLORS[hash % CHANNEL_COLORS.length];
}

/**
 * Get all channel colors as a map
 * @param {string[]} channels - Array of channel names
 * @returns {Map<string, string>} Map of channel -> color
 */
export function getChannelColorMap(channels) {
  const colorMap = new Map();
  channels.forEach(channel => {
    colorMap.set(channel, getChannelColor(channel));
  });
  return colorMap;
}
