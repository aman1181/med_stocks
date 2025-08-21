import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  CubeIcon, 
  DocumentTextIcon, 
  BuildingOfficeIcon, 
  UserIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';

const Sidebar = ({ user, onLogout, isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Role-based menu configuration
  const getMenuItems = (userRole) => {
    const baseItems = [
      { id: "dashboard", name: "Dashboard", icon: HomeIcon, path: "/dashboard", roles: ['admin', 'pharmacist', 'audit'] },
      { id: "inventory", name: "Inventory", icon: CubeIcon, path: "/inventory", roles: ['admin', 'pharmacist', 'audit'] },
      { id: "billing", name: "Billing", icon: DocumentTextIcon, path: "/billing", roles: ['admin', 'pharmacist'] },
      { id: "vendors", name: "Vendors", icon: BuildingOfficeIcon, path: "/vendors", roles: ['admin', 'pharmacist', 'audit'] },
      { id: "doctors", name: "Doctors", icon: UserIcon, path: "/doctors", roles: ['admin', 'pharmacist', 'audit'] },
      { id: "reports", name: "Reports", icon: ChartBarIcon, path: "/reports", roles: ['admin', 'audit', 'pharmacist'] },
    ];

    // Admin-only items
    if (userRole === 'admin') {
      baseItems.push({
        id: "users",
        name: "User Management", 
        icon: UsersIcon,
        path: "/users",
        roles: ['admin']
      });
    }

    // Filter items based on user role
    return baseItems.filter(item => item.roles.includes(userRole));
  };

  const menuItems = getMenuItems(user?.role || 'guest');

  const handleMenuClick = (item) => {
    navigate(item.path);
    
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768 && setIsOpen) {
      setIsOpen(false);
    }
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const getCurrentScreen = () => {
    const path = location.pathname;
    const currentItem = menuItems.find(item => item.path === path);
    return currentItem?.id || 'dashboard';
  };

  const currentScreen = getCurrentScreen();

  const getRoleDisplayName = (role) => {
    const roleMap = {
      'admin': 'Administrator',
      'pharmacist': 'Pharmacist',
      'audit': 'Auditor'
    };
    return roleMap[role] || role;
  };

  const getRoleBadgeColor = (role) => {
    const colorMap = {
      'admin': 'bg-red-500',
      'pharmacist': 'bg-green-500',
      'audit': 'bg-blue-500'
    };
    return colorMap[role] || 'bg-gray-500';
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsOpen && setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-blue-900 to-purple-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">MedStock</h2>
              <p className="text-blue-200 text-sm mt-1">Pharmacy Management</p>
              {user && (
                <p className="text-blue-300 text-xs mt-1">
                  Welcome, {user.username}
                </p>
              )}
            </div>
            
            {/* Close button for mobile */}
            <button
              onClick={() => setIsOpen && setIsOpen(false)}
              className="md:hidden text-blue-200 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* User Info Card */}
        {user && (
          <div className="flex-shrink-0 m-4 p-3 bg-blue-800 bg-opacity-50 rounded-lg border border-blue-600">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {user.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {user.username || 'Unknown User'}
                </p>
                <div className="flex items-center mt-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${getRoleBadgeColor(user.role)} mr-2`}></span>
                  <p className="text-blue-200 text-xs truncate">
                    {getRoleDisplayName(user.role)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto min-h-0">
          <div className="px-4 py-2">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleMenuClick(item)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 text-left group ${
                        currentScreen === item.id
                          ? "bg-white text-blue-900 shadow-lg transform scale-105"
                          : "text-blue-100 hover:bg-blue-800 hover:text-white hover:transform hover:scale-105"
                      }`}
                    >
                      <IconComponent className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{item.name}</span>
                      
                      {/* Active indicator */}
                      {currentScreen === item.id && (
                        <div className="ml-auto">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            
            {/* Role-based access indicator */}
            {user?.role === 'audit' && (
              <div className="mt-4 p-3 bg-blue-800 bg-opacity-30 rounded-lg border border-blue-600">
                <div className="flex items-center text-blue-200 text-xs">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                  <span>Read-only audit access</span>
                </div>
              </div>
            )}
            
            <div className="h-4"></div>
          </div>
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-blue-700">
          {user && (
            <button
              onClick={handleLogout}
              className="w-full mb-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 font-medium transform hover:scale-105 flex items-center justify-center space-x-2"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              <span>Logout</span>
            </button>
          )}
          
          {/* Version Info */}
          <div className="text-center text-blue-200 text-sm">
            <p className="font-medium">© 2025 MedStock</p>
            <p className="text-xs opacity-75">Version 1.0.0</p>
            <p className="text-xs opacity-75 mt-1">
              {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;