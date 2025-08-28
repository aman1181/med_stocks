import React, { useState, useEffect } from 'react';
import { ToastProvider } from './components/ToastContext.jsx';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CreateBill from './screens/CreateBill.jsx';
import Layout from "./components/Layout";
import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import UserManagement from "./components/UserManagement";
import Billing from "./screens/Billing";
import Inventory from "./screens/Inventory";
import Reports from "./screens/Reports";
import Vendors from "./screens/Vendors";
import CreateDoctor from './screens/CreateDoctor.jsx';
import UpdateDoctor from './screens/UpdateDoctor.jsx';
import Doctors from "./screens/Doctors";
import CreateVendor from "./screens/CreateVendor";
import UpdateVendor from "./screens/UpdateVendor";
import AddProduct from './screens/AddProduct.jsx';
import EditProduct from './screens/EditProduct.jsx';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr && userStr !== 'undefined' && userStr !== 'null') {
      setUser(JSON.parse(userStr));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Main dashboard and modules with sidebar */}
          <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}> 
            <Route index element={<Dashboard user={user} onLogout={handleLogout} />} />
            <Route path="dashboard" element={<Dashboard user={user} onLogout={handleLogout} />} />
            <Route path="inventory" element={<Inventory user={user} onLogout={handleLogout} />} />
            <Route path="vendors" element={<Vendors user={user} onLogout={handleLogout} />} />
            <Route path="doctors" element={<Doctors user={user} onLogout={handleLogout} />} />
            <Route path="billing" element={<Billing user={user} onLogout={handleLogout} />} />
            <Route path="reports" element={<Reports user={user} onLogout={handleLogout} />} />
            <Route path="users" element={<UserManagement user={user} onLogout={handleLogout} />} />
          </Route>
          {/* CreateBill and other screens without sidebar */}
          <Route path="/billing/new" element={<CreateBill user={user} onLogout={handleLogout} />} />
          <Route path="/inventory/add" element={<AddProduct user={user} onLogout={handleLogout} />} />
          <Route path="/inventory/edit/:productId" element={<EditProduct user={user} onLogout={handleLogout} />} />
          {/* Vendor create/update screens without sidebar */}
          <Route path="/vendors/create" element={<CreateVendor user={user} onLogout={handleLogout} />} />
          <Route path="/vendors/update/:id" element={<UpdateVendor user={user} onLogout={handleLogout} />} />
          {/* Doctor create/update screens without sidebar */}
          <Route path="/doctors/create" element={<CreateDoctor user={user} onLogout={handleLogout} />} />
          <Route path="/doctors/update/:id" element={<UpdateDoctor user={user} onLogout={handleLogout} />} />
          {/* Login route outside layout */}
          <Route path="/login" element={<Login onLogin={setUser} />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}