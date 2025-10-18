/**
 * Application configuration
 * Determines API URL based on environment
 */

// In development mode (vite dev), use localhost:3000
// In production mode (vite build), use relative /api paths
const getApiUrl = () => {
  if (import.meta.env.MODE === 'development') {
    return 'http://localhost:3000';
  }
  return ''; // Empty string means use relative paths like /api/...
};

export const config = {
  apiUrl: getApiUrl()
};
