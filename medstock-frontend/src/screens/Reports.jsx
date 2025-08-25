import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { HomeIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
// Simple Toast component
function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in">
      <span className="font-semibold">Success:</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 text-white hover:text-gray-200 font-bold">×</button>
    </div>
  );
}

import { API, apiCall, apiCallJSON } from '../utils/api';

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
  const canViewReports = isAdmin || isAudit || isPharmacist;
  const canViewFinancials = isAdmin || isAudit;
  const canViewStock = isAdmin || isPharmacist || isAudit;

  return {
    currentUser,
    currentUserRole,
    isAudit,
    isAdmin,
    isPharmacist,
    canViewReports,
    canViewFinancials,
    canViewStock
  };
};




export default function Reports({ setCurrentScreen, user, onLogout }) {
  // Section selector state
  const reportSections = [
    { key: 'daily', label: 'Daily Sales Overview' },
    { key: 'weekly', label: 'Weekly Sales Performance' },
    { key: 'monthly', label: 'Monthly Sales Summary' },
    { key: 'doctorWise', label: 'Doctor Wise Sales Analysis' },
    { key: 'vendorWise', label: 'Vendor Performance Report' },
    { key: 'stock', label: 'Current Stock Levels' },
    { key: 'expiry', label: 'Expiry Alert (Next 30 Days)' }
  ];
  const [selectedSection, setSelectedSection] = useState('daily');
  // Toast state for success messages
  const [toastMsg, setToastMsg] = useState("");
  // Always get the latest user from localStorage, not from props
  const auth = useAuth();
  const { canViewReports, canViewFinancials, canViewStock, isAudit, currentUser } = auth;

  const [dailySales, setDailySales] = useState({});
  const [weeklySales, setWeeklySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [doctorWise, setDoctorWise] = useState([]);
  const [vendorWise, setVendorWise] = useState([]);
  const [stock, setStock] = useState([]);
  const [expiry, setExpiry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleNavigation = (screen) => {
    if (setCurrentScreen) {
      setCurrentScreen(screen);
    }
  };

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
      } catch (err) {}
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

  // Only fetch reports after currentUser is loaded and permissions are known
  useEffect(() => {
    if (currentUser && canViewReports) {
      fetchReports();
    }
  }, [currentUser, canViewReports]);

  async function fetchReports(showToast) {
    try {
      setLoading(true);
      setError("");
      
      // Check permissions first
      if (!canViewReports) {
        setError('Access denied - insufficient permissions for reports');
        setLoading(false);
        return;
      }
      
      const token = getAuthToken();
      if (!token) {
        setError('Authentication required. Please login again.');
        return;
      }
      
      // Enhanced daily sales fetch with multiple methods
      const fetchDailySales = async () => {
        try {
          // Method 1: Try dedicated daily sales endpoint
          const dailyData = await apiCallJSON('/api/reports/sales/daily', { 
            headers: getAuthHeaders() 
          });
          
          return dailyData;
          
        } catch (err) {
          console.log('Daily sales endpoint failed, trying bills endpoint...');
          
          try {
            // Method 2: If daily endpoint fails, calculate from bills
            const billsData = await apiCallJSON('/api/billing', { 
              headers: getAuthHeaders() 
            });
            
            const bills = Array.isArray(billsData) ? billsData : (billsData.bills || []);
            
            // Calculate today's sales from bills
            const today = new Date().toDateString();
            const todaysBills = bills.filter(bill => 
              new Date(bill.created_at).toDateString() === today
            );
            
            const calculatedDaily = {
              sales: todaysBills.reduce((sum, bill) => {
                const items = Array.isArray(bill.items) ? bill.items : 
                  (typeof bill.items === 'string' ? JSON.parse(bill.items) : []);
                return sum + items.reduce((itemSum, item) => itemSum + (parseInt(item.quantity) || 0), 0);
              }, 0),
              revenue: todaysBills.reduce((sum, bill) => sum + parseFloat(bill.total || 0), 0),
              transactions: todaysBills.length,
              date: new Date().toISOString().split('T')[0]
            };
            
            return calculatedDaily;
            
          } catch (billsErr) {
            console.error('Both daily sales and bills endpoints failed:', billsErr);
            // Return default structure
            return {
              sales: 0,
              revenue: 0,
              transactions: 0,
              date: new Date().toISOString().split('T')[0]
            };
          }
        }
      };

      // Fetch daily sales first
      const dailyData = await fetchDailySales();
      setDailySales(dailyData);

      // Fetch other reports based on permissions
      const endpoints = [];
      if (canViewFinancials) {
        endpoints.push(
          { endpoint: '/api/reports/sales/weekly', setter: setWeeklySales, name: 'Weekly Sales' },
          { endpoint: '/api/reports/sales/monthly', setter: setMonthlySales, name: 'Monthly Sales' },
          { endpoint: '/api/reports/doctor-wise', setter: setDoctorWise, name: 'Doctor Wise' },
          { endpoint: '/api/reports/vendor-wise', setter: setVendorWise, name: 'Vendor Wise' }
        );
      }
      if (canViewStock) {
        endpoints.push(
          { endpoint: '/api/reports/stock', setter: setStock, name: 'Stock Report' },
          { endpoint: '/api/reports/stock-expiry', setter: setExpiry, name: 'Expiry Report' }
        );
      }
      for (const endpointInfo of endpoints) {
        try {
          const data = await apiCallJSON(endpointInfo.endpoint, { 
            headers: getAuthHeaders() 
          });
          const processedData = Array.isArray(data) ? data : [];
          endpointInfo.setter(processedData);
        } catch (err) {
          console.error(`${endpointInfo.name} fetch failed:`, err);
          if (err.message.includes('401')) {
            onLogout && onLogout();
            return;
          }
          endpointInfo.setter([]);
        }
      }
      // Show toast if requested
      if (showToast) setToastMsg('Reports refreshed successfully!');
    } catch (err) {
      setError(`Failed to fetch reports: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const Section = ({ title, data, columns, isDaily = false, requiresFinancialAccess = false, requiresStockAccess = false }) => {
    // Check permissions for specific sections
    if (requiresFinancialAccess && !canViewFinancials) {
      return (
        <div className="bg-white shadow-lg rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-600 flex items-center gap-2">
            {title}
          </h2>
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🔒</div>
            <div>Access restricted - Financial data requires admin or audit permissions</div>
          </div>
        </div>
      );
    }

    if (requiresStockAccess && !canViewStock) {
      return (
        <div className="bg-white shadow-lg rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-600 flex items-center gap-2">
            {title}
          </h2>
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🔒</div>
            <div>Access restricted - Stock data requires appropriate permissions</div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white shadow-lg rounded-xl p-4 sm:p-6 mb-6">
        <h2 className="text-lg sm:text-xl font-bold mb-4 text-blue-600 flex items-center gap-2">
          {title}
        </h2>
        
        {isDaily ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 sm:p-4 rounded-lg text-center border border-blue-200">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">{dailySales.sales || 0}</div>
              <div className="text-xs sm:text-sm text-blue-800 font-medium">Items Sold</div>
            </div>
            <div className="bg-green-50 p-3 sm:p-4 rounded-lg text-center border border-green-200">
              <div className="text-2xl sm:text-3xl font-bold text-green-600">Rs {(dailySales.revenue || 0).toFixed(2)}</div>
              <div className="text-xs sm:text-sm text-green-800 font-medium">Revenue</div>
            </div>
            <div className="bg-purple-50 p-3 sm:p-4 rounded-lg text-center border border-purple-200">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600">{dailySales.transactions || 0}</div>
              <div className="text-xs sm:text-sm text-purple-800 font-medium">Transactions</div>
            </div>
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg text-center border border-gray-200">
              <div className="text-base sm:text-lg font-bold text-gray-600">
                {dailySales.date || new Date().toISOString().split('T')[0]}
              </div>
              <div className="text-xs sm:text-sm text-gray-800 font-medium">Date</div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="border px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-700 uppercase tracking-wider"
                    >
                      {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data && data.length > 0 ? (
                  data.map((row, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors">
                      {columns.map((col) => {
                        const value = row[col.toLowerCase()] || row[col] || "-";
                        return (
                          <td key={col} className="border px-4 py-3">
                            {typeof value === 'number' && (col.includes('value') || col.includes('cost') || col.includes('price') || col.includes('revenue')) ? (
                              <span className="font-medium text-green-600">Rs {value.toFixed(2)}</span>
                            ) : col.includes('qty') && typeof value === 'number' ? (
                              <span className={`font-medium ${value <= 10 ? 'text-red-600' : 'text-gray-900'}`}>
                                {value}
                              </span>
                            ) : col.includes('date') && value !== '-' ? (
                              <span className="text-gray-700">
                                {new Date(value).toLocaleDateString()}
                              </span>
                            ) : col.includes('status') ? (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                value === 'Expired' ? 'bg-red-100 text-red-800' :
                                value === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' :
                                value === 'Out of Stock' ? 'bg-gray-100 text-gray-800' :
                                value === 'Expires This Week' ? 'bg-orange-100 text-orange-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {value}
                              </span>
                            ) : (
                              value
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="text-center text-gray-500 py-8"
                    >
                      <div className="text-4xl mb-2">📭</div>
                      <div>No data available</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Wait for currentUser to load before showing access denied
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-md">
          <div className="text-6xl mb-4">🔄</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading user...</h2>
        </div>
      </div>
    );
  }

  if (!canViewReports) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Restricted</h2>
          <p className="text-gray-600 mb-4">You don't have permission to view reports.</p>
          <button
            onClick={() => handleNavigation('dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading reports...</p>
        </div>
        <Toast message={toastMsg} onClose={() => setToastMsg("")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast message={toastMsg} onClose={() => setToastMsg("")} />
      <div className="bg-white shadow-sm border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => handleNavigation('dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors text-sm sm:text-base"
            >
              <HomeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              Dashboard
            </button>
            <span className="text-gray-400">/</span>
            <h1 className="text-lg sm:text-xl font-bold text-blue-700">
              Reports & Analytics
              {isAudit && <span className="text-blue-600 text-sm font-normal block sm:inline"> • Audit Access</span>}
            </h1>
          </div>
          <button
            onClick={() => fetchReports(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg shadow transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
            disabled={loading}
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Section selector dropdown */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2 items-center">
            <span className="text-gray-700 font-medium">Select Report:</span>
            <select
              value={selectedSection}
              onChange={e => setSelectedSection(e.target.value)}
              className="py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
            >
              {reportSections.map(sec => (
                <option key={sec.key} value={sec.key}>{sec.label}</option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <span className="text-red-500 mr-2">Error:</span>
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

        {/* Enhanced Business Summary */}
        {/* Only show selected report section with graph and table */}
        {selectedSection === 'daily' && (
          <>
            {/* Professional BarChart for Daily Sales */}
            <div className="mb-6 bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Daily Sales Graph</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[dailySales]} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" fill="#2563eb" name="Items Sold" />
                  <Bar dataKey="revenue" fill="#22c55e" name="Revenue" />
                  <Bar dataKey="transactions" fill="#a21caf" name="Transactions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Table below graph */}
            <Section
              title="Daily Sales Overview"
              data={[dailySales]}
              columns={["sales", "revenue", "transactions", "date"]}
              isDaily={true}
              requiresFinancialAccess={true}
            />
          </>
        )}
        {selectedSection === 'weekly' && (
          <>
            <div className="mb-6 bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Weekly Sales Graph</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklySales} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sale_date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#22c55e" name="Revenue" />
                  <Line type="monotone" dataKey="quantity" stroke="#2563eb" name="Quantity" />
                  <Line type="monotone" dataKey="transactions" stroke="#a21caf" name="Transactions" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Section
              title="Weekly Sales Performance"
              data={weeklySales}
              columns={["sale_date", "transactions", "quantity", "revenue"]}
              requiresFinancialAccess={true}
            />
          </>
        )}
        {selectedSection === 'monthly' && (
          <>
            <div className="mb-6 bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Monthly Sales Graph</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlySales} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#22c55e" name="Revenue" />
                  <Line type="monotone" dataKey="quantity" stroke="#2563eb" name="Quantity" />
                  <Line type="monotone" dataKey="transactions" stroke="#a21caf" name="Transactions" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Section
              title="Monthly Sales Summary"
              data={monthlySales}
              columns={["month", "transactions", "quantity", "revenue"]}
              requiresFinancialAccess={true}
            />
          </>
        )}
        {selectedSection === 'doctorWise' && (
          <>
            <div className="mb-6 bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Doctor Wise Sales Graph</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={doctorWise} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="doctor_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="prescriptions" fill="#2563eb" name="Prescriptions" />
                  <Bar dataKey="total_value" fill="#22c55e" name="Total Value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Section
              title="Doctor Wise Sales Analysis"
              data={doctorWise}
              columns={["doctor_name", "prescriptions", "total_value"]}
              requiresFinancialAccess={true}
            />
          </>
        )}
        {selectedSection === 'vendorWise' && (
          <>
            <div className="mb-6 bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Vendor Performance Graph</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vendorWise} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="vendor_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_products" fill="#2563eb" name="Total Products" />
                  <Bar dataKey="total_stock" fill="#a21caf" name="Total Stock" />
                  <Bar dataKey="stock_value" fill="#22c55e" name="Stock Value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Section
              title="Vendor Performance Report"
              data={vendorWise}
              columns={["vendor_name", "contact", "total_products", "total_stock", "stock_value"]}
              requiresFinancialAccess={true}
            />
          </>
        )}
        {selectedSection === 'stock' && (
          <>
            <div className="mb-6 bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Current Stock Levels Graph</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stock} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="product_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="qty" fill="#2563eb" name="Quantity" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Section
              title="Current Stock Levels"
              data={stock}
              columns={["product_name", "unit", "vendor_name", "batch_no", "qty", "stock_status"]}
              requiresStockAccess={true}
            />
          </>
        )}
        {selectedSection === 'expiry' && (
          <>
            <div className="mb-6 bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Expiry Alert Graph</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={expiry} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="product_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="qty" fill="#f59e42" name="Quantity" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Section
              title="Expiry Alert (Next 30 Days)"
              data={expiry}
              columns={["product_name", "vendor_name", "batch_no", "qty", "expiry_date", "expiry_status"]}
              requiresStockAccess={true}
            />
          </>
        )}

        <Section
          title="Daily Sales Overview"
          data={dailySales}
          columns={["sales", "revenue", "transactions", "date"]}
          isDaily={true}
          requiresFinancialAccess={true}
        />
        
        <Section
          title="Weekly Sales Performance"
          data={weeklySales}
          columns={["sale_date", "transactions", "quantity", "revenue"]}
          requiresFinancialAccess={true}
        />
        
        <Section
          title="Monthly Sales Summary"
          data={monthlySales}
          columns={["month", "transactions", "quantity", "revenue"]}
          requiresFinancialAccess={true}
        />

        <Section
          title="Doctor Wise Sales Analysis"
          data={doctorWise}
          columns={["doctor_name", "prescriptions", "total_value"]}
          requiresFinancialAccess={true}
        />

        <Section
          title="Vendor Performance Report"
          data={vendorWise}
          columns={["vendor_name", "contact", "total_products", "total_stock", "stock_value"]}
          requiresFinancialAccess={true}
        />

        <Section
          title="Current Stock Levels"
          data={stock}
          columns={["product_name", "unit", "vendor_name", "batch_no", "qty", "stock_status"]}
          requiresStockAccess={true}
        />

        <Section
          title="Expiry Alert (Next 30 Days)"
          data={expiry}
          columns={["product_name", "vendor_name", "batch_no", "qty", "expiry_date", "expiry_status"]}
          requiresStockAccess={true}
        />

        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center text-gray-600">
            <p className="text-sm">
              Report generated on {new Date().toLocaleString()} | 
              Access Level: {isAudit ? 'Audit' : canViewFinancials ? 'Financial' : 'Basic'} | 
              {canViewFinancials && `Daily Sales: ${dailySales.sales || 0} items, Rs ${(dailySales.revenue || 0).toFixed(2)} revenue`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}