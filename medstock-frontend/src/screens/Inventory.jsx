import React, { useState, useEffect } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { Toast, useToast } from '../components/ToastContext.jsx';
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid';
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
  // Vendor filter and sorting state
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [sortField, setSortField] = useState('product_name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const { isAudit, canCreate, canUpdate, canDelete, canSell } = useAuth();
  const { showToast } = useToast();


  // ...existing code...

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

  // Filter by search and selected vendor
  let filteredInventory = inventory.filter(item =>
    ((item.product_name || item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.batch_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!selectedVendor || item.vendor_id === selectedVendor.uuid)
  );

  // Sort filtered inventory
  filteredInventory = filteredInventory.sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = getAuthToken();
      
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }
      
      const data = await apiCallJSON('/api/inventory', {
        headers: getAuthHeaders()
      });
      
      setInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch inventory error:', err);
      if (err.message.includes('401')) {
        onLogout && onLogout();
        return;
      }
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
      
      const data = await apiCallJSON('/api/vendors', {
        headers: getAuthHeaders()
      });
      
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
      console.error('Fetch vendors error:', err);
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
  // Example: setToastMsg('Inventory updated successfully!'); after successful inventory action
    
    if (!formData.name?.trim() || !formData.vendor_id || !formData.batch_no?.trim()) {
      setError("Product name, vendor, and batch number are required");
      return;
    }

    try {
      setError('');
      const endpoint = isEditing 
        ? `/api/inventory/${editId}`
        : `/api/inventory`;
      
      const method = isEditing ? "PUT" : "POST";
      
      console.log(`📦 ${isEditing ? 'Updating' : 'Adding'} product:`, {
        endpoint,
        method,
        data: {
          ...formData,
          qty: parseInt(formData.qty) || 0,
          cost: parseFloat(formData.cost) || 0,
          price: parseFloat(formData.price) || 0,
          tax: parseFloat(formData.tax) || 0
        }
      });
      
      const result = await apiCallJSON(endpoint, {
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

      console.log(`📦 Product ${isEditing ? 'update' : 'add'} result:`, result);
      
      if (result && result.success) {
        showToast(`Product ${isEditing ? 'updated' : 'added'} successfully!`);
        // Show a visible toast popup for 4 seconds
        // Toast is already rendered at the bottom of the component
        resetForm();
        setShowForm(false);
        setTimeout(() => fetchInventory(), 4000);
      } else {
        setError(result?.error || `Failed to ${isEditing ? 'update' : 'add'} product`);
      }
    } catch (err) {
      console.error(`Product ${isEditing ? 'update' : 'add'} error:`, err);
      if (err.message.includes('401')) {
        onLogout && onLogout();
        return;
      }
      setError(`Failed to ${isEditing ? 'update' : 'add'} product: ${err.message}`);
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
      const result = await apiCallJSON(`/api/inventory/${batchId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      if (result && result.success) {
  showToast("Product deleted successfully!");
  setTimeout(() => fetchInventory(), 4000);
      } else {
        setError(result?.error || "Failed to delete product");
      }
    } catch (err) {
      console.error('Delete product error:', err);
      if (err.message.includes('401')) {
        onLogout && onLogout();
        return;
      }
      setError(`Failed to delete product: ${err.message}`);
    }
  };

  const handleSell = async (batchId) => {
    try {
      const batchItem = inventory.find(item => item.batch_id === batchId);
      if (!batchItem) {
  showToast('Product not found');
        return;
      }

      if (batchItem.qty <= 0) {
  showToast('This product is out of stock');
        return;
      }

      const maxQty = batchItem.qty;
      const quantity = parseInt(prompt(`Enter quantity to sell (Max: ${maxQty}):`), 10);

      if (!quantity || quantity <= 0) {
  showToast("Invalid quantity");
        return;
      }

      if (quantity > maxQty) {
  showToast(`Cannot sell ${quantity} items. Only ${maxQty} available.`);
        return;
      }

      setError('');
      const data = await apiCallJSON(`/api/inventory/sell/${batchId}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ quantity }),
      });
      
      if (data && data.success) {
  const saleValue = (quantity * (batchItem?.price || 0)).toFixed(2);
  showToast(`${quantity} ${batchItem.unit || 'units'} of ${batchItem.product_name} sold successfully! Sale Value: Rs ${saleValue}`);
  setTimeout(() => fetchInventory(), 4000);
        
        const confirmBill = window.confirm("Do you want to go to billing section for this sale?");
        if (confirmBill) {
          handleNavigation('billing');
        }
      } else {
        setError(data?.error || 'Failed to sell product');
      }
    } catch (err) {
      console.error('Sell product error:', err);
      if (err.message.includes('401')) {
        onLogout && onLogout();
        return;
      }
      setError(`Failed to sell product: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inventory...</p>
        </div>
        <Toast />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        {/* Header and navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gradient-to-r from-green-50 via-white to-blue-50 rounded-b-xl shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-lg sm:text-xl font-bold text-green-700">
              Inventory Management
              {isAudit && <span className="text-blue-600 text-sm font-normal block sm:inline"> • Read-only access</span>}
            </h1>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Vendor Filter */}
            <div className="flex flex-col items-start">
              <label className="text-xs font-semibold text-gray-600 mb-1 ml-1">Vendor</label>
              <Autocomplete
                options={[{ name: 'All Vendors', uuid: null }, ...vendors]}
                getOptionLabel={option => option.name || ''}
                value={selectedVendor || { name: 'All Vendors', uuid: null }}
                onChange={(event, newValue) => setSelectedVendor(newValue && newValue.uuid ? newValue : null)}
                renderInput={params => (
                  <TextField {...params}  variant="outlined" size="small" sx={{ background: '#fff', borderRadius: 8 }} />
                )}
                sx={{ minWidth: 220, maxWidth: 320 }}
              />
            </div>
            {/* Sorting Dropdown */}
            <div className="flex flex-col items-start">
              <label className="text-xs font-semibold text-gray-600 mb-1 ml-1">Sort By</label>
              <div className="flex items-center gap-2 bg-white rounded-lg px-2 py-1 border border-gray-200 shadow-sm">
                <select
                  value={sortField}
                  onChange={e => setSortField(e.target.value)}
                  className="border-none outline-none bg-transparent text-sm font-medium text-gray-700 px-1"
                >
                  <option value="product_name">Product Name</option>
                  <option value="qty">Quantity</option>
                  <option value="price">Price</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1 rounded text-sm font-bold text-gray-600 hover:bg-gray-100 transition"
                  title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                  style={{ minWidth: 32 }}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-4">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products, batches, or vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        {canCreate && (
          <button
            onClick={() => {
              resetForm();
              setIsEditing(false);
              setShowAddProductModal(true);
            }}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg shadow transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
          >
            <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            Add Product
          </button>
        )}
      </div>
      {showAddProductModal && canCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-blue-300 bg-opacity-50" onClick={() => setShowAddProductModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-xl xl:max-w-lg" style={{ width: '100%', maxWidth: '480px', maxHeight: '80vh', overflow: 'hidden', boxSizing: 'border-box' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Add New Product</h3>
              <button type="button" className="text-gray-400 hover:text-gray-600 focus:outline-none" onClick={() => setShowAddProductModal(false)} aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-3 sm:p-4 overflow-y-auto" style={{maxHeight: 'calc(80vh - 48px)'}}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Enter product name" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                  <Autocomplete
                    options={vendors}
                    getOptionLabel={option => option.name || ''}
                    value={vendors.find(v => v.uuid === formData.vendor_id) || null}
                    onChange={(event, newValue) => {
                      setFormData(prev => ({
                        ...prev,
                        vendor_id: newValue ? newValue.uuid : ''
                      }));
                    }}
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Search or select vendor"
                        variant="outlined"
                        required
                      />
                    )}
                    isOptionEqualToValue={(option, value) => option.uuid === value.uuid}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                  <input type="text" name="batch_no" value={formData.batch_no} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Enter batch number" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input type="text" name="unit" value={formData.unit} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Unit (e.g., tablets, ml)" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input type="number" name="qty" value={formData.qty} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Enter quantity" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                  <input type="number" name="cost" value={formData.cost} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Enter cost" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Enter price" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => { setShowAddProductModal(false); resetForm(); }} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-semibold">Cancel</button>
                  <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold">Add Product</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {isAudit && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      )}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="text-xl sm:text-2xl font-bold text-blue-600">{inventory.length}</div>
          <div className="text-xs sm:text-sm text-blue-800">Total Items</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg text-center">
          <div className="text-xl sm:text-2xl font-bold text-red-600">{inventory.filter(item => isExpired(item.expiry_date)).length}</div>
          <div className="text-xs sm:text-sm text-red-800">Expired Items</div>
        </div>
      </div>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">Error:</span>
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">X</button>
          </div>
        </div>
      )}
      {showForm && canCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-blue-300 bg-opacity-50" onClick={() => { setShowForm(false); setIsEditing(false); resetForm(); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-xl xl:max-w-lg" style={{ width: '100%', maxWidth: '480px', maxHeight: '80vh', overflow: 'hidden', boxSizing: 'border-box' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                {isEditing ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button type="button" className="text-gray-400 hover:text-gray-600 focus:outline-none" onClick={() => { setShowForm(false); setIsEditing(false); resetForm(); }} aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Title for edit modal */}
            {isEditing && (
              <div className="px-4 pt-2 pb-0">
                <h4 className="text-base font-semibold text-green-700">Editing Product Details</h4>
              </div>
            )}
            <div className="p-3 sm:p-4 overflow-y-auto" style={{maxHeight: 'calc(80vh - 48px)'}}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <h5 className="font-semibold text-green-700 mb-1">Product Name</h5>
                    <input type="text" name="name" placeholder="Product Name *" value={formData.name} onChange={handleInputChange} className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm sm:text-base w-full" required />
                  </div>
                  <div>
                    <h5 className="font-semibold text-green-700 mb-1">Vendor</h5>
                    <Autocomplete
                      options={vendors}
                      getOptionLabel={option => option.name || ''}
                      value={vendors.find(v => v.uuid === formData.vendor_id) || null}
                      onChange={(event, newValue) => {
                        setFormData(prev => ({
                          ...prev,
                          vendor_id: newValue ? newValue.uuid : ''
                        }));
                      }}
                      renderInput={params => (
                        <TextField
                          {...params}
                          label="Search or select vendor"
                          variant="outlined"
                          required
                        />
                      )}
                      isOptionEqualToValue={(option, value) => option.uuid === value.uuid}
                      sx={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <h5 className="font-semibold text-green-700 mb-1">Batch Number</h5>
                    <input type="text" name="batch_no" placeholder="Batch Number *" value={formData.batch_no} onChange={handleInputChange} className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm sm:text-base w-full" required />
                  </div>
                  <div>
                    <h5 className="font-semibold text-green-700 mb-1">Unit</h5>
                    <input type="text" name="unit" placeholder="Unit (e.g., tablets, ml)" value={formData.unit} onChange={handleInputChange} className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm sm:text-base w-full" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-green-700 mb-1">Quantity</h5>
                    <input type="number" name="qty" placeholder="Quantity" value={formData.qty} onChange={handleInputChange} className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm sm:text-base w-full" min="0" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-green-700 mb-1">Cost Price</h5>
                    <input type="number" name="cost" placeholder="Cost Price" value={formData.cost} onChange={handleInputChange} className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm sm:text-base w-full" min="0" step="0.01" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-green-700 mb-1">Selling Price</h5>
                    <input type="number" name="price" placeholder="Selling Price" value={formData.price} onChange={handleInputChange} className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm sm:text-base w-full" min="0" step="0.01" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-green-700 mb-1">Expiry Date</h5>
                    <input type="date" name="expiry_date" placeholder="Expiry Date" value={formData.expiry_date} onChange={handleInputChange} className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm sm:text-base w-full" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-green-700 mb-1">Tax Rate (%)</h5>
                    <input type="number" name="tax" placeholder="Tax Rate (%)" value={formData.tax} onChange={handleInputChange} className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm sm:text-base w-full" min="0" max="100" step="0.01" />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="submit" className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg font-medium transition-colors text-sm sm:text-base">{isEditing ? 'Update Product' : 'Save Product'}</button>
                  <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-lg font-medium transition-colors text-sm sm:text-base">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
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
                  <tr key={item.batch_id || `item-${index}`} className={`hover:bg-gray-50 ${isExpired(item.expiry_date) ? 'bg-red-50' : item.qty <= LOW_STOCK_LIMIT ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-sm text-gray-500">ID: {item.product_id}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.vendor_name || 'N/A'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.batch_no}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900"><span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">{item.unit || 'N/A'}</span></td>
                    <td className="px-4 py-4 whitespace-nowrap"><span className={`text-sm font-medium ${item.qty <= 0 ? 'text-red-600' : item.qty <= LOW_STOCK_LIMIT ? 'text-yellow-600' : 'text-green-600'}`}>{item.qty}</span></td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">Rs {item.price}</td>
                    <td className="px-4 py-4 whitespace-nowrap"><span className={`text-sm ${isExpired(item.expiry_date) ? 'text-red-600 font-medium' : 'text-gray-900'}`}>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}</span></td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {canSell && (
                          <button onClick={() => handleSell(item.batch_id)} disabled={item.qty <= 0} className={`px-3 py-1 rounded text-xs ${item.qty <= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>Sell</button>
                        )}
                        {canUpdate && (
                          <button onClick={() => handleEdit(item)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs">Edit</button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(item.batch_id, item.product_name)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs">Delete</button>
                        )}
                        {isAudit && (
                          <span className="text-gray-400 text-xs px-2 py-1 bg-gray-100 rounded">View Only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                    <div className="text-xl mb-4">No inventory items found</div>
                    <p className="text-lg">{searchTerm ? 'No products found matching your search.' : 'Add some products to get started!'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile Card View */}
        <div className="lg:hidden">
          {filteredInventory.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredInventory.map((item, index) => (
                <div key={item.batch_id || `item-${index}`} className={`p-4 ${isExpired(item.expiry_date) ? 'bg-red-50' : item.qty <= LOW_STOCK_LIMIT ? 'bg-yellow-50' : 'bg-white'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 text-sm">{item.product_name}</h3>
                      <p className="text-xs text-gray-500 mt-1">ID: {item.product_id}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-sm font-medium ${item.qty <= 0 ? 'text-red-600' : item.qty <= LOW_STOCK_LIMIT ? 'text-yellow-600' : 'text-green-600'}`}>Qty: {item.qty}</span>
                      <span className="text-sm text-gray-900">Rs {item.price}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                    <div><span className="font-medium">Vendor:</span> {item.vendor_name || 'N/A'}</div>
                    <div><span className="font-medium">Batch:</span> {item.batch_no}</div>
                    <div><span className="font-medium">Unit:</span> <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded">{item.unit || 'N/A'}</span></div>
                    <div><span className="font-medium">Expiry:</span> <span className={`ml-1 ${isExpired(item.expiry_date) ? 'text-red-600 font-medium' : ''}`}>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canSell && (
                      <button onClick={() => handleSell(item.batch_id)} disabled={item.qty <= 0} className={`px-3 py-1 rounded text-xs flex-1 sm:flex-none ${item.qty <= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>Sell</button>
                    )}
                    {canUpdate && (
                      <button onClick={() => handleEdit(item)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs flex-1 sm:flex-none">Edit</button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(item.batch_id, item.product_name)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs flex-1 sm:flex-none">Delete</button>
                    )}
                    {isAudit && (
                      <span className="text-gray-400 text-xs px-2 py-1 bg-gray-100 rounded flex-1 text-center">View Only</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <div className="text-lg mb-2">No inventory items found</div>
              <p className="text-sm">{searchTerm ? 'No products found matching your search.' : 'Add some products to get started!'}</p>
            </div>
          )}
        </div>
      </div>
      <Toast />
    </div>
  );
}