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

// Flash Delivery inspired Login Component
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
    <div className="login-container">
      <div className="login-bg-overlay"></div>
      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-container">
              <div className="logo-icon">
                <span className="flash-icon">⚡</span>
              </div>
              <h1 className="logo-text">A7delivery</h1>
            </div>
            <p className="login-subtitle">نظام إدارة الطلبات الاحترافي</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">👤</span>
                اسم المستخدم
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="form-input"
                placeholder="أدخل اسم المستخدم"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🔒</span>
                كلمة المرور
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="form-input"
                placeholder="أدخل كلمة المرور"
                required
              />
            </div>

            {error && (
              <div className="error-alert">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-button"
            >
              {loading ? (
                <span className="loading-spinner">
                  <span className="spinner"></span>
                  جارٍ تسجيل الدخول...
                </span>
              ) : (
                <span>
                  <span className="button-icon">🚀</span>
                  دخول
                </span>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p className="powered-by">مدعوم بواسطة تقنيات A7delivery المتطورة</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Flash Delivery inspired Sidebar
const Sidebar = ({ onNavigate, currentPage }) => {
  const { user, logout } = useAuth();

  const navigation = [
    { id: 'orders', label: 'الطلبات', icon: '📦', color: 'orange' },
    { id: 'settings', label: 'الإعدادات', icon: '⚙️', color: 'blue' },
  ];

  if (user.role === 'admin') {
    navigation.push({ id: 'users', label: 'إدارة المستخدمين', icon: '👥', color: 'green' });
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-flash">⚡</span>
          <span className="logo-name">A7delivery</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navigation.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`nav-item ${currentPage === item.id ? 'active' : ''} nav-${item.color}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {currentPage === item.id && <span className="nav-active-indicator"></span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <span className="user-name">{user.username}</span>
            <span className="user-role">{user.role === 'admin' ? 'مدير' : 'مستخدم'}</span>
          </div>
        </div>
        <button onClick={logout} className="logout-button">
          <span className="logout-icon">🚪</span>
          خروج
        </button>
      </div>
    </div>
  );
};

// Flash Delivery inspired Header
const Header = ({ title, actions }) => {
  return (
    <div className="main-header">
      <div className="header-content">
        <div className="header-title">
          <h1>{title}</h1>
        </div>
        {actions && <div className="header-actions">{actions}</div>}
      </div>
    </div>
  );
};

// Flash Delivery inspired Stats Cards
const StatsCard = ({ icon, title, value, color }) => {
  return (
    <div className={`stats-card ${color}`}>
      <div className="stats-icon">{icon}</div>
      <div className="stats-content">
        <div className="stats-value">{value}</div>
        <div className="stats-title">{title}</div>
      </div>
    </div>
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

  const headerActions = (
    <div className="header-action-group">
      <button
        onClick={fetchOrders}
        disabled={loading}
        className="action-button primary"
      >
        <span className="button-icon">🔄</span>
        {loading ? 'جارٍ التحديث...' : 'تحديث من Shopify'}
      </button>
      {selectedOrders.length > 0 && (
        <button
          onClick={handleSendToZRExpress}
          disabled={sendingOrders}
          className="action-button success"
        >
          <span className="button-icon">📤</span>
          {sendingOrders ? 'جارٍ الإرسال...' : `إرسال ${selectedOrders.length} إلى ZRExpress`}
        </button>
      )}
    </div>
  );

  return (
    <div className="page-content">
      <Header title="إدارة الطلبات" actions={headerActions} />
      
      <div className="stats-grid">
        <StatsCard icon="📦" title="إجمالي الطلبات" value={orders.length} color="blue" />
        <StatsCard icon="✅" title="محددة للإرسال" value={selectedOrders.length} color="green" />
        <StatsCard icon="🚚" title="جاهزة للشحن" value={orders.filter(o => o.status === 'paid').length} color="orange" />
        <StatsCard icon="⏳" title="قيد المراجعة" value={orders.filter(o => o.status === 'pending').length} color="yellow" />
      </div>

      {orders.length > 0 && (
        <div className="bulk-actions">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={selectedOrders.length === orders.length}
              onChange={handleSelectAll}
              className="bulk-checkbox"
            />
            <span className="checkmark"></span>
            <span className="checkbox-label">تحديد الكل ({orders.length} طلب)</span>
          </label>
        </div>
      )}

      <div className="orders-table-container">
        {orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">لا توجد طلبات</div>
            <div className="empty-description">
              {loading ? 'جارٍ تحميل الطلبات...' : 'اضغط "تحديث من Shopify" لجلب الطلبات'}
            </div>
          </div>
        ) : (
          <div className="flash-table">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>تحديد</th>
                  <th>رقم الطلب</th>
                  <th>العميل</th>
                  <th>الهاتف</th>
                  <th>العنوان</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className={selectedOrders.includes(order.id) ? 'selected' : ''}>
                    <td>
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => handleSelectOrder(order.id)}
                          className="row-checkbox"
                        />
                        <span className="checkmark"></span>
                      </label>
                    </td>
                    <td className="order-number">#{order.order_number}</td>
                    <td className="customer-name">{order.customer_name}</td>
                    <td className="customer-phone">{order.customer_phone || 'غير محدد'}</td>
                    <td className="shipping-address">{order.shipping_address}, {order.city}</td>
                    <td className="total-price">{order.total_price} د.ج</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {order.status === 'paid' ? 'مدفوع' : order.status === 'pending' ? 'معلق' : order.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setEditingOrder(order)}
                        className="edit-button"
                      >
                        ✏️ تعديل
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

  const headerActions = (
    <div className="header-action-group">
      <button
        onClick={testConnections}
        disabled={loading}
        className="action-button secondary"
      >
        <span className="button-icon">🔍</span>
        {loading ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
      </button>
      <button
        onClick={handleSave}
        disabled={loading}
        className="action-button primary"
      >
        <span className="button-icon">💾</span>
        {loading ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
      </button>
    </div>
  );

  return (
    <div className="page-content">
      <Header title="إعدادات الـ API" actions={headerActions} />

      <div className="settings-grid">
        <div className="settings-card">
          <div className="card-header">
            <span className="card-icon">🛍️</span>
            <h3>إعدادات Shopify</h3>
          </div>
          <div className="card-content">
            <div className="form-group">
              <label className="form-label">رابط المتجر</label>
              <input
                type="text"
                placeholder="yourstore.myshopify.com"
                value={settings.shopify_url || ''}
                onChange={(e) => setSettings({ ...settings, shopify_url: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Admin API Access Token</label>
              <input
                type="password"
                placeholder="shpat_xxxxxxxxxxxxx"
                value={settings.shopify_token || ''}
                onChange={(e) => setSettings({ ...settings, shopify_token: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
        </div>

        <div className="settings-card">
          <div className="card-header">
            <span className="card-icon">🚚</span>
            <h3>إعدادات ZRExpress</h3>
          </div>
          <div className="card-content">
            <div className="form-group">
              <label className="form-label">API Token</label>
              <input
                type="password"
                placeholder="436b0bc9005add01239a43435d502d197..."
                value={settings.zrexpress_token || ''}
                onChange={(e) => setSettings({ ...settings, zrexpress_token: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">API Key</label>
              <input
                type="password"
                placeholder="ae24d9fc203f43b19fd6cd8165662cae"
                value={settings.zrexpress_key || ''}
                onChange={(e) => setSettings({ ...settings, zrexpress_key: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
        </div>
      </div>

      {Object.keys(connectionStatus).length > 0 && (
        <div className="connection-status">
          <div className="status-header">
            <span className="status-icon">📡</span>
            <h3>حالة الاتصال</h3>
          </div>
          <div className="status-grid">
            <div className={`status-item ${connectionStatus.shopify ? 'connected' : 'disconnected'}`}>
              <span className="status-indicator"></span>
              <span className="status-label">Shopify: {connectionStatus.shopify ? 'متصل' : 'غير متصل'}</span>
            </div>
            <div className={`status-item ${connectionStatus.zrexpress ? 'connected' : 'disconnected'}`}>
              <span className="status-indicator"></span>
              <span className="status-label">ZRExpress: {connectionStatus.zrexpress ? 'متصل' : 'غير متصل'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced User Management Modal Components
const UserModal = ({ user, isOpen, onClose, onSave, title }) => {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: user ? '' : '',
    is_active: user?.is_active !== undefined ? user.is_active : true,
    expiry_date: user?.expiry_date ? new Date(user.expiry_date).toISOString().split('T')[0] : '',
    no_expiry: !user?.expiry_date
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        password: '',
        is_active: user.is_active !== undefined ? user.is_active : true,
        expiry_date: user.expiry_date ? new Date(user.expiry_date).toISOString().split('T')[0] : '',
        no_expiry: !user.expiry_date
      });
    }
  }, [user]);

  const handleSave = () => {
    const userData = {
      username: formData.username,
      ...(formData.password && { password: formData.password }),
      is_active: formData.is_active,
      expiry_date: formData.no_expiry ? null : (formData.expiry_date ? new Date(formData.expiry_date).toISOString() : null)
    };
    onSave(userData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">اسم المستخدم</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="form-input"
              placeholder="أدخل اسم المستخدم"
              disabled={!!user}
            />
          </div>

          {!user && (
            <div className="form-group">
              <label className="form-label">كلمة المرور</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="form-input"
                placeholder="أدخل كلمة مرور قوية"
              />
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span className="checkmark"></span>
              <span className="checkbox-label">حساب نشط</span>
            </label>
          </div>

          <div className="form-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={formData.no_expiry}
                onChange={(e) => setFormData({ ...formData, no_expiry: e.target.checked, expiry_date: '' })}
              />
              <span className="checkmark"></span>
              <span className="checkbox-label">بدون تاريخ انتهاء</span>
            </label>
          </div>

          {!formData.no_expiry && (
            <div className="form-group">
              <label className="form-label">تاريخ انتهاء الصالحية</label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="form-input"
              />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={handleSave} className="action-button success">
            <span className="button-icon">💾</span>
            حفظ
          </button>
          <button onClick={onClose} className="action-button secondary">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalData, setModalData] = useState({ isOpen: false, user: null, title: '' });

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

  const handleAddUser = () => {
    setModalData({ isOpen: true, user: null, title: 'إضافة مستخدم جديد' });
  };

  const handleEditUser = (user) => {
    setModalData({ isOpen: true, user, title: 'تعديل بيانات المستخدم' });
  };

  const handleSaveUser = async (userData) => {
    setLoading(true);
    try {
      if (modalData.user) {
        // Update user
        await apiCall(`/users/${modalData.user.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            is_active: userData.is_active,
            expiry_date: userData.expiry_date
          })
        });
        alert('تم تحديث بيانات المستخدم بنجاح');
      } else {
        // Create user
        await apiCall('/users', {
          method: 'POST',
          body: JSON.stringify(userData)
        });
        alert('تم إضافة المستخدم بنجاح');
      }
      
      setModalData({ isOpen: false, user: null, title: '' });
      fetchUsers();
    } catch (error) {
      alert('فشل في حفظ بيانات المستخدم: ' + error.message);
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

  const getStatusInfo = (user) => {
    if (!user.is_active) {
      return { status: 'معطل', color: 'red', icon: '🔴' };
    }
    
    if (user.expiry_date && new Date(user.expiry_date) < new Date()) {
      return { status: 'منتهي الصالحية', color: 'orange', icon: '⏰' };
    }
    
    if (user.expiry_date && new Date(user.expiry_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
      return { status: 'قريب الانتهاء', color: 'yellow', icon: '⚠️' };
    }
    
    return { status: 'نشط', color: 'green', icon: '✅' };
  };

  const headerActions = (
    <div className="header-action-group">
      <button
        onClick={handleAddUser}
        className="action-button primary"
      >
        <span className="button-icon">👤+</span>
        إضافة مستخدم جديد
      </button>
    </div>
  );

  const activeUsers = users.filter(u => u.is_active && (!u.expiry_date || new Date(u.expiry_date) > new Date()));
  const expiredUsers = users.filter(u => u.expiry_date && new Date(u.expiry_date) <= new Date());
  const inactiveUsers = users.filter(u => !u.is_active);

  return (
    <div className="page-content">
      <Header title="إدارة المستخدمين" actions={headerActions} />

      <div className="stats-grid">
        <StatsCard icon="👥" title="إجمالي المستخدمين" value={users.length} color="purple" />
        <StatsCard icon="✅" title="مستخدمين نشطين" value={activeUsers.length} color="green" />
        <StatsCard icon="⏰" title="منتهية الصالحية" value={expiredUsers.length} color="orange" />
        <StatsCard icon="🔴" title="حسابات معطلة" value={inactiveUsers.length} color="red" />
      </div>

      <div className="users-table-container">
        <div className="flash-table">
          <table className="users-table">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>تاريخ الإنشاء</th>
                <th>تاريخ انتهاء الصالحية</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const statusInfo = getStatusInfo(user);
                return (
                  <tr key={user.id}>
                    <td className="user-info">
                      <div className="user-avatar-mini">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="username">{user.username}</span>
                    </td>
                    <td className="created-date">
                      {new Date(user.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="expiry-date">
                      {user.expiry_date 
                        ? new Date(user.expiry_date).toLocaleDateString('ar-SA')
                        : 'بدون انتهاء'
                      }
                    </td>
                    <td>
                      <span className={`status-badge status-${statusInfo.color}`}>
                        {statusInfo.icon} {statusInfo.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="edit-button"
                          title="تعديل"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="delete-button"
                          title="حذف"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal
        user={modalData.user}
        isOpen={modalData.isOpen}
        onClose={() => setModalData({ isOpen: false, user: null, title: '' })}
        onSave={handleSaveUser}
        title={modalData.title}
      />
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
    <div className="dashboard-layout">
      <Sidebar onNavigate={setCurrentPage} currentPage={currentPage} />
      <div className="main-content">
        {renderPage()}
      </div>
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
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <span className="loading-flash">⚡</span>
            <span className="loading-text">A7delivery</span>
          </div>
          <div className="loading-spinner-large"></div>
          <p className="loading-message">جارٍ تحميل التطبيق...</p>
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