import React, { useState, useEffect } from 'react';
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid';

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
  const canCreate = isAdmin || isPharmacist;
  const canUpdate = isAdmin || isPharmacist;
  const canDelete = isAdmin;
  const canSell = isAdmin || isPharmacist;

  return {
    currentUser,
    currentUserRole,
    isAudit,
    isAdmin,
    isPharmacist,
    canCreate,
    canUpdate,
    canDelete,
    canSell
  };
};

export default function Inventory({ setCurrentScreen, user, onLogout }) {
  const { isAudit, canCreate, canUpdate, canDelete, canSell } = useAuth();

  const [inventory, setInventory] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    tax: '',
    vendor_id: '',
    batch_no: '',
    expiry_date: '',
    qty: '',
    cost: '',
    price: ''
  });

  const LOW_STOCK_LIMIT = 10;
  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

  const handleNavigation = (screen) => {
    if (setCurrentScreen) {
      setCurrentScreen(screen);
    }
  };

  const isExpired = (date) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const filteredInventory = inventory.filter(item =>
    (item.product_name || item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.batch_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = getAuthToken();
      
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }
      
      const res = await fetch(`${API}/api/inventory`, {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          onLogout && onLogout();
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }
      
      const data = await res.json();
      setInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Failed to fetch inventory. Please check server connection.");
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      
      const res = await fetch(`${API}/api/vendors`, {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      
      const data = await res.json();
      
      let vendorsList = [];
      if (Array.isArray(data)) {
        vendorsList = data;
      } else if (data.success && Array.isArray(data.vendors)) {
        vendorsList = data.vendors;
      } else if (data.vendors && Array.isArray(data.vendors)) {
        vendorsList = data.vendors;
      }
      
      setVendors(vendorsList);
    } catch (err) {
      setVendors([]);
    }
  };

  useEffect(() => {
    if (user) {
      fetchInventory();
      fetchVendors();
    }
  }, [user]);

  const resetForm = () => {
    setFormData({
      name: '',
      unit: '',
      tax: '',
      vendor_id: '',
      batch_no: '',
      expiry_date: '',
      qty: '',
      cost: '',
      price: ''
    });
    setIsEditing(false);
    setEditId(null);
    setError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name?.trim() || !formData.vendor_id || !formData.batch_no?.trim()) {
      setError("Product name, vendor, and batch number are required");
      return;
    }

    try {
      setError('');
      const url = isEditing 
        ? `${API}/api/inventory/${editId}`
        : `${API}/api/inventory`;
      
      const method = isEditing ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData,
          qty: parseInt(formData.qty) || 0,
          cost: parseFloat(formData.cost) || 0,
          price: parseFloat(formData.price) || 0,
          tax: parseFloat(formData.tax) || 0
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          onLogout && onLogout();
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const result = await res.json();
      if (result.success) {
        alert(`Product ${isEditing ? 'updated' : 'added'} successfully!`);
        resetForm();
        setShowForm(false);
        fetchInventory();
      } else {
        setError(result.error || `Failed to ${isEditing ? 'update' : 'add'} product`);
      }
    } catch (err) {
      setError(`Failed to ${isEditing ? 'update' : 'add'} product. Please try again.`);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      name: item.product_name || '',
      unit: item.unit || '',
      tax: item.tax || '',
      vendor_id: item.vendor_id || '',
      batch_no: item.batch_no || '',
      expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '',
      qty: item.qty || '',
      cost: item.cost || '',
      price: item.price || ''
    });
    setIsEditing(true);
    setEditId(item.batch_id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (batchId, productName) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}"?`)) return;

    try {
      setError('');
      const res = await fetch(`${API}/api/inventory/${batchId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        if (res.status === 401) {
          onLogout && onLogout();
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const result = await res.json();
      if (result.success) {
        alert("Product deleted successfully!");
        fetchInventory();
      } else {
        setError(result.error || "Failed to delete product");
      }
    } catch (err) {
      setError("Failed to delete product. Please try again.");
    }
  };

  const handleSell = async (batchId) => {
    try {
      const batchItem = inventory.find(item => item.batch_id === batchId);
      if (!batchItem) {
        alert('Product not found');
        return;
      }

      if (batchItem.qty <= 0) {
        alert('This product is out of stock');
        return;
      }

      const maxQty = batchItem.qty;
      const quantity = parseInt(prompt(`Enter quantity to sell (Max: ${maxQty}):`), 10);

      if (!quantity || quantity <= 0) {
        alert("Invalid quantity");
        return;
      }

      if (quantity > maxQty) {
        alert(`Cannot sell ${quantity} items. Only ${maxQty} available.`);
        return;
      }

      setError('');
      const res = await fetch(`${API}/api/inventory/sell/${batchId}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ quantity }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          onLogout && onLogout();
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success) {
        const saleValue = (quantity * (batchItem?.price || 0)).toFixed(2);
        alert(`${quantity} ${batchItem.unit || 'units'} of ${batchItem.product_name} sold successfully! Sale Value: Rs ${saleValue}`);
        fetchInventory();
        
        const confirmBill = window.confirm("Do you want to go to billing section for this sale?");
        if (confirmBill) {
          handleNavigation('billing');
        }
      } else {
        setError(data.error || 'Failed to sell product');
      }
    } catch (err) {
      setError("Failed to sell product. Please check server connection.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-green-700">
              Inventory Management
              {isAudit && <span className="text-blue-600 text-sm font-normal"> • Read-only access</span>}
            </h1>
          </div>
          {canCreate && (
            <button
              onClick={() => {
                resetForm();
                setIsEditing(false);
                setShowForm(!showForm);
              }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              {showForm ? 'Cancel' : 'Add Product'}
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {isAudit && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Audit Mode Active</p>
                <p className="text-sm">You have read-only access to inventory data. Contact administrator for inventory management permissions.</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products, batches, or vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{inventory.length}</div>
            <div className="text-sm text-blue-800">Total Items</div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-600">
              {inventory.filter(item => isExpired(item.expiry_date)).length}
            </div>
            <div className="text-sm text-red-800">Expired Items</div>
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

        {showForm && canCreate && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow-md border">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              {isEditing ? 'Edit Product' : 'Add New Product'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Product Name *"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                />
                <select
                  name="vendor_id"
                  value={formData.vendor_id}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select Vendor *</option>
                  {vendors.map(vendor => (
                    <option key={vendor.uuid} value={vendor.uuid}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="batch_no"
                  placeholder="Batch Number *"
                  value={formData.batch_no}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <input
                  type="text"
                  name="unit"
                  placeholder="Unit (e.g., tablets, ml)"
                  value={formData.unit}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  name="qty"
                  placeholder="Quantity"
                  value={formData.qty}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  min="0"
                />
                <input
                  type="number"
                  name="cost"
                  placeholder="Cost Price"
                  value={formData.cost}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  min="0"
                  step="0.01"
                />
                <input
                  type="number"
                  name="price"
                  placeholder="Selling Price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="date"
                  name="expiry_date"
                  placeholder="Expiry Date"
                  value={formData.expiry_date}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  name="tax"
                  placeholder="Tax Rate (%)"
                  value={formData.tax}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg font-medium transition-colors"
                >
                  {isEditing ? 'Update Product' : 'Save Product'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.length > 0 ? (
                  filteredInventory.map((item, index) => (
                    <tr 
                      key={item.batch_id || `item-${index}`}
                      className={`hover:bg-gray-50 ${
                        isExpired(item.expiry_date) ? 'bg-red-50' : 
                        item.qty <= LOW_STOCK_LIMIT ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                          <div className="text-sm text-gray-500">ID: {item.product_id}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.vendor_name || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.batch_no}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          {item.unit || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          item.qty <= 0 ? 'text-red-600' : 
                          item.qty <= LOW_STOCK_LIMIT ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {item.qty}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        Rs {item.price}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`text-sm ${isExpired(item.expiry_date) ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                          {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          {canSell && (
                            <button
                              onClick={() => handleSell(item.batch_id)}
                              disabled={item.qty <= 0}
                              className={`px-3 py-1 rounded text-xs ${
                                item.qty <= 0 
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              Sell
                            </button>
                          )}
                          {canUpdate && (
                            <button
                              onClick={() => handleEdit(item)}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(item.batch_id, item.product_name)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                            >
                              Delete
                            </button>
                          )}
                          {isAudit && (
                            <span className="text-gray-400 text-xs px-2 py-1 bg-gray-100 rounded">
                              View Only
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                      <div className="text-xl mb-4">No inventory items found</div>
                      <p className="text-lg">
                        {searchTerm ? 'No products found matching your search.' : 'Add some products to get started!'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}