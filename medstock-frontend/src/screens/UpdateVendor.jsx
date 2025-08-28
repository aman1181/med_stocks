import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { useToast } from '../components/ToastContext.jsx';

export default function UpdateVendor({ user, onLogout }) {
  const [fieldErrors, setFieldErrors] = useState({});
  const { id } = useParams();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchVendor() {
      try {
        const res = await apiCall(`/api/vendors/${id}`);
        if (!res.success || !res.vendor) throw new Error(res.error || 'Vendor not found');
        setName(res.vendor.name || '');
        setContact(
          res.vendor.contact ||
          res.vendor.phone ||
          res.vendor.contact_person ||
          ''
        );
        setAddress(res.vendor.address || '');
      } catch (err) {
        setError(err.message);
      }
    }
    fetchVendor();
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
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
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the errors in the form');
      setLoading(false);
      return;
    }
    try {
      const res = await apiCall(`/api/vendors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: contact, address })
      });
      if (!res.success) throw new Error(res.error || 'Failed to update vendor');
      showToast('Vendor updated successfully!');
      navigate('/vendors');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-8 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Update Vendor</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border px-3 py-2 rounded" required />
          {fieldErrors.name && <div className="text-red-600 text-xs mt-1">{fieldErrors.name}</div>}
        </div>
        <div>
          <label className="block mb-1 font-medium">Contact</label>
          <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="w-full border px-3 py-2 rounded" required />
          {fieldErrors.contact && <div className="text-red-600 text-xs mt-1">{fieldErrors.contact}</div>}
        </div>
        <div>
          <label className="block mb-1 font-medium">Address</label>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full border px-3 py-2 rounded" required />
          {fieldErrors.address && <div className="text-red-600 text-xs mt-1">{fieldErrors.address}</div>}
        </div>
        {error && <div className="text-red-600">{error}</div>}
        <div className="flex gap-4">
          <button
            type="submit"
            className={`flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition-all ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Vendor'}
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
