/**
 * Application configuration
 * Determines API URL based on environment
 */

// In development mode (vite dev), proxy redirects /api to localhost:3000
// In production mode (vite build), use relative /api paths (same server)
const getApiUrl = () => {
  // Always use relative paths - proxy handles dev mode redirection
  return ''; // Empty string means use relative paths like /api/...
};

export const config = {
  apiUrl: getApiUrl(),

  // Environment info
  isDev: import.meta.env.MODE === 'development',
  mode: import.meta.env.MODE
};
