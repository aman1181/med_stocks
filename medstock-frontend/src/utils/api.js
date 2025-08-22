// API Configuration utility
const getAPIUrl = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  // Remove trailing slash if present
  const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  // Debug logging for production
  console.log('🔧 Environment Mode:', import.meta.env.MODE);
  console.log('🌐 API URL:', cleanUrl);
  console.log('📋 Full env vars:', {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    MODE: import.meta.env.MODE,
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV
  });
  
  return cleanUrl;
};

export const API = getAPIUrl();

// Helper function for making API calls
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include'  // Important for CORS with credentials
  };
  
  // Merge options properly - method should come from options
  const finalOptions = { ...defaultOptions, ...options };
  
  console.log(`🌐 API Call: ${finalOptions.method || 'GET'} ${url}`);
  console.log(`📤 Request options:`, finalOptions);
  
  try {
    const response = await fetch(url, finalOptions);
    
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText} - ${url}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    console.error(`❌ Network Error: ${error.message} - ${url}`);
    throw error;
  }
};

export default { API, apiCall };
