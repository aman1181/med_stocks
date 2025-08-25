// API Configuration utility
const getAPIUrl = () => {
  // For production, hardcode the API URL as fallback
  const productionAPI = 'https://med-stocks.onrender.com';
  const developmentAPI = 'http://localhost:5000';
  
  // Get from environment variables
  let url = import.meta.env.VITE_API_URL;
  
  // Safety checks and fallbacks
  if (!url || url.trim() === '') {
    // If no environment variable, detect based on current location
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      url = productionAPI;
      console.log('🌐 Using production API (detected Vercel)');
    } else if (import.meta.env.PROD) {
      url = productionAPI;
      console.log('🌐 Using production API (PROD mode)');
    } else {
      url = developmentAPI;
      console.log('🌐 Using development API (DEV mode)');
    }
  }
  
  // Remove trailing slash if present
  const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  // Always log API URL for debugging
  console.log('🔧 Environment Mode:', import.meta.env.MODE);
  console.log('🌐 Raw VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('🌐 Final API URL:', cleanUrl);
  console.log('🌍 Current hostname:', typeof window !== 'undefined' ? window.location.hostname : 'server-side');
  
  return cleanUrl;
};

export const API = getAPIUrl();

// Helper function for JSON API calls
export const apiCallJSON = async (endpoint, options = {}) => {
  const response = await apiCall(endpoint, options);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  // Handle empty responses
  const text = await response.text();
  if (!text) return null;
  
  try {
    return JSON.parse(text);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to parse JSON response:', text);
    }
    throw new Error('Invalid JSON response from server');
  }
};

// Helper function for making API calls
export const apiCall = async (endpoint, options = {}) => {
  // Debug the inputs
  console.log('🔍 apiCall inputs:', { endpoint, API });

  // Ensure endpoint starts with / but doesn't duplicate or double it
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // Remove any accidental double slashes
  cleanEndpoint = cleanEndpoint.replace(/\/\/+/, '/');
  const url = `${API}${cleanEndpoint}`;

  // Debug the final URL
  console.log('🔗 Final constructed URL:', url);

  // Get token from localStorage (if present)
  let token = null;
  try {
    token = localStorage.getItem('token');
  } catch (e) {
    // Ignore if not available (e.g. server-side)
  }

  // Build headers, attach Authorization if token exists
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };


  // Merge options properly - ensure Authorization header is never lost
  const finalOptions = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  };

  // Only log in development OR if there's an error (for production debugging)
  if (import.meta.env.DEV) {
    console.log(`🌐 API Call: ${finalOptions.method || 'GET'} ${url}`);
    console.log(`📤 Request options:`, finalOptions);
  }

  // Always log final URL for debugging
  console.log(`🔗 Final API URL: ${url}`);

  try {
    const response = await fetch(url, finalOptions);

    // Return the response object for the caller to handle
    // This allows checking response.ok, response.status, etc.
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText} - ${url}`);
    }

    return response;
  } catch (error) {
    console.error(`❌ Network Error: ${error.message} - ${url}`);
    throw error;
  }
};

export default { API, apiCall, apiCallJSON };
