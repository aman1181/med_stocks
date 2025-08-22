import React, { useEffect, useState } from "react";
import { HomeIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
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
  const { canViewReports, canViewFinancials, canViewStock, isAudit } = useAuth();

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

  useEffect(() => {
    if (user && canViewReports) {
      fetchReports();
    }
  }, [user, canViewReports]);

  async function fetchReports() {
    try {
      setLoading(true);
      setError("");
      
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

  // Check if user has permission to view reports
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            onClick={fetchReports}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg shadow transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
            disabled={loading}
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6">
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
        {canViewFinancials && (
          <div className="mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold mb-4">Today's Business Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                <div className="text-3xl font-bold">{dailySales.sales || 0}</div>
                <div className="text-sm opacity-90">Items Sold</div>
              </div>
              <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                <div className="text-3xl font-bold">{dailySales.transactions || 0}</div>
                <div className="text-sm opacity-90">Transactions</div>
              </div>
              <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                <div className="text-3xl font-bold">Rs {(dailySales.revenue || 0).toFixed(2)}</div>
                <div className="text-sm opacity-90">Revenue</div>
              </div>
              <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                <div className="text-3xl font-bold">{stock.length}</div>
                <div className="text-sm opacity-90">Products</div>
              </div>
            </div>
          </div>
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