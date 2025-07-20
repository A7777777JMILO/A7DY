import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'فشل تسجيل الدخول');
      }

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = { user, login, logout, loading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// API Helper
const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  };

  const response = await fetch(`${API}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'حدث خطأ');
  }

  return response.json();
};

// Components
const LoginForm = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(formData.username, formData.password);
    } catch (error) {
      setError(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">A7delivery Orders</h1>
          <p className="text-gray-600">نظام إدارة الطلبات والتوصيل</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اسم المستخدم
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              كلمة المرور
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {loading ? 'جارٍ تسجيل الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Header = ({ onNavigate, currentPage }) => {
  const { user, logout } = useAuth();

  const navigation = [
    { id: 'orders', label: 'الطلبات', icon: '📦' },
    { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
  ];

  if (user.role === 'admin') {
    navigation.push({ id: 'users', label: 'إدارة المستخدمين', icon: '👥' });
  }

  return (
    <header className="bg-white shadow-md border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-blue-600">A7delivery Orders</h1>
          </div>

          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === item.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">مرحباً، {user.username}</span>
            <button
              onClick={logout}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              خروج
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [sendingOrders, setSendingOrders] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/shopify/orders');
      setOrders(data);
    } catch (error) {
      alert('فشل في جلب الطلبات: ' + error.message);
    }
    setLoading(false);
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(order => order.id));
    }
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSendToZRExpress = async () => {
    if (selectedOrders.length === 0) {
      alert('يرجى تحديد طلبات للإرسال');
      return;
    }

    setSendingOrders(true);
    try {
      const ordersToSend = orders
        .filter(order => selectedOrders.includes(order.id))
        .map(order => ({
          shopify_id: order.id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          shipping_address: order.shipping_address,
          city: order.city,
          total_price: order.total_price,
          status: order.status,
          id_wilaya: "31", // Default Algiers
          items: order.items
        }));

      const response = await apiCall('/zrexpress/send', {
        method: 'POST',
        body: JSON.stringify(ordersToSend)
      });

      alert(`تم إرسال ${selectedOrders.length} طلب بنجاح إلى ZRExpress`);
      setSelectedOrders([]);
    } catch (error) {
      alert('فشل في إرسال الطلبات: ' + error.message);
    }
    setSendingOrders(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">إدارة الطلبات</h2>
        <div className="flex space-x-4">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'جارٍ التحديث...' : 'تحديث من Shopify'}
          </button>
          {selectedOrders.length > 0 && (
            <button
              onClick={handleSendToZRExpress}
              disabled={sendingOrders}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {sendingOrders ? 'جارٍ الإرسال...' : `إرسال ${selectedOrders.length} إلى ZRExpress`}
            </button>
          )}
        </div>
      </div>

      {orders.length > 0 && (
        <div className="mb-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedOrders.length === orders.length}
              onChange={handleSelectAll}
              className="rounded text-blue-600"
            />
            <span className="text-sm text-gray-700">تحديد الكل ({orders.length} طلب)</span>
          </label>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">
              {loading ? 'جارٍ تحميل الطلبات...' : 'لا توجد طلبات. اضغط "تحديث من Shopify" لجلب الطلبات'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    تحديد
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    رقم الطلب
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    اسم العميل
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    الهاتف
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    العنوان
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    المبلغ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    الحالة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className={selectedOrders.includes(order.id) ? 'bg-blue-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => handleSelectOrder(order.id)}
                        className="rounded text-blue-600"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{order.order_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.customer_phone || 'غير محدد'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {order.shipping_address}, {order.city}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.total_price} د.ج
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        order.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setEditingOrder(order)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        تعديل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    shopify_url: '',
    shopify_token: '',
    zrexpress_token: '',
    zrexpress_key: ''
  });
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await apiCall('/settings');
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiCall('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      alert('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      alert('فشل في حفظ الإعدادات: ' + error.message);
    }
    setLoading(false);
  };

  const testConnections = async () => {
    setLoading(true);
    try {
      const status = await apiCall('/settings/test', { method: 'POST' });
      setConnectionStatus(status);
    } catch (error) {
      alert('فشل في اختبار الاتصالات: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">إعدادات الـ API</h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🛍️</span>
              إعدادات Shopify
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رابط المتجر
                </label>
                <input
                  type="text"
                  placeholder="yourstore.myshopify.com"
                  value={settings.shopify_url || ''}
                  onChange={(e) => setSettings({ ...settings, shopify_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin API Access Token
                </label>
                <input
                  type="password"
                  value={settings.shopify_token || ''}
                  onChange={(e) => setSettings({ ...settings, shopify_token: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🚚</span>
              إعدادات ZRExpress
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Token
                </label>
                <input
                  type="password"
                  value={settings.zrexpress_token || ''}
                  onChange={(e) => setSettings({ ...settings, zrexpress_token: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.zrexpress_key || ''}
                  onChange={(e) => setSettings({ ...settings, zrexpress_key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {Object.keys(connectionStatus).length > 0 && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium text-gray-900 mb-2">حالة الاتصال:</h4>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className={`w-3 h-3 rounded-full mr-2 ${
                    connectionStatus.shopify ? 'bg-green-400' : 'bg-red-400'
                  }`}></span>
                  <span>Shopify: {connectionStatus.shopify ? 'متصل' : 'غير متصل'}</span>
                </div>
                <div className="flex items-center">
                  <span className={`w-3 h-3 rounded-full mr-2 ${
                    connectionStatus.zrexpress ? 'bg-green-400' : 'bg-red-400'
                  }`}></span>
                  <span>ZRExpress: {connectionStatus.zrexpress ? 'متصل' : 'غير متصل'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
            >
              {loading ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
            </button>
            <button
              onClick={testConnections}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
            >
              {loading ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiCall('/users');
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) {
      alert('يرجى إدخال جميع البيانات');
      return;
    }

    setLoading(true);
    try {
      await apiCall('/users', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      setNewUser({ username: '', password: '' });
      setShowAddUser(false);
      fetchUsers();
      alert('تم إضافة المستخدم بنجاح');
    } catch (error) {
      alert('فشل في إضافة المستخدم: ' + error.message);
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;

    try {
      await apiCall(`/users/${userId}`, { method: 'DELETE' });
      fetchUsers();
      alert('تم حذف المستخدم بنجاح');
    } catch (error) {
      alert('فشل في حذف المستخدم: ' + error.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">إدارة المستخدمين</h2>
        <button
          onClick={() => setShowAddUser(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
        >
          إضافة مستخدم جديد
        </button>
      </div>

      {showAddUser && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">إضافة مستخدم جديد</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                اسم المستخدم
              </label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                كلمة المرور
              </label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex space-x-2">
            <button
              onClick={handleAddUser}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
            >
              {loading ? 'جارٍ الإضافة...' : 'إضافة'}
            </button>
            <button
              onClick={() => setShowAddUser(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md font-medium"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                اسم المستخدم
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                تاريخ الإنشاء
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                إجراءات
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(user.created_at).toLocaleDateString('ar-SA')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [currentPage, setCurrentPage] = useState('orders');

  const renderPage = () => {
    switch (currentPage) {
      case 'orders':
        return <OrdersPage />;
      case 'settings':
        return <SettingsPage />;
      case 'users':
        return <UsersPage />;
      default:
        return <OrdersPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigate={setCurrentPage} currentPage={currentPage} />
      {renderPage()}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">جارٍ تحميل التطبيق...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return <Dashboard />;
};

export default App;