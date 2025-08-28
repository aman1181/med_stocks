import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { useToast } from '../components/ToastContext.jsx';

export default function CreateVendor({ user, onLogout }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [fieldErrors, setFieldErrors] = useState({});
  function validateFields() {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Vendor name is required.';
    } else if (name.length < 3) {
      errors.name = 'Vendor name must be at least 3 characters.';
    }
    if (!contact.trim()) {
      errors.contact = 'Contact number is required.';
    } else if (!/^\d{10,15}$/.test(contact.trim())) {
      errors.contact = 'Contact number must be 10-15 digits.';
    }
    if (!address.trim()) {
      errors.address = 'Address is required.';
    }
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const errors = validateFields();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the errors in the form');
      return;
    }
    setLoading(true);
    try {
      const res = await apiCall('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: contact.trim(), address: address.trim() })
      });
      if (!res.success) throw new Error(res.error || 'Failed to create vendor');
      showToast('Vendor created successfully!');
      navigate('/vendors');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-8 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-blue-700 text-center">Create New Vendor</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-2 font-semibold text-gray-700">Vendor Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-blue-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder="Enter vendor name"
            minLength={3}
            required
          />
          {fieldErrors.name && <div className="text-red-600 text-xs mt-1">{fieldErrors.name}</div>}
        </div>
        <div>
          <label className="block mb-2 font-semibold text-gray-700">Contact Number</label>
          <input
            type="tel"
            value={contact}
            onChange={e => setContact(e.target.value.replace(/[^\d]/g, ''))}
            className="w-full border border-blue-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder="Enter contact number"
            pattern="\d{10,15}"
            maxLength={15}
            required
          />
          <span className="text-xs text-gray-500">Only digits, 10-15 characters</span>
          {fieldErrors.contact && <div className="text-red-600 text-xs mt-1">{fieldErrors.contact}</div>}
        </div>
        <div>
          <label className="block mb-2 font-semibold text-gray-700">Address</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="w-full border border-blue-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder="Enter address"
            required
          />
          {fieldErrors.address && <div className="text-red-600 text-xs mt-1">{fieldErrors.address}</div>}
        </div>
        {error && <div className="text-red-600 font-semibold text-center py-2">{error}</div>}
        <div className="flex gap-4">
          <button
            type="submit"
            className={`flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition-all ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Creating...
              </span>
            ) : 'Create Vendor'}
          </button>
          <button
            type="button"
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 rounded-lg shadow transition-all"
            onClick={() => navigate('/vendors')}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
