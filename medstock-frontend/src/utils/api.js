// API Configuration utility
const getAPIUrl = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  // Remove trailing slash if present
  const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  // Debug logging only in development
  if (import.meta.env.DEV) {
    console.log('🔧 Environment Mode:', import.meta.env.MODE);
    console.log('🌐 API URL:', cleanUrl);
    console.log('📋 Full env vars:', {
      VITE_API_URL: import.meta.env.VITE_API_URL,
      MODE: import.meta.env.MODE,
      PROD: import.meta.env.PROD,
      DEV: import.meta.env.DEV
    });
  }
  
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
  
  // Ensure endpoint starts with / but doesn't duplicate it
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API}${cleanEndpoint}`;
  
  // Debug the final URL
  console.log('🔗 Final constructed URL:', url);
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include'  // Important for CORS with credentials
  };
  
  // Merge options properly - method should come from options
  const finalOptions = { ...defaultOptions, ...options };
  
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
