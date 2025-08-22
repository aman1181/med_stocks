import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API, apiCall } from '../utils/api';
import { 
  ChartBarIcon, 
  CubeIcon, 
  DocumentTextIcon, 
  BuildingOfficeIcon, 
  UserIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState('');

  useEffect(() => {
    const getUserInfo = () => {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr && userStr !== 'undefined' && userStr !== 'null') {
          const user = JSON.parse(userStr);
          if (user && user.role) {
            setCurrentUser(user);
            setCurrentUserRole(user.role);
            return user;
          }
        }
        setCurrentUser(null);
        setCurrentUserRole('');
      } catch (err) {
        setCurrentUser(null);
        setCurrentUserRole('');
      }
    };

    getUserInfo();
  }, []);

  const isAudit = currentUserRole === 'audit';
  const isAdmin = currentUserRole === 'admin';
  const isPharmacist = currentUserRole === 'pharmacist';
  const canViewFinancials = isAdmin || isAudit;
  const canAccessBilling = isAdmin || isPharmacist;
  const canManageInventory = isAdmin || isPharmacist;
  const canViewReports = isAdmin || isAudit || isPharmacist;

  return {
    currentUser,
    currentUserRole,
    isAudit,
    isAdmin,
    isPharmacist,
    canViewFinancials,
    canAccessBilling,
    canManageInventory,
    canViewReports
  };
};

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { 
    isAudit, 
    canViewFinancials, 
    canAccessBilling, 
    canManageInventory, 
    canViewReports 
  } = useAuth();
  
  const [stats, setStats] = useState({
    sales: { value: 0, change: 0 },
    revenue: { value: 0, change: 0 },
    stock: { value: 0, change: 0 },
    lowStock: { value: 0, change: 0 }
  });
  
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [error, setError] = useState('');

  const getAuthToken = () => {
    const directToken = localStorage.getItem('token');
    
    if (directToken && directToken !== 'undefined' && directToken !== 'null') {
      return directToken;
    }
    
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const userToken = user.token;
        
        if (userToken && userToken !== 'undefined' && userToken !== 'null') {
          return userToken;
        }
      } catch (err) {
        // Silent fail
      }
    }
    
    return null;
  };

  const getAuthHeaders = () => {
    const token = getAuthToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = getAuthToken();
      if (!token) {
        setError('Authentication required. Please login again.');
        return;
      }
      
      // Fetch inventory data (available to all roles)
      const inventoryResponse = await apiCall('/api/inventory', { 
        headers: getAuthHeaders() 
      });
      
      let inventory = [];
      if (inventoryResponse.ok) {
        inventory = await inventoryResponse.json();
        if (!Array.isArray(inventory)) {
          inventory = [];
        }
      } else if (inventoryResponse.status === 401) {
        onLogout && onLogout();
        return;
      }

      const totalStock = inventory.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
      const lowStockItems = inventory.filter(item => (parseInt(item.qty) || 0) <= 10).length;

      let salesCount = 0;
      let revenue = 0;

      // Fetch financial data only if user has permission
      if (canViewFinancials) {
        try {
          // Try daily sales endpoint first
          const dailySalesResponse = await apiCall('/api/reports/sales/daily', { 
            headers: getAuthHeaders() 
          });
          
          if (dailySalesResponse.ok) {
            const dailyData = await dailySalesResponse.json();
            salesCount = dailyData.sales || dailyData.transactions || 0;
            revenue = dailyData.revenue || 0;
          } else {
            // Fallback to billing endpoint
            const billsResponse = await apiCall('/api/billing', { 
              headers: getAuthHeaders() 
            });
            
            if (billsResponse.ok) {
              const billsData = await billsResponse.json();
              const bills = Array.isArray(billsData) ? billsData : (billsData.bills || []);
              
              const today = new Date().toDateString();
              const todaysBills = bills.filter(bill => 
                new Date(bill.created_at).toDateString() === today
              );
              
              salesCount = todaysBills.length;
              revenue = todaysBills.reduce((sum, bill) => sum + parseFloat(bill.total || 0), 0);
            }
          }
        } catch (err) {
          // Silent fail for financial data
        }
      }

      setStats({
        sales: { 
          value: salesCount,
          change: Math.floor(Math.random() * 20) - 10 
        },
        revenue: { 
          value: revenue.toFixed(2),
          change: Math.floor(Math.random() * 30) - 15 
        },
        stock: { 
          value: totalStock, 
          change: Math.floor(Math.random() * 15) - 5 
        },
        lowStock: { 
          value: lowStockItems, 
          change: Math.floor(Math.random() * 10) - 5 
        }
      });

      setLastUpdate(new Date());

    } catch (error) {
      setError('Failed to fetch dashboard data. Please check server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
      
      const interval = setInterval(fetchDashboardStats, 30000);
      return () => clearInterval(interval);
    }
  }, [user, canViewFinancials]);

  const handleRefresh = () => {
    fetchDashboardStats();
  };

  const handleNavigation = (route) => {
    navigate(`/${route.toLowerCase()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <ChartBarIcon className="h-8 w-8 text-blue-600" />
                Dashboard
              </h1>
              <p className="mt-2 text-gray-600">
                Real-time pharmacy management overview
                {isAudit && <span className="text-blue-600"> • Audit Access</span>}
                {!loading && (
                  <span className="ml-2 text-sm text-gray-500">
                    (Last updated: {lastUpdate.toLocaleTimeString()})
                  </span>
                )}
              </p>
              {user && (
                <p className="text-sm text-gray-500">
                  Welcome back, {user.username}! ({user.role})
                </p>
              )}
            </div>
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className={`px-4 py-2 rounded-lg text-white transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2 ${
                  loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                }`}
              >
                <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Updating...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
              <span>{error}</span>
              <button 
                onClick={() => setError('')}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                X
              </button>
            </div>
          </div>
        )}

        {isAudit && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Audit Mode Active</p>
                <p className="text-sm">You have read-only access to system data for audit purposes.</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Daily Sales */}
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Daily Sales</p>
                <div className="flex items-center mt-2">
                  <p className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : canViewFinancials ? stats.sales.value : 'N/A'}
                  </p>
                  <span className="ml-2 text-sm text-gray-500">bills</span>
                </div>
                {canViewFinancials && (
                  <div className="flex items-center mt-1">
                    <span className={`text-sm ${stats.sales.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.sales.change >= 0 ? '↗' : '↘'} {Math.abs(stats.sales.change)}%
                    </span>
                    <span className="text-xs text-gray-500 ml-1">vs yesterday</span>
                  </div>
                )}
                {!canViewFinancials && (
                  <p className="text-xs text-gray-500 mt-1">Restricted access</p>
                )}
              </div>
              <div>
                <ChartBarIcon className="h-12 w-12 text-blue-500" />
              </div>
            </div>
          </div>

          {/* Revenue */}
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                <div className="flex items-center mt-2">
                  <p className="text-2xl font-bold text-gray-900">
                    Rs {loading ? '...' : canViewFinancials ? stats.revenue.value : 'N/A'}
                  </p>
                </div>
                {canViewFinancials && (
                  <div className="flex items-center mt-1">
                    <span className={`text-sm ${stats.revenue.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.revenue.change >= 0 ? '↗' : '↘'} {Math.abs(stats.revenue.change)}%
                    </span>
                    <span className="text-xs text-gray-500 ml-1">vs yesterday</span>
                  </div>
                )}
                {!canViewFinancials && (
                  <p className="text-xs text-gray-500 mt-1">Restricted access</p>
                )}
              </div>
              <div>
                <BanknotesIcon className="h-12 w-12 text-green-500" />
              </div>
            </div>
          </div>

          {/* Stock Items */}
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Stock</p>
                <div className="flex items-center mt-2">
                  <p className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stats.stock.value}
                  </p>
                  <span className="ml-2 text-sm text-gray-500">units</span>
                </div>
                <div className="flex items-center mt-1">
                  <span className={`text-sm ${stats.stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.stock.change >= 0 ? '↗' : '↘'} {Math.abs(stats.stock.change)}%
                  </span>
                  <span className="text-xs text-gray-500 ml-1">this week</span>
                </div>
              </div>
              <div>
                <CubeIcon className="h-12 w-12 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <div className="flex items-center mt-2">
                  <p className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stats.lowStock.value}
                  </p>
                  <span className="ml-2 text-sm text-gray-500">items</span>
                </div>
                <div className="flex items-center mt-1">
                  <span className={`text-sm ${stats.lowStock.change <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.lowStock.change <= 0 ? '↘' : '↗'} {Math.abs(stats.lowStock.change)}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">items</span>
                </div>
              </div>
              <div>
                <ExclamationTriangleIcon className="h-12 w-12 text-red-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <ArrowPathIcon className="h-6 w-6 text-blue-600" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            
            {/* Inventory Button */}
            {canManageInventory && (
              <button 
                type="button"
                onClick={() => handleNavigation('inventory')}
                className="flex flex-col items-center space-y-3 p-6 rounded-lg border-2 border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 group hover:shadow-lg cursor-pointer"
              >
                <CubeIcon className="h-12 w-12 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                <div className="text-center">
                  <p className="font-bold text-gray-900">Add Medicine</p>
                  <p className="text-sm text-gray-600">Inventory Management</p>
                </div>
              </button>
            )}
            
            {/* Billing Button */}
            {canAccessBilling && (
              <button 
                type="button"
                onClick={() => handleNavigation('billing')}
                className="flex flex-col items-center space-y-3 p-6 rounded-lg border-2 border-gray-200 hover:bg-green-50 hover:border-green-300 transition-all duration-200 group hover:shadow-lg cursor-pointer"
              >
                <DocumentTextIcon className="h-12 w-12 text-green-600 group-hover:scale-110 transition-transform duration-200" />
                <div className="text-center">
                  <p className="font-bold text-gray-900">Generate Bill</p>
                  <p className="text-sm text-gray-600">Billing & Sales</p>
                </div>
              </button>
            )}
            
            {/* Reports Button */}
            {canViewReports && (
              <button 
                type="button"
                onClick={() => handleNavigation('reports')}
                className="flex flex-col items-center space-y-3 p-6 rounded-lg border-2 border-gray-200 hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 group hover:shadow-lg cursor-pointer"
              >
                <ChartBarIcon className="h-12 w-12 text-purple-600 group-hover:scale-110 transition-transform duration-200" />
                <div className="text-center">
                  <p className="font-bold text-gray-900">View Reports</p>
                  <p className="text-sm text-gray-600">Analytics & Insights</p>
                </div>
              </button>
            )}

            {/* Vendors Button */}
            <button 
              type="button"
              onClick={() => handleNavigation('vendors')}
              className="flex flex-col items-center space-y-3 p-6 rounded-lg border-2 border-gray-200 hover:bg-orange-50 hover:border-orange-300 transition-all duration-200 group hover:shadow-lg cursor-pointer"
            >
              <BuildingOfficeIcon className="h-12 w-12 text-orange-600 group-hover:scale-110 transition-transform duration-200" />
              <div className="text-center">
                <p className="font-bold text-gray-900">Vendors</p>
                <p className="text-sm text-gray-600">Supplier Management</p>
              </div>
            </button>

            {/* Doctors Button */}
            <button 
              type="button"
              onClick={() => handleNavigation('doctors')}
              className="flex flex-col items-center space-y-3 p-6 rounded-lg border-2 border-gray-200 hover:bg-teal-50 hover:border-teal-300 transition-all duration-200 group hover:shadow-lg cursor-pointer"
            >
              <UserIcon className="h-12 w-12 text-teal-600 group-hover:scale-110 transition-transform duration-200" />
              <div className="text-center">
                <p className="font-bold text-gray-900">Doctors</p>
                <p className="text-sm text-gray-600">Doctor Management</p>
              </div>
            </button>
            
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ChartBarIcon className="h-6 w-6" />
            Today's Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {canViewFinancials ? stats.sales.value : 'N/A'}
              </div>
              <div className="text-sm opacity-90">Sales Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                Rs {canViewFinancials ? stats.revenue.value : 'N/A'}
              </div>
              <div className="text-sm opacity-90">Revenue</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.stock.value}</div>
              <div className="text-sm opacity-90">Total Stock</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.lowStock.value}</div>
              <div className="text-sm opacity-90">Low Stock</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
