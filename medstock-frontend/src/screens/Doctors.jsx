import React, { useState, useEffect } from 'react';
import { Toast, useToast } from '../components/ToastContext.jsx';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid';
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

const Doctors = ({ user, onLogout }) => {
  // Specialization filter and sorting state
  const [selectedSpecialization, setSelectedSpecialization] = useState('All');
  // Removed sorting state
  // Toast state
  const [toastMsg, setToastMsg] = useState("");
  const { showToast } = useToast();
  const { isAudit, canCreate, canUpdate, canDelete } = useAuth();
  
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newDoctor, setNewDoctor] = useState({ name: "", specialization: "" });
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [showForm, setShowForm] = useState(false);
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

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = getAuthToken();
      
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }

      const res = await apiCall('/api/doctors', {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          onLogout();
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }
      
      const data = await res.json();
      const validDoctors = Array.isArray(data) ? data.filter(d => d.uuid) : [];
      setDoctors(validDoctors);
    } catch (err) {
      setError("Failed to fetch doctors. Please check server connection.");
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDoctors();
    }
  }, [user]);

  const handleAddDoctor = async () => {
    if (!newDoctor.name.trim()) {
      setError("Doctor name is required");
      return;
    }

    try {
      setError('');
      const res = await apiCall('/api/doctors', {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newDoctor.name.trim(),
          specialization: newDoctor.specialization.trim() || null
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          onLogout();
          return;
        }
        throw new Error("Failed to add doctor");
      }

      setNewDoctor({ name: "", specialization: "" });
      setShowForm(false);
  setToastMsg('Doctor added successfully!');
  showToast('Doctor added successfully!');
  setTimeout(() => fetchDoctors(), 4000);
    } catch (err) {
      setError("Error adding doctor. Please try again.");
    }
  };

  const handleUpdateDoctor = async () => {
    if (!editingDoctor?.name?.trim()) {
      setError("Doctor name is required");
      return;
    }

    try {
      setError('');
      const res = await apiCall(`/api/doctors/${editingDoctor.uuid}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: editingDoctor.name.trim(),
          specialization: editingDoctor.specialization?.trim() || null
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          onLogout();
          return;
        }
        throw new Error("Failed to update doctor");
      }

      setEditingDoctor(null);
  setToastMsg('Doctor updated successfully!');
  showToast('Doctor updated successfully!');
  setTimeout(() => fetchDoctors(), 4000);
    } catch (err) {
      setError("Error updating doctor. Please try again.");
    }
  };

  const handleDeleteDoctor = async (id) => {
    if (!window.confirm("Are you sure you want to delete this doctor?")) return;

    try {
      setError('');
      const res = await apiCall(`/api/doctors/${id}`, { 
        method: "DELETE",
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        if (res.status === 401) {
          onLogout();
          return;
        }
        throw new Error("Failed to delete doctor");
      }

      fetchDoctors();
  setToastMsg('Doctor deleted successfully!');
  showToast('Doctor deleted successfully!');
  setTimeout(() => fetchDoctors(), 4000);
    } catch (err) {
      setError("Error deleting doctor. Please try again.");
    }
  };

  // Get unique specializations for filter dropdown
  const specializations = ['All', ...Array.from(new Set(doctors.map(d => d.specialization).filter(Boolean)))];

  // Filter by search and specialization
  let filteredDoctors = doctors.filter((doctor) =>
    (doctor.name?.toLowerCase().includes(search.toLowerCase()) ||
    (doctor.specialization && doctor.specialization.toLowerCase().includes(search.toLowerCase()))) &&
    (selectedSpecialization === 'All' || doctor.specialization === selectedSpecialization)
  );

  // Removed sorting logic

  const resetForm = () => {
    setEditingDoctor(null);
    setShowForm(false);
    setNewDoctor({ name: "", specialization: "" });
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
  <Toast />
      <div className="bg-white shadow border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-blue-50 via-white to-green-50 rounded-b-xl shadow-sm p-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Doctors Management</h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                Manage doctor profiles and specializations
                {isAudit && <span className="text-blue-600 block sm:inline"> • Read-only access</span>}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <div className="flex flex-col items-start">
                <label className="text-xs font-semibold text-gray-600 mb-1 ml-1">Specialization</label>
                <select
                  value={selectedSpecialization}
                  onChange={e => setSelectedSpecialization(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white shadow-sm min-w-[140px]"
                >
                  {specializations.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>
              {/* Removed sort by controls */}
              <div className="bg-blue-100 px-3 sm:px-4 py-2 rounded-lg w-full sm:w-auto text-center">
                <span className="text-blue-800 font-semibold text-sm sm:text-base">{doctors.length} Doctors</span>
              </div>
              {canCreate && (
                  <button
                    onClick={() => {
                      resetForm();
                      setShowForm(!showForm);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2 rounded-lg transition-colors shadow flex items-center justify-center space-x-2 w-full sm:w-auto text-sm sm:text-base"
                  >
                    {/* Only show Plus icon when adding, not when cancelling */}
                    {!showForm && <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
                    <span>{showForm ? 'Cancel' : 'Add Doctor'}</span>
                  </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {isAudit && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Audit Mode Active</p>
                <p className="text-sm mt-1">You have read-only access to doctor data. Contact administrator for modification permissions.</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 sm:mb-8">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search doctors by name or specialization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            />
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

        {(showForm || editingDoctor) && canCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Modal backdrop */}
            <div className="absolute inset-0 bg-blue-300 bg-opacity-40" onClick={resetForm}></div>
            {/* Modal form */}
            <div className="relative bg-white rounded-lg shadow border border-gray-200 p-6 mb-8 w-full max-w-xl mx-auto" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Doctor Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter doctor name"
                    value={editingDoctor ? editingDoctor.name || "" : newDoctor.name}
                    onChange={(e) =>
                      editingDoctor
                        ? setEditingDoctor({ ...editingDoctor, name: e.target.value })
                        : setNewDoctor({ ...newDoctor, name: e.target.value })
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Cardiology, Pediatrics"
                    value={editingDoctor ? editingDoctor.specialization || "" : newDoctor.specialization}
                    onChange={(e) =>
                      editingDoctor
                        ? setEditingDoctor({ ...editingDoctor, specialization: e.target.value })
                        : setNewDoctor({ ...newDoctor, specialization: e.target.value })
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={resetForm}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingDoctor ? handleUpdateDoctor : handleAddDoctor}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow"
                >
                  {editingDoctor ? 'Update Doctor' : 'Add Doctor'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading doctors...</span>
          </div>
        ) : (
          <>
            {filteredDoctors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDoctors.map((doctor) => (
                  <div
                    key={doctor.uuid}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden"
                  >
                    <div className="bg-blue-500 p-4 text-white">
                      <h3 className="text-lg font-bold">{doctor.name}</h3>
                      <p className="text-blue-100 text-sm">
                        {doctor.specialization || "General Practice"}
                      </p>
                    </div>

                    <div className="p-4">
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center">
                          <span className="w-16 text-gray-500">Created:</span>
                          <span className="font-medium">{formatDate(doctor.created_at)}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="w-16 text-gray-500">Updated:</span>
                          <span className="font-medium">{formatDate(doctor.updated_at)}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="w-16 text-gray-500">ID:</span>
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {doctor.uuid?.slice(0, 8)}...
                          </span>
                        </div>
                      </div>

                      <div className="flex space-x-2 mt-4">
                        {canUpdate && (
                          <button
                            onClick={() => setEditingDoctor(doctor)}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-colors shadow text-sm font-medium flex items-center justify-center space-x-1"
                          >
                            <PencilIcon className="h-4 w-4" />
                            <span>Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteDoctor(doctor.uuid)}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors shadow text-sm font-medium flex items-center justify-center space-x-1"
                          >
                            <TrashIcon className="h-4 w-4" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👨‍⚕️</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Doctors Found</h3>
                <p className="text-gray-500 mb-4">
                  {search ? "Try adjusting your search terms" : "Get started by adding your first doctor"}
                </p>
                {!search && canCreate && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors shadow flex items-center space-x-2 mx-auto"
                  >
                    <PlusIcon className="h-5 w-5" />
                    <span>Add First Doctor</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Doctors;