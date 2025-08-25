import React, { useState, useEffect } from 'react';
import { Toast, useToast } from '../components/ToastContext.jsx';
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, PhoneIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { API, apiCall } from '../utils/api';

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
  const canUpdate = isAdmin;
  const canDelete = isAdmin;

  return {
    currentUser,
    currentUserRole,
    isAudit,
    isAdmin,
    isPharmacist,
    canCreate,
    canUpdate,
    canDelete
  };
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const options = { year: "numeric", month: "short", day: "numeric" };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const Vendors = ({ user, onLogout }) => {
  // Toast context
  const { isAudit, canCreate, canUpdate, canDelete } = useAuth();
  
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: "", contact: "", address: "" });
  const [editingVendor, setEditingVendor] = useState(null);
  const [error, setError] = useState("");
  // Address filter and sorting
  const [addressFilter, setAddressFilter] = useState("");
  // Removed sorting state
  // Remove sortOrder, always descending

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

  const fetchVendors = async () => {
    try {
      console.log('🔄 Starting fetchVendors...');
      setLoading(true);
      setError("");
      
      const token = getAuthToken();
      console.log('🔑 Token found:', !!token);
      
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }
      
      console.log('📡 Making API call to /api/vendors...');
      const res = await apiCall('/api/vendors', {
        headers: getAuthHeaders()
      });

      console.log('📄 Response status:', res.status);
      if (!res.ok) {
        if (res.status === 401) {
          onLogout();
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      console.log('📦 Received data:', data);
      
      let vendorsList = [];
      if (Array.isArray(data)) {
        vendorsList = data;
      } else if (data.success && Array.isArray(data.vendors)) {
        vendorsList = data.vendors;
      } else if (data.vendors && Array.isArray(data.vendors)) {
        vendorsList = data.vendors;
      }
      
      const validVendors = vendorsList.filter(v => v.uuid && v.name);
      console.log('✅ Valid vendors found:', validVendors.length);
      setVendors(validVendors);
      
    } catch (err) {
      console.error('❌ Error in fetchVendors:', err);
      setError("Failed to fetch vendors. Please check server connection.");
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchVendors();
    }
  }, [user]);

  const resetForm = () => {
    setNewVendor({ name: "", contact: "", address: "" });
    setEditingVendor(null);
    setShowForm(false);
    setError("");
  };

  const handleAddVendor = async () => {
    if (!newVendor.name?.trim()) {
      setError("Vendor name is required");
      return;
    }

    try {
      setError("");
      const res = await apiCall('/api/vendors', {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newVendor.name.trim(),
          contact: newVendor.contact.trim(),
          address: newVendor.address.trim()
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          onLogout();
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const result = await res.json();
      if (result.success) {
  showToast('Vendor added successfully!');
  resetForm();
  setTimeout(() => fetchVendors(), 4000);
      } else {
        setError(result.error || "Failed to add vendor");
      }
    } catch (err) {
      setError("Failed to add vendor. Please try again.");
    }
  };

  const handleUpdateVendor = async () => {
    if (!editingVendor.name?.trim()) {
      setError("Vendor name is required");
      return;
    }

    try {
      setError("");
      const res = await apiCall(`/api/vendors/${editingVendor.uuid}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: editingVendor.name.trim(),
          contact: editingVendor.contact.trim(),
          address: editingVendor.address.trim()
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          onLogout();
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const result = await res.json();
      if (result.success) {
  showToast('Vendor updated successfully!');
  resetForm();
  setTimeout(() => fetchVendors(), 4000);
      } else {
        setError(result.error || "Failed to update vendor");
      }
    } catch (err) {
      setError("Failed to update vendor. Please try again.");
    }
  };

  const handleDeleteVendor = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) return;

    try {
      setError("");
      const res = await apiCall(`/api/vendors/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        if (res.status === 401) {
          onLogout();
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const result = await res.json();
      if (result.success) {
  showToast("Vendor deleted successfully!");
  setTimeout(() => fetchVendors(), 4000);
      } else {
        setError(result.error || "Failed to delete vendor");
      }
    } catch (err) {
      setError("Failed to delete vendor. Please try again.");
    }
  };

  const startEdit = (vendor) => {
    setEditingVendor({ ...vendor });
    setShowForm(true);
    setError("");
  };

  // Get unique addresses for filter dropdown
  const addressOptions = Array.from(new Set(vendors.map(v => v.address).filter(Boolean)));

  // Filter vendors by search and address
  let filteredVendors = vendors.filter((vendor) => {
    const matchesSearch = (vendor.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (vendor.contact || '').toLowerCase().includes(search.toLowerCase()) ||
      (vendor.address || '').toLowerCase().includes(search.toLowerCase());
    const matchesAddress = addressFilter ? vendor.address === addressFilter : true;
    return matchesSearch && matchesAddress;
  });

  // Removed sorting logic

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading vendors...</p>
        </div>
        <Toast />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <Toast />
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Vendor Management</h1>
            <p className="text-sm sm:text-base text-gray-600">
              Manage your suppliers and vendors
              {isAudit && <span className="text-blue-600 block sm:inline"> • Read-only access</span>}
            </p>
          </div>
          {canCreate && (
                  <button
                    onClick={() => {
                      resetForm();
                      setShowForm(!showForm);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg shadow transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
                  >
                    {/* Only show Plus icon when adding, not when cancelling */}
                    {!showForm && <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
                    {showForm ? 'Cancel' : 'Add Vendor'}
                  </button>
          )}
        </div>
      </div>

      {isAudit && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Audit Mode Active</p>
              <p className="text-sm mt-1">You have read-only access to vendor data. Contact administrator for modification permissions.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 relative">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search vendors by name, contact, or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
          />
        </div>
        <div className="lg:col-span-1">
          <select
            value={addressFilter}
            onChange={e => setAddressFilter(e.target.value)}
            className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white"
          >
            <option value="">All Addresses</option>
            {addressOptions.map(addr => (
              <option key={addr} value={addr}>{addr}</option>
            ))}
          </select>
        </div>
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3 sm:p-4 rounded-lg text-center text-white">
          <div className="text-xl sm:text-2xl font-bold">{filteredVendors.length}</div>
          <div className="text-xs sm:text-sm opacity-90">Filtered Vendors</div>
        </div>
      </div>

  {/* Removed sorting controls */}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Modal backdrop */}
          <div className="absolute inset-0 bg-blue-300 bg-opacity-40" onClick={resetForm}></div>
          {/* Modal form */}
          <div className="relative bg-white p-4 sm:p-6 rounded-lg shadow-md border w-full max-w-2xl mx-auto" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
              {editingVendor ? (
                <>
                  <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  Edit Vendor
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  Add New Vendor
                </>
              )}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter vendor name"
                  value={editingVendor ? (editingVendor.name || '') : (newVendor.name || '')}
                  onChange={(e) =>
                    editingVendor
                      ? setEditingVendor({ ...editingVendor, name: e.target.value })
                      : setNewVendor({ ...newVendor, name: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number
                </label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={editingVendor ? (editingVendor.contact || '') : (newVendor.contact || '')}
                  onChange={(e) =>
                    editingVendor
                      ? setEditingVendor({ ...editingVendor, contact: e.target.value })
                      : setNewVendor({ ...newVendor, contact: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  placeholder="Enter address"
                  value={editingVendor ? (editingVendor.address || '') : (newVendor.address || '')}
                  onChange={(e) =>
                    editingVendor
                      ? setEditingVendor({ ...editingVendor, address: e.target.value })
                      : setNewVendor({ ...newVendor, address: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={editingVendor ? handleUpdateVendor : handleAddVendor}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {editingVendor ? (
                  <>
                    <PencilIcon className="h-4 w-4" />
                    Update Vendor
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    Save Vendor
                  </>
                )}
              </button>
              <button
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVendors.length > 0 ? (
          filteredVendors.map((vendor, index) => (
            <div
              key={vendor.uuid || `vendor-${index}`}
              className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-800 truncate mb-1">
                    {vendor.name}
                  </h2>
                  <div className="text-xs text-gray-500">
                    ID: {vendor.uuid?.substring(0, 8)}...
                  </div>
                </div>
                <div className="flex gap-2">
                  {canUpdate && (
                    <button
                      onClick={() => startEdit(vendor)}
                      className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      title="Edit vendor"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteVendor(vendor.uuid, vendor.name)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      title="Delete vendor"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <PhoneIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="font-medium text-gray-700">Contact:</span>
                  <span className="text-gray-600">{vendor.contact || "N/A"}</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <MapPinIcon className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span className="font-medium text-gray-700">Address:</span>
                  <span className="text-gray-600 break-words flex-1">
                    {vendor.address || "N/A"}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>
                    <span className="font-medium">Created:</span>
                    <br />
                    {formatDate(vendor.created_at)}
                  </div>
                  <div>
                    <span className="font-medium">Updated:</span>
                    <br />
                    {formatDate(vendor.updated_at)}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <div className="text-xl mb-4">
              {search ? 'No vendors found' : 'No vendors found'}
            </div>
            <p className="text-gray-500 text-lg mb-2">
              {search ? 'No vendors found matching your search.' : 'No vendors found.'}
            </p>
            <p className="text-gray-400 text-sm">
              {search ? 'Try adjusting your search terms.' : 'Add your first vendor to get started!'}
            </p>
            {!search && canCreate && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Add First Vendor
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Vendors;
