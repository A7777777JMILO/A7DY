import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import './App.css';

// Context for authentication
const AuthContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configure axios defaults
axios.defaults.baseURL = API;

// Axios interceptor to add auth token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth Provider Component
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await axios.post('/auth/login', formData);
    localStorage.setItem('token', response.data.access_token);
    await fetchUserInfo();
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Login Component
const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (error) {
      setError(error.response?.data?.detail || 'خطأ في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-500 to-blue-600 rounded-full mb-4">
            <span className="text-2xl">⚡️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">A7delivery Orders</h1>
          <p className="text-gray-600">نظام إدارة الطلبات المتقدم</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اسم المستخدم
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="أدخل اسم المستخدم"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="أدخل كلمة المرور"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-blue-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            تطبيق ربط Shopify مع ZRExpress
          </p>
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiSettings, setApiSettings] = useState({});
  const [users, setUsers] = useState([]);
  const { user, logout } = useAuth();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadOrders(),
        loadStats(),
        loadAPISettings(),
        user?.role === 'admin' ? loadUsers() : Promise.resolve()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await axios.get('/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get('/orders/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadAPISettings = async () => {
    try {
      const response = await axios.get('/settings/api');
      setApiSettings(response.data);
    } catch (error) {
      console.error('Error loading API settings:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const syncFromShopify = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/orders/sync');
      alert(response.data.message);
      await loadOrders();
      await loadStats();
    } catch (error) {
      alert(error.response?.data?.detail || 'خطأ في المزامنة');
    } finally {
      setLoading(false);
    }
  };

  const sendToZRExpress = async () => {
    if (selectedOrders.length === 0) {
      alert('يرجى تحديد طلبات للإرسال');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/orders/send-selected', selectedOrders);
      
      if (response.data.success) {
        alert(response.data.message);
        await loadOrders();
        await loadStats();
        setSelectedOrders([]);
      } else {
        alert(`خطأ: ${response.data.error}`);
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'خطأ في الإرسال');
    } finally {
      setLoading(false);
    }
  };

  const saveAPISettings = async (newSettings) => {
    try {
      await axios.post('/settings/api', newSettings);
      setApiSettings(newSettings);
      alert('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      alert('خطأ في حفظ الإعدادات');
    }
  };

  const testShopifyConnection = async () => {
    try {
      const response = await axios.post('/test/shopify');
      if (response.data.success) {
        alert(`✅ نجح الاتصال مع Shopify\nالمتجر: ${response.data.shop_name}`);
      } else {
        alert(`❌ فشل الاتصال: ${response.data.error}`);
      }
    } catch (error) {
      alert('خطأ في اختبار الاتصال');
    }
  };

  const testZRExpressConnection = async () => {
    try {
      const response = await axios.post('/test/zrexpress');
      if (response.data.success) {
        alert('✅ نجح الاتصال مع ZRExpress');
      } else {
        alert(`❌ فشل الاتصال: ${response.data.error}`);
      }
    } catch (error) {
      alert('خطأ في اختبار الاتصال');
    }
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const selectAllOrders = () => {
    const allOrderIds = orders.map(order => order.id);
    setSelectedOrders(
      selectedOrders.length === orders.length ? [] : allOrderIds
    );
  };

  // Sidebar Navigation
  const Sidebar = () => (
    <div className="bg-white shadow-lg h-screen w-64 fixed right-0 top-0 z-50">
      <div className="p-6 border-b bg-gradient-to-r from-orange-500 to-blue-600">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <span className="text-2xl">⚡️</span>
          <div>
            <h1 className="text-xl font-bold text-white">A7delivery</h1>
            <p className="text-sm text-orange-100">{user?.username}</p>
          </div>
        </div>
      </div>
      
      <nav className="p-4">
        <button
          onClick={() => setActiveTab('orders')}
          className={`w-full text-right p-3 rounded-lg mb-2 transition-all ${
            activeTab === 'orders' 
              ? 'bg-orange-100 text-orange-600 font-semibold' 
              : 'hover:bg-gray-100'
          }`}
        >
          📦 إدارة الطلبات
        </button>
        
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full text-right p-3 rounded-lg mb-2 transition-all ${
            activeTab === 'settings' 
              ? 'bg-orange-100 text-orange-600 font-semibold' 
              : 'hover:bg-gray-100'
          }`}
        >
          ⚙️ الإعدادات
        </button>

        {user?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`w-full text-right p-3 rounded-lg mb-2 transition-all ${
              activeTab === 'users' 
                ? 'bg-orange-100 text-orange-600 font-semibold' 
                : 'hover:bg-gray-100'
            }`}
          >
            👥 إدارة المستخدمين
          </button>
        )}
        
        <button
          onClick={logout}
          className="w-full text-right p-3 rounded-lg mt-8 text-red-600 hover:bg-red-50 transition-all"
        >
          🚪 تسجيل الخروج
        </button>
      </nav>
    </div>
  );

  // Stats Cards Component
  const StatsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-xl shadow-lg border-r-4 border-blue-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">إجمالي الطلبات</p>
            <p className="text-2xl font-bold text-blue-600">{stats.total || 0}</p>
          </div>
          <span className="text-3xl">📊</span>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-lg border-r-4 border-yellow-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">في الانتظار</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</p>
          </div>
          <span className="text-3xl">⏳</span>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-lg border-r-4 border-orange-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">قيد المعالجة</p>
            <p className="text-2xl font-bold text-orange-600">{stats.processing || 0}</p>
          </div>
          <span className="text-3xl">🔄</span>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-lg border-r-4 border-green-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">تم الإرسال</p>
            <p className="text-2xl font-bold text-green-600">{stats.sent || 0}</p>
          </div>
          <span className="text-3xl">✅</span>
        </div>
      </div>
    </div>
  );

  // Orders Tab Component
  const OrdersTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">إدارة الطلبات</h2>
        <div className="flex space-x-4 rtl:space-x-reverse">
          <button
            onClick={syncFromShopify}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            🔄 مزامنة من Shopify
          </button>
          
          <button
            onClick={sendToZRExpress}
            disabled={loading || selectedOrders.length === 0}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            🚚 إرسال إلى ZRExpress ({selectedOrders.length})
          </button>
        </div>
      </div>

      <StatsCards />

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b bg-gray-50">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">قائمة الطلبات</h3>
            <button
              onClick={selectAllOrders}
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              {selectedOrders.length === orders.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-4 text-right">تحديد</th>
                <th className="p-4 text-right">رقم الطلب</th>
                <th className="p-4 text-right">اسم العميل</th>
                <th className="p-4 text-right">الهاتف</th>
                <th className="p-4 text-right">المبلغ</th>
                <th className="p-4 text-right">الحالة</th>
                <th className="p-4 text-right">التاريخ</th>
                <th className="p-4 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                  </td>
                  <td className="p-4 font-medium">{order.order_number}</td>
                  <td className="p-4">{order.customer_name}</td>
                  <td className="p-4">{order.customer_phone}</td>
                  <td className="p-4">${order.total_price}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'sent' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {
                        order.status === 'pending' ? 'في الانتظار' :
                        order.status === 'processing' ? 'قيد المعالجة' :
                        order.status === 'sent' ? 'تم الإرسال' :
                        order.status
                      }
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {new Date(order.created_at).toLocaleDateString('ar')}
                  </td>
                  <td className="p-4">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {orders.length === 0 && (
            <div className="text-center py-12">
              <span className="text-6xl">📦</span>
              <p className="text-gray-600 mt-4">لا توجد طلبات</p>
              <p className="text-sm text-gray-500">قم بالمزامنة من Shopify لجلب الطلبات</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Settings Tab Component
  const SettingsTab = () => {
    const [localSettings, setLocalSettings] = useState(apiSettings);

    const handleSave = () => {
      saveAPISettings(localSettings);
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">إعدادات API</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Shopify Settings */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center space-x-3 rtl:space-x-reverse mb-6">
              <span className="text-2xl">🛍</span>
              <h3 className="text-xl font-semibold">إعدادات Shopify</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رابط المتجر (Store URL)
                </label>
                <input
                  type="text"
                  value={localSettings.shopify_store_url || ''}
                  onChange={(e) => setLocalSettings({...localSettings, shopify_store_url: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="your-store.myshopify.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رمز الوصول (Access Token)
                </label>
                <input
                  type="password"
                  value={localSettings.shopify_access_token || ''}
                  onChange={(e) => setLocalSettings({...localSettings, shopify_access_token: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="shpat_xxxxxxxxxxxxx"
                />
              </div>
              
              <button
                onClick={testShopifyConnection}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                اختبار الاتصال
              </button>
            </div>
          </div>

          {/* ZRExpress Settings */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center space-x-3 rtl:space-x-reverse mb-6">
              <span className="text-2xl">🚚</span>
              <h3 className="text-xl font-semibold">إعدادات ZRExpress</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token
                </label>
                <input
                  type="password"
                  value={localSettings.zrexpress_token || ''}
                  onChange={(e) => setLocalSettings({...localSettings, zrexpress_token: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="أدخل Token"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key
                </label>
                <input
                  type="password"
                  value={localSettings.zrexpress_key || ''}
                  onChange={(e) => setLocalSettings({...localSettings, zrexpress_key: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="أدخل Key"
                />
              </div>
              
              <button
                onClick={testZRExpressConnection}
                className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                اختبار الاتصال
              </button>
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-gradient-to-r from-orange-500 to-blue-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-blue-700 transition-all"
          >
            💾 حفظ الإعدادات
          </button>
        </div>
      </div>
    );
  };

  // Users Tab Component (Admin only)
  const UsersTab = () => {
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUser, setNewUser] = useState({username: '', password: ''});

    const handleAddUser = async (e) => {
      e.preventDefault();
      try {
        await axios.post('/users', newUser);
        alert('تم إنشاء المستخدم بنجاح');
        setNewUser({username: '', password: ''});
        setShowAddUser(false);
        await loadUsers();
      } catch (error) {
        alert(error.response?.data?.detail || 'خطأ في إنشاء المستخدم');
      }
    };

    const toggleUserStatus = async (userId) => {
      try {
        const response = await axios.patch(`/users/${userId}/toggle`);
        alert(response.data.message);
        await loadUsers();
      } catch (error) {
        alert('خطأ في تعديل حالة المستخدم');
      }
    };

    const deleteUser = async (userId) => {
      if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
        try {
          await axios.delete(`/users/${userId}`);
          alert('تم حذف المستخدم بنجاح');
          await loadUsers();
        } catch (error) {
          alert('خطأ في حذف المستخدم');
        }
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">إدارة المستخدمين</h2>
          <button
            onClick={() => setShowAddUser(true)}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            ➕ إضافة مستخدم جديد
          </button>
        </div>

        {showAddUser && (
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold mb-4">إضافة مستخدم جديد</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم المستخدم
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
              <div className="flex space-x-4 rtl:space-x-reverse">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  إنشاء المستخدم
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b bg-gray-50">
            <h3 className="text-lg font-semibold">قائمة المستخدمين</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-4 text-right">اسم المستخدم</th>
                  <th className="p-4 text-right">الحالة</th>
                  <th className="p-4 text-right">تاريخ الإنشاء</th>
                  <th className="p-4 text-right">تاريخ الانتهاء</th>
                  <th className="p-4 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">{user.username}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('ar')}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {user.expires_at ? new Date(user.expires_at).toLocaleDateString('ar') : 'مفتوح'}
                    </td>
                    <td className="p-4 space-x-2 rtl:space-x-reverse">
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        className={`px-3 py-1 rounded text-sm ${
                          user.is_active 
                            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                            : 'bg-green-100 text-green-600 hover:bg-green-200'
                        }`}
                      >
                        {user.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="px-3 py-1 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {users.length === 0 && (
              <div className="text-center py-12">
                <span className="text-6xl">👥</span>
                <p className="text-gray-600 mt-4">لا يوجد مستخدمون</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      <Sidebar />
      
      <div className="mr-64 p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'users' && user?.role === 'admin' && <UsersTab />}
        </div>
      </div>
    </div>
  );
};

// Main App Component
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
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-blue-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">A7delivery Orders</p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginPage />;
};

export default App;