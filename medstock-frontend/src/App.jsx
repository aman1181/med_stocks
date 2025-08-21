import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from "./components/Layout";
import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import UserManagement from "./components/UserManagement";
import Billing from "./screens/Billing";
import Inventory from "./screens/Inventory";
import Reports from "./screens/Reports";
import Vendors from "./screens/Vendors";
import Doctors from "./screens/Doctors";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        if (token && userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading MedStock...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Login Route */}
          <Route 
            path="/login" 
            element={
              user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onLogin={handleLogin} />
              )
            } 
          />
          
          {/* Dashboard */}
          <Route 
            path="/dashboard" 
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Dashboard user={user} onLogout={handleLogout} />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          {/* User Management - Admin Only */}
          <Route 
            path="/users" 
            element={
              user && user.role === 'admin' ? (
                <Layout user={user} onLogout={handleLogout}>
                  <UserManagement user={user} onLogout={handleLogout} />
                </Layout>
              ) : user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          {/* Billing */}
          <Route 
            path="/billing" 
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Billing user={user} onLogout={handleLogout} />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          <Route 
            path="/billing/create" 
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Billing user={user} onLogout={handleLogout} />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          {/* Inventory */}
          <Route 
            path="/inventory" 
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Inventory user={user} onLogout={handleLogout} />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          {/* Reports */}
          <Route 
            path="/reports" 
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Reports user={user} onLogout={handleLogout} />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          {/* Vendors */}
          <Route 
            path="/vendors" 
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Vendors user={user} onLogout={handleLogout} />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          {/* Doctors */}
          <Route 
            path="/doctors" 
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Doctors user={user} onLogout={handleLogout} />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          {/* Settings */}
          <Route 
            path="/settings" 
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <div className="p-6">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">⚙️ Settings</h1>
                    <div className="bg-white p-8 rounded-lg shadow">
                      <div className="text-center mb-6">
                        <div className="text-4xl mb-4">⚙️</div>
                        <p className="text-gray-600">Application settings and configuration</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                          <h3 className="font-semibold text-gray-800 mb-2">👤 User Preferences</h3>
                          <p className="text-sm text-gray-600 mb-3">Manage your personal settings</p>
                          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            Configure →
                          </button>
                        </div>
                        
                        <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                          <h3 className="font-semibold text-gray-800 mb-2">🔧 System Configuration</h3>
                          <p className="text-sm text-gray-600 mb-3">Configure system-wide settings</p>
                          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            Configure →
                          </button>
                        </div>
                        
                        <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                          <h3 className="font-semibold text-gray-800 mb-2">🔒 Security</h3>
                          <p className="text-sm text-gray-600 mb-3">Password and security settings</p>
                          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            Configure →
                          </button>
                        </div>
                        
                        <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                          <h3 className="font-semibold text-gray-800 mb-2">💾 Backup & Export</h3>
                          <p className="text-sm text-gray-600 mb-3">Data backup and export options</p>
                          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            Configure →
                          </button>
                        </div>
                      </div>

                      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="font-semibold text-blue-800 mb-2">📊 Current User Info</h3>
                        <div className="text-sm text-blue-700 space-y-1">
                          <p><strong>Username:</strong> {user?.username}</p>
                          <p><strong>Role:</strong> {user?.role}</p>
                          <p><strong>User ID:</strong> {user?.id}</p>
                          <p><strong>Logged in:</strong> {new Date().toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          {/* Help */}
          <Route 
            path="/help" 
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <div className="p-6">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">❓ Help & Support</h1>
                    <div className="bg-white p-8 rounded-lg shadow">
                      <div className="text-center mb-6">
                        <div className="text-4xl mb-4">❓</div>
                        <p className="text-gray-600">Get help and support for MedStock</p>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                          <h3 className="font-semibold text-gray-800 mb-2">📚 User Manual</h3>
                          <p className="text-sm text-gray-600 mb-2">Comprehensive guide for using MedStock</p>
                          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            View Manual →
                          </button>
                        </div>
                        
                        <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                          <h3 className="font-semibold text-gray-800 mb-2">🎥 Video Tutorials</h3>
                          <p className="text-sm text-gray-600 mb-2">Watch step-by-step tutorials</p>
                          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            Watch Videos →
                          </button>
                        </div>
                        
                        <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                          <h3 className="font-semibold text-gray-800 mb-2">💬 Contact Support</h3>
                          <p className="text-sm text-gray-600 mb-2">Get in touch with our support team</p>
                          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            Contact Us →
                          </button>
                        </div>
                        
                        <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                          <h3 className="font-semibold text-gray-800 mb-2">🔧 System Info</h3>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><strong>Version:</strong> 1.0.0</p>
                            <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
                            <p><strong>Environment:</strong> {process.env.NODE_ENV || 'development'}</p>
                            <p><strong>API URL:</strong> {import.meta.env.VITE_API_URL || 'http://localhost:5000'}</p>
                          </div>
                        </div>

                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <h3 className="font-semibold text-green-800 mb-2">🚀 Quick Help</h3>
                          <div className="text-sm text-green-700 space-y-2">
                            <p><strong>Dashboard:</strong> View overview and statistics</p>
                            <p><strong>Inventory:</strong> Manage medicine stock and batches</p>
                            <p><strong>Billing:</strong> Create bills and manage sales</p>
                            <p><strong>Vendors:</strong> Manage suppliers and vendors</p>
                            <p><strong>Doctors:</strong> Manage doctor information</p>
                            <p><strong>Reports:</strong> Generate and view reports</p>
                            {user?.role === 'admin' && (
                              <p><strong>Users:</strong> Manage system users (Admin only)</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          {/* Default redirect */}
          <Route 
            path="/" 
            element={
              <Navigate to={user ? "/dashboard" : "/login"} replace />
            } 
          />
          
          {/* 404 fallback */}
          <Route 
            path="*" 
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <div className="p-6">
                    <div className="max-w-md mx-auto mt-20 text-center">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8">
                        <div className="text-6xl mb-4">🔍</div>
                        <h2 className="text-2xl font-bold text-yellow-800 mb-2">Page Not Found</h2>
                        <p className="text-yellow-600 mb-4">
                          The page you're looking for doesn't exist.
                        </p>
                        <button
                          onClick={() => window.location.href = '/dashboard'}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                        >
                          Go to Dashboard
                        </button>
                      </div>
                    </div>
                  </div>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}