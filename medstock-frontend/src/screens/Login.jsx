import React, { useState } from 'react'
import { API, apiCall } from '../utils/api'
import { useNavigate } from 'react-router-dom'

export default function Login({ onLogin }){
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate();

  async function handleSubmit(e){
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // ✅ Updated endpoint for JWT auth
      const data = await apiCall('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      if (!data.success || !data.token || !data.user) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      // ✅ FIXED: Save token separately AND in user object
      
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


      


      // ✅ Pass complete user data with token info
      onLogin({
        ...data.user,
        token: data.token,
        permissions: data.permissions || null
      });
      // Redirect to dashboard after login
      navigate('/dashboard');

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
          const res = await apiCall('/api/auth/me', {
            headers: { 
              'Authorization': `Bearer ${existingToken}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.user) {
              onLogin({
                ...data.user,
                token: existingToken
              })
              return
            }
          }
        } catch (err) {
        }
        
        // Clear invalid tokens
        localStorage.removeItem('token')
        localStorage.removeItem('user')
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
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="w-full border border-gray-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
                tabIndex={0}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.5 12c2.273 4.55 7.022 7.5 12 7.5 2.042 0 3.98-.41 5.73-1.127M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.02-3.777A10.477 10.477 0 0122.5 12c-2.273 4.55-7.022 7.5-12 7.5a10.477 10.477 0 01-5.73-1.127" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12c0-4.55 4.75-7.5 9.75-7.5s9.75 2.95 9.75 7.5-4.75 7.5-9.75 7.5S2.25 16.55 2.25 12z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
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
