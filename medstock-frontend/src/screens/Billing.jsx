import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Toast, useToast } from '../components/ToastContext.jsx';
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
    }
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
  const { showToast } = useToast();
  const { isAudit, canCreate, currentUserRole } = useAuth();
  const navigate = useNavigate();

  const [bills, setBills] = useState([]);
  // Filter and sort controls
  const [paymentFilter, setPaymentFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [sortField, setSortField] = useState("created_at");
  // Remove sortOrder, always descending
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

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Fetch bills from API
  const fetchBills = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        setBills([]);
        setLoading(false);
        return;
      }
      const res = await apiCall('/api/billing', {
        headers: getAuthHeaders()
      });
      const data = await res.json ? await res.json() : res;
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
      const data = await apiCall('/api/inventory', {
        headers: getAuthHeaders()
      });
      let items = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data.success && Array.isArray(data.inventory)) {
        items = data.inventory;
      } else if (Array.isArray(data.items)) {
        items = data.items;
      }
      // Flatten batches for selection
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

  const fetchDoctors = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const data = await apiCall('/api/doctors', {
        headers: getAuthHeaders()
      });
      let doctorsList = [];
      if (Array.isArray(data)) {
        doctorsList = data;
      } else if (data.success && Array.isArray(data.doctors)) {
        doctorsList = data.doctors;
      } else if (Array.isArray(data.items)) {
        doctorsList = data.items;
      }
      setDoctors(doctorsList);
    } catch (err) {
      setDoctors([]);
    }
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
    // Find the correct batch from inventory
    const product = inventory.find(item => item.batch_id === selectedProduct);
    if (!product) {
      setError("Product not found");
      return;
    }
    // Use batch qty for validation
    const batchQty = product.qty;
    if (selectedQuantity <= 0 || selectedQuantity > batchQty) {
      setError(`Invalid quantity. Available: ${batchQty}`);
      return;
    }
    // Check if item already exists in bill (by batch_id)
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
      // Always send product_id and batch_id for backend
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
      const selectedDoctor = doctors.find(doc => doc.uuid === currentBill.doctor_id);
      // Ensure all items have product_id and batch_id
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
        headers: getAuthHeaders(),
        body: JSON.stringify(billData),
      });
      if (response.success) {
        showToast(`Bill generated successfully! Total Amount: Rs ${totals.total}`);
        resetForm();
        setShowForm(false);
        fetchBills();
        fetchInventory();
      } else {
        setError(response.error || "Failed to generate bill");
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
    // Check if already printing
    if (printingBills.has(billKey)) {
      return;
    }
    setPrintingBills(prev => new Set(prev).add(billKey));
    try {
      const doctorName = bill.doctor?.name ? bill.doctor.name : (bill.doctor_id ? getDoctorName(bill.doctor_id) : 'Walk-in');
      const billItems = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items || [];
      const billDate = bill.date ? new Date(bill.date).toLocaleDateString() : (bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : 'N/A');
      const timestamp = Date.now();
      const windowName = `medstock_bill_${billKey}_${timestamp}`;
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
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.4; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;}
            .header h1 { margin: 0; font-size: 24px; }
            .bill-info { margin: 20px 0; }
            .bill-info p { margin: 5px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .items-table th { background-color: #f2f2f2; font-weight: bold;}
            .total-section { margin-top: 20px; text-align: right; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            @media print { body { margin: 0; } .header { page-break-after: avoid; } .items-table { page-break-inside: avoid; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>MedStock Pharmacy</h1>
            <p>Bill #${bill.bill_no}</p>
          </div>
          <div class="bill-info">
            <p><strong>Date:</strong> ${billDate}</p>
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
            <p><strong>Subtotal: Rs ${bill.total_amount || 0}</strong></p>
            ${bill.discount > 0 ? `<p>Discount (${bill.discount}%): -Rs ${((bill.total_amount || 0) * (bill.discount || 0) / 100).toFixed(2)}</p>` : ''}
            <h3>Total: Rs ${bill.total_amount || 0}</h3>
          </div>
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
          <script>
            let printExecuted = false;
            function executePrint() {
              if (printExecuted) { return; }
              printExecuted = true;
              setTimeout(() => {
                window.print();
                setTimeout(() => {
                  try {
                    if (window.opener && window.opener.setPrintingBills) {
                      window.opener.setPrintingBills(prev => {
                        const newSet = new Set(prev);
                        newSet.delete('${billKey}');
                        return newSet;
                      });
                    }
                  } catch(e) {}
                  window.close();
                }, 2000);
              }, 500);
            }
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', executePrint);
            } else {
              executePrint();
            }
            window.addEventListener('beforeunload', function() {
              try {
                if (window.opener && window.opener.setPrintingBills) {
                  window.opener.setPrintingBills(prev => {
                    const newSet = new Set(prev);
                    newSet.delete('${billKey}');
                    return newSet;
                  });
                }
              } catch(e) {}
            });
          </script>
        </body>
        </html>`;
      printWindow.document.write(printContent);
      printWindow.document.close();
    } catch (error) {
      console.error('Error in printBill:', error);
      setPrintingBills(prev => {
        const newSet = new Set(prev);
        newSet.delete(billKey);
        return newSet;
      });
    }
    setTimeout(() => {
      setPrintingBills(prev => {
        if (prev.has(billKey)) {
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
      <div className="p-2 sm:p-4 flex items-center justify-center min-h-[40vh] w-full">
        <div className="text-center w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-base sm:text-lg">Loading billing data...</p>
        </div>
        <Toast />
      </div>
    );
  }

  // Get unique payment methods and vendors for dropdowns
  const paymentOptions = Array.from(new Set(bills.map(b => b.payment_method || "cash")));
  const vendorOptions = Array.from(new Set(
    bills.flatMap(b => {
      try {
        const items = typeof b.items === 'string' ? JSON.parse(b.items || '[]') : b.items || [];
        return items.map(i => i.vendor_name).filter(Boolean);
      } catch { return []; }
    })
  ));

  // Filter bills by payment and vendor
  let filteredBills = bills.filter(bill => {
    const matchesPayment = paymentFilter ? (bill.payment_method || "cash") === paymentFilter : true;
    let matchesVendor = true;
    if (vendorFilter) {
      try {
        const items = typeof bill.items === 'string' ? JSON.parse(bill.items || '[]') : bill.items || [];
        matchesVendor = items.some(i => i.vendor_name === vendorFilter);
      } catch { matchesVendor = false; }
    }
    return matchesPayment && matchesVendor;
  });

  // Sort bills
  filteredBills = filteredBills.sort((a, b) => {
    let valA = a[sortField] || "";
    let valB = b[sortField] || "";
    if (sortField === "total") {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    } else if (sortField === "created_at") {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    } else if (typeof valA === "string" && typeof valB === "string") {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }
    // Always descending
    if (valA < valB) return 1;
    if (valA > valB) return -1;
    return 0;
  });

  // PAGINATION LOGIC for the bill history table
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage) || 1;
  const paginatedBills = filteredBills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totals = calculateTotals();

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-full w-full mx-auto">
      <Toast />
      {/* ...existing summary/statistics/cards and error messages... */}
      {/* ...existing code up to bill history table... */}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Bills History</h2>
            <div className="flex gap-2 items-center">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                onClick={() => navigate('/billing/new')}
              >
                <PlusIcon className="h-4 w-4 inline-block mr-1" /> Create Bill
              </button>
              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
                className="py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              >
                <option value="">All Payments</option>
                {paymentOptions.map(opt => (
                  <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                ))}
              </select>
              <select
                value={vendorFilter}
                onChange={e => setVendorFilter(e.target.value)}
                className="py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              >
                <option value="">All Vendors</option>
                {vendorOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <span className="text-gray-700 font-medium ml-2">Sort by:</span>
              <select
                value={sortField}
                onChange={e => setSortField(e.target.value)}
                className="py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              >
                <option value="created_at">Date</option>
                <option value="total">Total</option>
                <option value="payment_method">Payment</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>
          </div>
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
              {paginatedBills.length > 0 ? (
                paginatedBills.map((bill, index) => {
                  const items = typeof bill.items === 'string' ? JSON.parse(bill.items || '[]') : bill.items || [];
                  // Vendors logic: get unique vendor names from items
                  const vendorsInBill = items.length > 0 ? [...new Set(items.map(i => i.vendor_name).filter(Boolean))].join(', ') : 'N/A';
                  // Doctor logic: show doctor name if available, else 'Walk-in'
                  const doctorName = bill.doctor?.name ? bill.doctor.name : (bill.doctor ? 'Unknown Doctor' : 'Walk-in');
                  // Date logic: use bill.date if available, else createdAt
                  const billDate = bill.date ? new Date(bill.date).toLocaleDateString() : (bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : 'N/A');

                  return (
                    <tr key={bill.bill_id || `bill-${index + (currentPage - 1) * itemsPerPage}`} className="hover:bg-gray-50">
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
                        {billDate}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {items.length} items
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        Rs {bill.total_amount}
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
          {/* PAGINATION CONTROLS for bill history */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
                >
                  Prev
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`px-3 py-1 rounded ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Rows per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={e => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="py-1 px-2 border border-gray-300 rounded"
                >
                  {[10, 20, 50, 100].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Billing;