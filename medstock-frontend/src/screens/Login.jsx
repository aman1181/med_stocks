import React, { useState } from 'react'

export default function Login({ onLogin }){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  async function handleSubmit(e){
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // ✅ Updated endpoint for JWT auth
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      // ✅ Check if response has required fields
      if (!data.success || !data.token || !data.user) {
        setError('Invalid response from server')
        setLoading(false)
        return
      }

      // ✅ FIXED: Save token separately AND in user object
      console.log('💾 Saving login data...');
      
      // Save token separately
      localStorage.setItem('token', data.token);
      
      // Save user with token included
      localStorage.setItem('user', JSON.stringify({
        ...data.user,
        token: data.token  // Keep token in user object too
      }));
      
      // ✅ Verification
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      console.log('✅ Token saved separately:', !!savedToken);
      console.log('✅ User saved with token:', !!savedUser);

      console.log('🔍 POST-LOGIN CHECK:');
      console.log('Token:', data.token);
      console.log('User:', data.user);
      console.log('Saved Token:', savedToken);
      console.log('Saved User:', JSON.parse(savedUser));

      
      // ✅ Set auth header for future requests
      window.authToken = data.token
      
      console.log('Login successful:', {
        user: data.user.username,
        role: data.user.role,
        token: data.token ? 'Present' : 'Missing'
      })

      // ✅ Pass complete user data with token info
      onLogin({
        ...data.user,
        token: data.token,
        permissions: data.permissions || null
      })

    } catch (err) {
      console.error('Login error:', err)
      setError('Network error — check backend server')
    } finally {
      setLoading(false)
    }
  }

  // ✅ Auto-login if token exists and is valid
  React.useEffect(() => {
    const checkExistingAuth = async () => {
      const existingToken = localStorage.getItem('token')
      const existingUser = localStorage.getItem('user')
      
      if (existingToken && existingUser) {
        try {
          // Verify token with backend
          const res = await fetch(`${API}/api/auth/me`, {
            headers: { 
              'Authorization': `Bearer ${existingToken}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.user) {
              window.authToken = existingToken
              onLogin({
                ...data.user,
                token: existingToken
              })
              return
            }
          }
        } catch (err) {
          console.log('Token validation failed:', err)
        }
        
        // Clear invalid tokens
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.authToken = null
      }
    }
    
    checkExistingAuth()
  }, [API, onLogin])

  return (
    <div className="relative min-h-screen bg-cover bg-center bg-[url('/bg.jpg')]">
      <div className="absolute inset-0 backdrop-blur-[3px]" />
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-8 rounded-sm shadow-2xl">
          <h1 className="mt-10 text-center text-2xl/9 font-bold tracking-tight text-green-700">
            MedStock Login
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="username" className="block text-sm/6 font-medium text-gray-900 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="w-full border border-gray-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={username}
              onChange={(e) => setUsername(e.target.value)}  
              autoComplete="username"
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm/6 font-medium text-gray-900 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full border border-gray-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging in...
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}