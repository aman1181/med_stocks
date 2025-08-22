import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlusIcon, PrinterIcon, TrashIcon } from '@heroicons/react/24/solid';
import { useNavigate } from 'react-router-dom';
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
  const canUpdate = isAdmin || isPharmacist;
  const canDelete = isAdmin || isPharmacist;

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

const Billing = ({ user, onLogout }) => {
  const { isAudit, canCreate, currentUserRole } = useAuth();

  const [bills, setBills] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [printingBills, setPrintingBills] = useState(new Set()); // Track printing bills
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

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = getAuthToken();
      
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }
      
      const res = await apiCall('/api/billing', {
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
      
      if (data.success) {
        setBills(data.bills || []);
      } else {
        setBills(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError("Failed to fetch bills. Please check server connection.");
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      
      const res = await apiCall('/api/inventory', {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      
      const data = await res.json();
      const availableItems = Array.isArray(data) ? data.filter(item => item.qty > 0) : [];
      setInventory(availableItems);
    } catch (err) {
      setInventory([]);
    }
  };

  const fetchDoctors = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      
      const res = await apiCall('/api/doctors', {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      
      const data = await res.json();
      setDoctors(Array.isArray(data) ? data : []);
    } catch (err) {
      setDoctors([]);
    }
  };

  const fetchVendors = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      
      const res = await apiCall('/api/vendors', {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      setVendors([]);
    }
  };

  // Filter products based on search
  const filterProducts = (searchTerm) => {
    if (!searchTerm.trim()) {
      setFilteredInventory(inventory);
      return;
    }
    
    const filtered = inventory.filter(item => 
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batch_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredInventory(filtered);
  };

  // Handle product search input
  const handleProductSearch = (value) => {
    setProductSearch(value);
    setShowProductDropdown(true);
    filterProducts(value);
  };

  // Select a product from dropdown
  const selectProduct = (product) => {
    setSelectedProduct(product.batch_id);
    setProductSearch(`${product.product_name} (${product.vendor_name}) - Rs ${product.price}`);
    setShowProductDropdown(false);
  };

  // Update filtered inventory when inventory changes
  useEffect(() => {
    setFilteredInventory(inventory);
  }, [inventory]);

  useEffect(() => {
    if (user) {
      fetchBills();
      fetchInventory();
      fetchDoctors();
      fetchVendors();
    }
  }, [user]);

  const resetForm = () => {
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
  };

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

    if (selectedQuantity <= 0 || selectedQuantity > product.qty) {
      setError(`Invalid quantity. Available: ${product.qty}`);
      return;
    }

    const existingItemIndex = currentBill.items.findIndex(item => item.batch_id === selectedProduct);
    
    if (existingItemIndex >= 0) {
      const updatedItems = [...currentBill.items];
      const newQuantity = updatedItems[existingItemIndex].quantity + selectedQuantity;
      
      if (newQuantity > product.qty) {
        setError(`Total quantity would exceed available stock (${product.qty})`);
        return;
      }
      
      updatedItems[existingItemIndex].quantity = newQuantity;
      updatedItems[existingItemIndex].total = newQuantity * product.price;
      
      setCurrentBill(prev => ({ ...prev, items: updatedItems }));
    } else {
      const newItem = {
        batch_id: product.batch_id,
        product_id: product.product_id,
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

  const removeItemFromBill = (batchId) => {
    setCurrentBill(prev => ({
      ...prev,
      items: prev.items.filter(item => item.batch_id !== batchId)
    }));
  };

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

  const generateBill = async () => {
    if (!currentBill.customer_name.trim()) {
      setError("Customer name is required");
      return;
    }

    if (currentBill.items.length === 0) {
      setError("Please add at least one item to the bill");
      return;
    }

    try {
      setError('');
      const totals = calculateTotals();
      
      const selectedDoctor = doctors.find(doc => doc.uuid === currentBill.doctor_id);
      
      const billData = {
        customer_name: currentBill.customer_name.trim(),
        customer_phone: currentBill.customer_phone.trim(),
        doctor_id: currentBill.doctor_id || null,
        doctor_name: selectedDoctor?.name || null,
        payment_method: currentBill.payment_method,
        discount: currentBill.discount,
        total_amount: parseFloat(totals.total),
        items: currentBill.items
      };

      const res = await apiCall('/api/billing', {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(billData),
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
        alert(`Bill generated successfully! Total Amount: Rs ${totals.total}`);
        resetForm();
        setShowForm(false);
        fetchBills();
        fetchInventory();
      } else {
        setError(result.error || "Failed to generate bill");
      }
    } catch (err) {
      setError("Failed to generate bill. Please try again.");
    }
  };

  const getDoctorName = (doctorId) => {
    if (!doctorId) return 'Walk-in';
    const doctor = doctors.find(doc => doc.uuid === doctorId);
    return doctor ? doctor.name : 'Unknown Doctor';
  };

  const getVendorsFromBill = (billItems) => {
    try {
      const items = typeof billItems === 'string' ? JSON.parse(billItems) : billItems;
      if (!Array.isArray(items)) return 'N/A';
      
      const uniqueVendors = [...new Set(
        items
          .map(item => item.vendor_name)
          .filter(vendor => vendor && vendor !== 'N/A')
      )];
      
      return uniqueVendors.length > 0 ? uniqueVendors.join(', ') : 'N/A';
    } catch (err) {
      return 'N/A';
    }
  };

  const printBill = React.useCallback((bill) => {
    const billKey = `${bill.bill_no || bill.bill_id}`;
    
    console.log(`Print request for bill: ${billKey}`);
    console.log('Current printing bills:', Array.from(printingBills));
    
    // Check if already printing
    if (printingBills.has(billKey)) {
      console.log(`Bill ${billKey} is already being printed, ignoring request`);
      return;
    }
    
    // Add to printing set
    setPrintingBills(prev => new Set(prev).add(billKey));
    console.log(`Added ${billKey} to printing set`);
    
    try {
      const doctorName = getDoctorName(bill.doctor_id);
      const billItems = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items || [];
      
      // Create unique window
      const timestamp = Date.now();
      const windowName = `medstock_bill_${billKey}_${timestamp}`;
      
      console.log(`Opening print window: ${windowName}`);
      const printWindow = window.open('', windowName, 'width=800,height=600,scrollbars=yes');
      
      if (!printWindow) {
        alert('Please allow popups for this site to print bills');
        setPrintingBills(prev => {
          const newSet = new Set(prev);
          newSet.delete(billKey);
          return newSet;
        });
        return;
      }
      
      const printContent = `<!DOCTYPE html>
        <html>
        <head>
          <title>Bill #${bill.bill_no}</title>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              line-height: 1.4;
              color: #333;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 10px; 
              margin-bottom: 20px;
            }
            .header h1 { margin: 0; font-size: 24px; }
            .bill-info { margin: 20px 0; }
            .bill-info p { margin: 5px 0; }
            .items-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0; 
            }
            .items-table th, .items-table td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left; 
            }
            .items-table th { 
              background-color: #f2f2f2; 
              font-weight: bold;
            }
            .total-section { 
              margin-top: 20px; 
              text-align: right; 
            }
            .footer { 
              margin-top: 30px; 
              text-align: center; 
              font-size: 12px; 
              color: #666; 
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
              .items-table { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>MedStock Pharmacy</h1>
            <p>Bill #${bill.bill_no}</p>
          </div>
          
          <div class="bill-info">
            <p><strong>Date:</strong> ${new Date(bill.created_at).toLocaleDateString()}</p>
            <p><strong>Customer:</strong> ${bill.customer_name}</p>
            <p><strong>Phone:</strong> ${bill.customer_phone || 'N/A'}</p>
            <p><strong>Doctor:</strong> ${doctorName}</p>
            <p><strong>Payment:</strong> ${bill.payment_method?.toUpperCase() || 'CASH'}</p>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Vendor</th>
                <th>Unit</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${billItems.map(item => `
                <tr>
                  <td>${item.product_name || 'N/A'}</td>
                  <td>${item.vendor_name || 'N/A'}</td>
                  <td>${item.unit || 'N/A'}</td>
                  <td>Rs ${item.price || 0}</td>
                  <td>${item.quantity || 0}</td>
                  <td>Rs ${(item.total || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total-section">
            <p><strong>Subtotal: Rs ${bill.total || 0}</strong></p>
            ${bill.discount > 0 ? `<p>Discount (${bill.discount}%): -Rs ${((bill.total || 0) * (bill.discount || 0) / 100).toFixed(2)}</p>` : ''}
            <h3>Total: Rs ${bill.total || 0}</h3>
          </div>
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
          
          <script>
            let printExecuted = false;
            
            console.log('Print window script loaded for bill: ${billKey}');
            
            function executePrint() {
              if (printExecuted) {
                console.log('Print already executed, skipping');
                return;
              }
              
              printExecuted = true;
              console.log('Executing print for bill: ${billKey}');
              
              setTimeout(() => {
                window.print();
                
                // Clean up after print
                setTimeout(() => {
                  console.log('Cleaning up for bill: ${billKey}');
                  try {
                    if (window.opener && window.opener.setPrintingBills) {
                      window.opener.setPrintingBills(prev => {
                        const newSet = new Set(prev);
                        newSet.delete('${billKey}');
                        console.log('Removed ${billKey} from parent printing set');
                        return newSet;
                      });
                    }
                  } catch(e) {
                    console.log('Could not access parent window for cleanup');
                  }
                  window.close();
                }, 2000);
              }, 500);
            }
            
            // Execute when page loads
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', executePrint);
            } else {
              executePrint();
            }
            
            // Cleanup on window close
            window.addEventListener('beforeunload', function() {
              try {
                if (window.opener && window.opener.setPrintingBills) {
                  window.opener.setPrintingBills(prev => {
                    const newSet = new Set(prev);
                    newSet.delete('${billKey}');
                    return newSet;
                  });
                }
              } catch(e) {
                console.log('Could not clean up on beforeunload');
              }
            });
          </script>
        </body>
        </html>`;
      
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      console.log(`Print window content written for ${billKey}`);
      
    } catch (error) {
      console.error('Error in printBill:', error);
      setPrintingBills(prev => {
        const newSet = new Set(prev);
        newSet.delete(billKey);
        return newSet;
      });
    }
    
    // Fallback cleanup after 15 seconds
    setTimeout(() => {
      setPrintingBills(prev => {
        if (prev.has(billKey)) {
          console.log(`Fallback cleanup for ${billKey}`);
          const newSet = new Set(prev);
          newSet.delete(billKey);
          return newSet;
        }
        return prev;
      });
    }, 15000);
  }, [printingBills, getDoctorName]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading billing data...</p>
        </div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Billing & Sales</h1>
            <p className="text-gray-600">
              Create and manage pharmacy bills
              {isAudit && <span className="text-blue-600"> • Read-only access</span>}
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              {showForm ? 'Cancel' : 'New Bill'}
            </button>
          )}
        </div>
      </div>

      {isAudit && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Audit Mode Active</p>
              <p className="text-sm">You have read-only access to billing data. Contact administrator for billing permissions.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 p-4 rounded-lg text-center border border-green-200">
          <div className="text-2xl font-bold text-green-600">{bills.length}</div>
          <div className="text-sm text-green-800">Total Bills</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">
            Rs {bills.reduce((sum, bill) => sum + parseFloat(bill.total || 0), 0).toFixed(2)}
          </div>
          <div className="text-sm text-blue-800">Total Revenue</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center border border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{doctors.length}</div>
          <div className="text-sm text-purple-800">Active Doctors</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg text-center border border-orange-200">
          <div className="text-2xl font-bold text-orange-600">{vendors.length}</div>
          <div className="text-sm text-orange-800">Active Vendors</div>
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

      {showForm && canCreate && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow-md border">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Create New Bill</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input
                type="text"
                value={currentBill.customer_name}
                onChange={(e) => setCurrentBill(prev => ({ ...prev, customer_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doctor (Optional)</label>
              <select
                value={currentBill.doctor_id}
                onChange={(e) => setCurrentBill(prev => ({ ...prev, doctor_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Walk-in Customer</option>
                {doctors.map(doctor => (
                  <option key={doctor.uuid} value={doctor.uuid}>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="credit">Credit</option>
              </select>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-md font-medium mb-3 text-gray-800">Add Products</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Product</label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => handleProductSearch(e.target.value)}
                  onFocus={() => setShowProductDropdown(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search by product name, vendor, or batch ID..."
                />
                
                {/* Searchable Dropdown */}
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
                
                {/* Backdrop to close dropdown */}
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
              onClick={() => setShowForm(false)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Bills History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendors</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bills.length > 0 ? (
                bills.map((bill, index) => {
                  const items = typeof bill.items === 'string' ? JSON.parse(bill.items || '[]') : [];
                  const vendorsInBill = getVendorsFromBill(bill.items);
                  const doctorName = getDoctorName(bill.doctor_id);
                  
                  return (
                    <tr key={bill.bill_id || `bill-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{bill.bill_no || bill.bill_id}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{bill.customer_name}</div>
                          <div className="text-sm text-gray-500">{bill.customer_phone || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          {doctorName}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="max-w-32 truncate" title={vendorsInBill}>
                          {vendorsInBill}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(bill.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {items.length} items
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        Rs {bill.total}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {(bill.payment_method || 'cash').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            printBill(bill);
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs disabled:bg-gray-400 disabled:cursor-not-allowed"
                          disabled={printingBills.has(`${bill.bill_no || bill.bill_id}`)}
                        >
                          <PrinterIcon className="h-3 w-3" />
                          {printingBills.has(`${bill.bill_no || bill.bill_id}`) ? 'Printing...' : 'Print'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-gray-500">
                    <div className="text-6xl mb-4">Bill</div>
                    <p className="text-lg">No bills found. Generate your first bill to get started!</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Billing; 
