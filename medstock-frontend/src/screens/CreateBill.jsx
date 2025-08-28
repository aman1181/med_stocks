// ...existing code...
import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/solid';
import { useNavigate } from 'react-router-dom';
import { useToast, Toast } from '../components/ToastContext.jsx';
import { API, apiCall } from '../utils/api';

const CreateBill = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [currentBill, setCurrentBill] = useState({
    customer_name: '',
    customer_phone: '',
    doctor_id: '',
    items: [],
    discount: 0,
    payment_method: 'cash'
  });
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [error, setError] = useState('');

  // Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await apiCall('/api/doctors', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        let doctorsList = [];
        if (Array.isArray(res)) {
          doctorsList = res;
        } else if (res.success && Array.isArray(res.doctors)) {
          doctorsList = res.doctors;
        } else if (Array.isArray(res.items)) {
          doctorsList = res.items;
        }
        setDoctors(doctorsList);
      } catch (err) {
        setDoctors([]);
      }
    };
    fetchDoctors();
  }, []);

  // Fetch inventory
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await apiCall('/api/inventory', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        let items = [];
        if (Array.isArray(res)) {
          items = res;
        } else if (res.success && Array.isArray(res.inventory)) {
          items = res.inventory;
        } else if (Array.isArray(res.items)) {
          items = res.items;
        }
        let batchItems = [];
        items.forEach(product => {
          if (Array.isArray(product.batches)) {
            product.batches.forEach(batch => {
              batchItems.push({
                product_id: product.product_id,
                product_name: product.product_name,
                unit: product.unit,
                vendor_name: product.vendor_name,
                batch_id: batch.batch_id,
                qty: batch.qty,
                price: batch.price,
                expiry_date: batch.expiry_date
              });
            });
          }
        });
        const availableItems = batchItems.filter(item => item.qty > 0);
        setInventory(availableItems);
      } catch (err) {
        setInventory([]);
      }
    };
    fetchInventory();
  }, []);

  // Update filtered inventory when inventory changes
  useEffect(() => {
    setFilteredInventory(inventory);
  }, [inventory]);

  // Product search logic
  const handleProductSearch = (value) => {
    setProductSearch(value);
    setShowProductDropdown(true);
    setFilteredInventory(
      inventory.filter(item =>
        item.product_name.toLowerCase().includes(value.toLowerCase()) ||
        item.vendor_name.toLowerCase().includes(value.toLowerCase()) ||
        item.batch_id.toLowerCase().includes(value.toLowerCase())
      )
    );
  };

  // Select product from dropdown
  const selectProduct = (product) => {
    setSelectedProduct(product.batch_id);
    setProductSearch(`${product.product_name} (${product.vendor_name}) - Rs ${product.price}`);
    setShowProductDropdown(false);
  };

  // Add item to bill
  const addItemToBill = () => {
    if (!selectedProduct) {
      setError("Please select a product");
      return;
    }
    const product = inventory.find(item => item.batch_id === selectedProduct);
    if (!product) {
      setError("Product not found");
      return;
    }
    const batchQty = product.qty;
    if (selectedQuantity <= 0 || selectedQuantity > batchQty) {
      setError(`Invalid quantity. Available: ${batchQty}`);
      return;
    }
    const existingItemIndex = currentBill.items.findIndex(item => item.batch_id === selectedProduct);
    if (existingItemIndex >= 0) {
      const updatedItems = [...currentBill.items];
      const newQuantity = updatedItems[existingItemIndex].quantity + selectedQuantity;
      if (newQuantity > batchQty) {
        setError(`Total quantity would exceed available stock (${batchQty})`);
        return;
      }
      updatedItems[existingItemIndex].quantity = newQuantity;
      updatedItems[existingItemIndex].total = newQuantity * product.price;
      setCurrentBill(prev => ({ ...prev, items: updatedItems }));
    } else {
      const newItem = {
        product_id: product.product_id,
        batch_id: product.batch_id,
        product_name: product.product_name,
        unit: product.unit,
        price: product.price,
        quantity: selectedQuantity,
        vendor_name: product.vendor_name,
        total: selectedQuantity * product.price
      };
      setCurrentBill(prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }));
    }
    setSelectedProduct('');
    setSelectedQuantity(1);
    setProductSearch('');
    setShowProductDropdown(false);
    setError('');
  };

  // Remove item from bill
  const removeItemFromBill = (batchId) => {
    setCurrentBill(prev => ({
      ...prev,
      items: prev.items.filter(item => item.batch_id !== batchId)
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = currentBill.items.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = (subtotal * currentBill.discount) / 100;
    const total = subtotal - discountAmount;
    return {
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      total: total.toFixed(2)
    };
  };

  // Generate bill
  const generateBill = async () => {
    if (!currentBill.customer_name.trim()) {
      setError("Customer name is required");
      return;
    }
    if (!currentBill.doctor_id) {
      setError("Doctor selection is required");
      return;
    }
    if (currentBill.items.length === 0) {
      setError("Please add at least one item to the bill");
      return;
    }
    try {
      setError('');
      const totals = calculateTotals();
      const selectedDoctor = doctors.find(doc => doc.uuid === currentBill.doctor_id || doc._id === currentBill.doctor_id);
      const billItems = currentBill.items.map(item => ({
        product_id: item.product_id,
        batch_id: item.batch_id,
        product_name: item.product_name,
        unit: item.unit,
        price: item.price,
        quantity: item.quantity,
        vendor_name: item.vendor_name,
        total: item.total
      }));
      const billData = {
        customer_name: currentBill.customer_name.trim(),
        customer_phone: currentBill.customer_phone.trim(),
        doctor_id: currentBill.doctor_id || null,
        doctor_name: selectedDoctor?.name || null,
        payment_method: currentBill.payment_method,
        discount: currentBill.discount,
        total_amount: parseFloat(totals.total),
        items: billItems
      };
      const response = await apiCall('/api/billing', {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData),
      });
      if (response.success) {
        showToast(`Bill generated successfully! Total Amount: Rs ${totals.total}`);
        setCurrentBill({
          customer_name: '',
          customer_phone: '',
          doctor_id: '',
          items: [],
          discount: 0,
          payment_method: 'cash'
        });
        setSelectedProduct('');
        setSelectedQuantity(1);
        setProductSearch('');
        setShowProductDropdown(false);
        setError('');
        navigate('/billing');
      } else {
        setError(response.error || "Failed to generate bill");
      }
    } catch (err) {
      setError("Failed to generate bill. Please try again.");
    }
  };

  const totals = calculateTotals();

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-full w-full mx-auto">
      <Toast />
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Create New Bill</h1>
          <button
            onClick={() => navigate('/billing')}
            className="ml-2 p-2 rounded-full hover:bg-blue-100 text-blue-600"
            title="Back to Bills"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">Warning:</span>
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
      <div className="mb-8 bg-white p-4 sm:p-6 rounded-lg shadow-md border">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Create New Bill</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
            <input
              type="text"
              value={currentBill.customer_name}
              onChange={(e) => setCurrentBill(prev => ({ ...prev, customer_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              placeholder="Enter customer name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={currentBill.customer_phone}
              onChange={(e) => setCurrentBill(prev => ({ ...prev, customer_phone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              placeholder="Enter phone number"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
            <select
              value={currentBill.doctor_id}
              onChange={(e) => setCurrentBill(prev => ({ ...prev, doctor_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              required
            >
              <option value="">Select Doctor</option>
              {doctors.map(doctor => (
                <option key={doctor._id || doctor.uuid} value={doctor._id || doctor.uuid}>
                  {doctor.name} - {doctor.specialization}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={currentBill.payment_method}
              onChange={(e) => setCurrentBill(prev => ({ ...prev, payment_method: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        </div>
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm sm:text-md font-medium mb-3 text-gray-800">Add Products</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Product</label>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => handleProductSearch(e.target.value)}
                onFocus={() => setShowProductDropdown(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search by product name, vendor, or batch ID..."
              />
              {showProductDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredInventory.length > 0 ? (
                    filteredInventory.map(item => (
                      <div
                        key={item.batch_id}
                        onClick={() => selectProduct(item)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-900">{item.product_name}</div>
                            <div className="text-sm text-gray-500">
                              {item.vendor_name} • Batch: {item.batch_id}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-green-600">Rs {item.price}</div>
                            <div className="text-sm text-gray-500">Qty: {item.qty}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 text-center">
                      {productSearch ? 'No products found matching your search' : 'No products available'}
                    </div>
                  )}
                </div>
              )}
              {showProductDropdown && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowProductDropdown(false)}
                ></div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <div className="flex">
                <input
                  type="number"
                  min="1"
                  value={selectedQuantity}
                  onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addItemToBill}
                  disabled={!selectedProduct}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-r-md transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        {currentBill.items.length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium mb-3 text-gray-800">Bill Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Product</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Vendor</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Price</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Qty</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Total</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBill.items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2 text-sm">{item.product_name}</td>
                      <td className="px-4 py-2 text-sm">{item.vendor_name}</td>
                      <td className="px-4 py-2 text-sm">Rs {item.price}</td>
                      <td className="px-4 py-2 text-sm">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm font-medium">Rs {item.total.toFixed(2)}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => removeItemFromBill(item.batch_id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={currentBill.discount}
              onChange={(e) => setCurrentBill(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>Rs {totals.subtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Discount:</span>
                <span>-Rs {totals.discountAmount}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t pt-2">
                <span>Total:</span>
                <span>Rs {totals.total}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={generateBill}
            disabled={currentBill.items.length === 0 || !currentBill.customer_name.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            Generate Bill
          </button>
          <button
            onClick={() => navigate('/billing')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateBill;
