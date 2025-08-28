// API Configuration utility
const getAPIUrl = () => {
  const productionAPI = 'https://med-stocks.onrender.com';
  const developmentAPI = 'http://localhost:5000';
  let url = import.meta.env.VITE_API_URL;
  if (!url || url.trim() === '') {
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      url = productionAPI;
    } else if (import.meta.env.PROD) {
      url = productionAPI;
    } else {
      url = developmentAPI;
    }
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

export const API = getAPIUrl();

// Unified API call function: returns parsed JSON or throws
export const apiCall = async (endpoint, options = {}) => {
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  cleanEndpoint = cleanEndpoint.replace(/\/\/+/, '/');
  const url = `${API}${cleanEndpoint}`;
  let token = null;
  try {
    token = localStorage.getItem('token');
  } catch (e) {}
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const finalOptions = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  };
  if (import.meta.env.DEV) {
    console.log(`🌐 API Call: ${finalOptions.method || 'GET'} ${url}`);
    console.log(`📤 Request options:`, finalOptions);
  }
  try {
    const response = await fetch(url, finalOptions);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${text}`);
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to parse JSON response:', text);
      }
      throw new Error('Invalid JSON response from server');
    }
  } catch (error) {
    console.error(`❌ Network/API Error: ${error.message} - ${url}`);
    throw error;
  }
};
