import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastContext.jsx';
import { apiCall } from '../utils/api';

const CreateDoctor = () => {
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const { showToast } = useToast();
  const navigate = useNavigate();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    let errors = {};
    if (!name.trim()) {
      errors.name = 'Doctor name is required';
    } else if (name.trim().length < 3) {
      errors.name = 'Doctor name must be at least 3 characters';
    } else if (!/^[A-Za-z\s]+$/.test(name.trim())) {
      errors.name = 'Doctor name must contain only letters and spaces';
    }
    if (specialization && !/^[A-Za-z\s]+$/.test(specialization.trim())) {
      errors.specialization = 'Specialization must contain only letters and spaces';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the errors in the form');
      return;
    }
    try {
      setError('');
      await apiCall('/api/doctors', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: name.trim(), specialization: specialization.trim() || null })
      });
      showToast('Doctor added successfully!');
      navigate('/doctors');
    } catch (err) {
      setError('Error adding doctor. Please try again.');
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white p-8 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Add New Doctor</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Doctor Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={`w-full p-3 border ${fieldErrors.name ? 'border-red-500' : 'border-gray-300'} rounded-lg`}
            placeholder="Enter doctor name"
            minLength={3}
            required
          />
          {fieldErrors.name && <div className="text-red-600 text-xs mt-1">{fieldErrors.name}</div>}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Specialization</label>
          <input
            type="text"
            value={specialization}
            onChange={e => setSpecialization(e.target.value)}
            className={`w-full p-3 border ${fieldErrors.specialization ? 'border-red-500' : 'border-gray-300'} rounded-lg`}
            placeholder="e.g., Cardiology, Pediatrics"
          />
          {fieldErrors.specialization && <div className="text-red-600 text-xs mt-1">{fieldErrors.specialization}</div>}
        </div>
        {error && <div className="mb-4 text-red-600 font-semibold">{error}</div>}
        <div className="flex justify-end space-x-3">
          <button type="button" onClick={() => navigate('/doctors')} className="px-6 py-2 border border-gray-300 rounded-lg">Cancel</button>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg">Add Doctor</button>
        </div>
      </form>
    </div>
  );
};

export default CreateDoctor;
