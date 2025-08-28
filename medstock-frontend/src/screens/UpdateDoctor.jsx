import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/ToastContext.jsx';
import { apiCall } from '../utils/api';

const UpdateDoctor = () => {
  const [fieldErrors, setFieldErrors] = useState({});
  const { id } = useParams();
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [error, setError] = useState('');
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

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const data = await apiCall(`/api/doctors/${id}`, {
          headers: getAuthHeaders()
        });
        setName(data.name || '');
        setSpecialization(data.specialization || '');
      } catch (err) {
        setError('Failed to fetch doctor details.');
      }
    };
    fetchDoctor();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Doctor name is required';
    } else if (name.length < 3) {
      errors.name = 'Doctor name must be at least 3 characters';
    }
    if (specialization && specialization.length < 2) {
      errors.specialization = 'Specialization must be at least 2 characters';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the errors in the form');
      return;
    }
    try {
      setError('');
      await apiCall(`/api/doctors/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: name.trim(), specialization: specialization.trim() || null })
      });
      showToast('Doctor updated successfully!');
      navigate('/doctors');
    } catch (err) {
      setError('Error updating doctor. Please try again.');
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white p-8 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Edit Doctor</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Doctor Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" placeholder="Enter doctor name" />
          {fieldErrors.name && <div className="text-red-600 text-xs mt-1">{fieldErrors.name}</div>}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Specialization</label>
          <input type="text" value={specialization} onChange={e => setSpecialization(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" placeholder="e.g., Cardiology, Pediatrics" />
          {fieldErrors.specialization && <div className="text-red-600 text-xs mt-1">{fieldErrors.specialization}</div>}
        </div>
        {error && <div className="mb-4 text-red-600">{error}</div>}
        <div className="flex justify-end space-x-3">
          <button type="button" onClick={() => navigate('/doctors')} className="px-6 py-2 border border-gray-300 rounded-lg">Cancel</button>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg">Update Doctor</button>
        </div>
      </form>
    </div>
  );
};

export default UpdateDoctor;
