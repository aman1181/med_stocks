import React, { useState, useEffect } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { useToast } from '../components/ToastContext.jsx';

export default function AddProduct() {
  const [formData, setFormData] = useState({
    product_name: '',
    unit: '',
    vendor_name: '',
    batch_no: '',
    expiry_date: '',
    qty: '',
    cost: '',
    price: ''
  });
  const [vendors, setVendors] = useState([]);
  useEffect(() => {
    // Fetch vendors from API
    async function fetchVendors() {
      try {
        const data = await apiCall('/api/vendors');
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
    }
    fetchVendors();
  }, []);
  const [error, setError] = useState('');
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.product_name?.trim()) {
      errors.product_name = 'Product name is required';
    } else if (formData.product_name.length < 2) {
      errors.product_name = 'Product name must be at least 2 characters';
    }
    if (!formData.unit?.trim()) {
      errors.unit = 'Unit is required';
    }
    if (!formData.vendor_name?.trim()) {
      errors.vendor_name = 'Vendor is required';
    }
    if (!formData.batch_no?.trim()) {
      errors.batch_no = 'Batch number is required';
    }
    if (!formData.qty || isNaN(formData.qty) || parseInt(formData.qty) <= 0) {
      errors.qty = 'Quantity must be a positive number';
    }
    if (!formData.cost || isNaN(formData.cost) || parseFloat(formData.cost) < 0) {
      errors.cost = 'Cost must be a non-negative number';
    }
    if (!formData.price || isNaN(formData.price) || parseFloat(formData.price) < 0) {
      errors.price = 'Price must be a non-negative number';
    }
    if (formData.expiry_date && isNaN(Date.parse(formData.expiry_date))) {
      errors.expiry_date = 'Expiry date is invalid';
    }
    return errors;
  };

  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the errors in the form');
      return;
    }
    try {
      setError('');
      const result = await apiCall('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          qty: parseInt(formData.qty) || 0,
          cost: parseFloat(formData.cost) || 0,
          price: parseFloat(formData.price) || 0
        })
      });
      if (result && result.success) {
        showToast('Product added successfully!');
        navigate('/inventory');
      } else {
        setError(result?.error || 'Failed to add product');
      }
    } catch (err) {
      setError('Failed to add product: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold mb-4">Add New Product</h2>
  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
  <input type="text" name="product_name" value={formData.product_name} onChange={handleInputChange} placeholder="Product Name *" className="w-full px-3 py-2 border rounded" required />
  {fieldErrors.product_name && <div className="text-red-600 text-xs">{fieldErrors.product_name}</div>}
  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
  <input type="text" name="unit" value={formData.unit} onChange={handleInputChange} placeholder="Unit *" className="w-full px-3 py-2 border rounded" required />
  {fieldErrors.unit && <div className="text-red-600 text-xs">{fieldErrors.unit}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
          <Autocomplete
            options={vendors}
            getOptionLabel={option => option.name || ''}
            value={vendors.find(v => v.name === formData.vendor_name) || null}
            onChange={(event, newValue) => {
              setFormData(prev => ({
                ...prev,
                vendor_name: newValue ? newValue.name : ''
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
            isOptionEqualToValue={(option, value) => option.name === value.name}
          />
          {fieldErrors.vendor_name && <div className="text-red-600 text-xs">{fieldErrors.vendor_name}</div>}
        </div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
  <input type="text" name="batch_no" value={formData.batch_no} onChange={handleInputChange} placeholder="Batch Number *" className="w-full px-3 py-2 border rounded" required />
  {fieldErrors.batch_no && <div className="text-red-600 text-xs">{fieldErrors.batch_no}</div>}
  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
  <input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleInputChange} className="w-full px-3 py-2 border rounded" />
  {fieldErrors.expiry_date && <div className="text-red-600 text-xs">{fieldErrors.expiry_date}</div>}
  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
  <input type="number" name="qty" value={formData.qty} onChange={handleInputChange} placeholder="Quantity" className="w-full px-3 py-2 border rounded" required />
  {fieldErrors.qty && <div className="text-red-600 text-xs">{fieldErrors.qty}</div>}
  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
  <input type="number" name="cost" value={formData.cost} onChange={handleInputChange} placeholder="Cost Price" className="w-full px-3 py-2 border rounded" required />
  {fieldErrors.cost && <div className="text-red-600 text-xs">{fieldErrors.cost}</div>}
  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
  <input type="number" name="price" value={formData.price} onChange={handleInputChange} placeholder="Selling Price" className="w-full px-3 py-2 border rounded" required />
  {fieldErrors.price && <div className="text-red-600 text-xs">{fieldErrors.price}</div>}
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="flex gap-2 mt-4">
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Add Product</button>
          <button type="button" className="bg-gray-400 text-white px-4 py-2 rounded" onClick={() => navigate('/inventory')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
