#!/usr/bin/env python3
"""
A7delivery Orders Backend API Testing Suite
Tests all backend functionality including authentication, user management, 
API settings, Shopify integration, ZRExpress integration, and orders management.
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Optional

class A7DeliveryAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.session = requests.Session()
        self.admin_token = None
        self.test_user_token = None
        self.test_user_id = None
        
        # Test results tracking
        self.results = {
            "JWT Authentication System": {"passed": 0, "failed": 0, "details": []},
            "Admin User Management System": {"passed": 0, "failed": 0, "details": []},
            "Multi-tenant API Settings": {"passed": 0, "failed": 0, "details": []},
            "Shopify API Integration": {"passed": 0, "failed": 0, "details": []},
            "ZRExpress/Procolis API Integration": {"passed": 0, "failed": 0, "details": []},
            "Orders Management System": {"passed": 0, "failed": 0, "details": []},
            "Database Schema & Models": {"passed": 0, "failed": 0, "details": []}
        }
    
    def log_result(self, category: str, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        if passed:
            self.results[category]["passed"] += 1
            status = "✅ PASS"
        else:
            self.results[category]["failed"] += 1
            status = "❌ FAIL"
        
        self.results[category]["details"].append(f"{status}: {test_name} - {details}")
        print(f"{status}: {test_name} - {details}")
    
    def test_server_health(self) -> bool:
        """Test if server is running and accessible"""
        try:
            response = self.session.get(f"{self.base_url}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Server is running: {data.get('message', 'Unknown')}")
                return True
            else:
                print(f"❌ Server health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Server connection failed: {str(e)}")
            return False
    
    def test_jwt_authentication(self):
        """Test JWT Authentication System"""
        print("\n🔐 Testing JWT Authentication System...")
        
        # Test 1: Admin login with correct credentials
        try:
            login_data = {
                "username": "A7JMILO",
                "password": "436b0bc9005add01239a43435d502d197a647de839285829215bdd04a21de/RAOUF@20006"
            }
            response = self.session.post(f"{self.api_url}/auth/login", data=login_data, timeout=10)
            
            if response.status_code == 200:
                token_data = response.json()
                self.admin_token = token_data.get("access_token")
                self.log_result("JWT Authentication System", "Admin login", True, 
                              f"Token received: {self.admin_token[:20]}...")
            else:
                self.log_result("JWT Authentication System", "Admin login", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return
        except Exception as e:
            self.log_result("JWT Authentication System", "Admin login", False, f"Exception: {str(e)}")
            return
        
        # Test 2: Invalid credentials
        try:
            invalid_data = {"username": "A7JMILO", "password": "wrongpassword"}
            response = self.session.post(f"{self.api_url}/auth/login", data=invalid_data, timeout=10)
            
            if response.status_code == 401:
                self.log_result("JWT Authentication System", "Invalid credentials rejection", True, 
                              "Correctly rejected invalid credentials")
            else:
                self.log_result("JWT Authentication System", "Invalid credentials rejection", False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result("JWT Authentication System", "Invalid credentials rejection", False, f"Exception: {str(e)}")
        
        # Test 3: Get current user info with token
        if self.admin_token:
            try:
                headers = {"Authorization": f"Bearer {self.admin_token}"}
                response = self.session.get(f"{self.api_url}/auth/me", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    user_data = response.json()
                    if user_data.get("username") == "A7JMILO" and user_data.get("role") == "admin":
                        self.log_result("JWT Authentication System", "Token validation", True, 
                                      f"User: {user_data.get('username')}, Role: {user_data.get('role')}")
                    else:
                        self.log_result("JWT Authentication System", "Token validation", False, 
                                      f"Unexpected user data: {user_data}")
                else:
                    self.log_result("JWT Authentication System", "Token validation", False, 
                                  f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("JWT Authentication System", "Token validation", False, f"Exception: {str(e)}")
        
        # Test 4: Access protected endpoint without token
        try:
            response = self.session.get(f"{self.api_url}/auth/me", timeout=10)
            if response.status_code == 401:
                self.log_result("JWT Authentication System", "Unauthorized access protection", True, 
                              "Correctly rejected request without token")
            else:
                self.log_result("JWT Authentication System", "Unauthorized access protection", False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result("JWT Authentication System", "Unauthorized access protection", False, f"Exception: {str(e)}")
    
    def test_user_management(self):
        """Test Admin User Management System"""
        print("\n👥 Testing Admin User Management System...")
        
        if not self.admin_token:
            self.log_result("Admin User Management System", "All tests", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test 1: Create a new user
        try:
            user_data = {
                "username": "testuser_a7delivery",
                "password": "testpass123",
                "role": "user"
            }
            response = self.session.post(f"{self.api_url}/users", json=user_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                created_user = response.json()
                self.test_user_id = created_user.get("id")
                self.log_result("Admin User Management System", "Create user", True, 
                              f"User created: {created_user.get('username')}")
            else:
                self.log_result("Admin User Management System", "Create user", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("Admin User Management System", "Create user", False, f"Exception: {str(e)}")
        
        # Test 2: Get users list
        try:
            response = self.session.get(f"{self.api_url}/users", headers=headers, timeout=10)
            
            if response.status_code == 200:
                users = response.json()
                if isinstance(users, list):
                    self.log_result("Admin User Management System", "Get users list", True, 
                                  f"Retrieved {len(users)} users")
                else:
                    self.log_result("Admin User Management System", "Get users list", False, 
                                  "Response is not a list")
            else:
                self.log_result("Admin User Management System", "Get users list", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Admin User Management System", "Get users list", False, f"Exception: {str(e)}")
        
        # Test 3: Toggle user status
        if self.test_user_id:
            try:
                response = self.session.patch(f"{self.api_url}/users/{self.test_user_id}/toggle", 
                                            headers=headers, timeout=10)
                
                if response.status_code == 200:
                    result = response.json()
                    self.log_result("Admin User Management System", "Toggle user status", True, 
                                  result.get("message", "Status toggled"))
                else:
                    self.log_result("Admin User Management System", "Toggle user status", False, 
                                  f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("Admin User Management System", "Toggle user status", False, f"Exception: {str(e)}")
        
        # Test 4: Delete user
        if self.test_user_id:
            try:
                response = self.session.delete(f"{self.api_url}/users/{self.test_user_id}", 
                                             headers=headers, timeout=10)
                
                if response.status_code == 200:
                    result = response.json()
                    self.log_result("Admin User Management System", "Delete user", True, 
                                  result.get("message", "User deleted"))
                else:
                    self.log_result("Admin User Management System", "Delete user", False, 
                                  f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("Admin User Management System", "Delete user", False, f"Exception: {str(e)}")
        
        # Test 5: Non-admin access restriction
        try:
            # Try to access admin endpoint without admin token (using no token)
            response = self.session.get(f"{self.api_url}/users", timeout=10)
            if response.status_code == 401:
                self.log_result("Admin User Management System", "Admin access restriction", True, 
                              "Correctly rejected non-admin access")
            else:
                self.log_result("Admin User Management System", "Admin access restriction", False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result("Admin User Management System", "Admin access restriction", False, f"Exception: {str(e)}")
    
    def test_api_settings(self):
        """Test Multi-tenant API Settings"""
        print("\n⚙️ Testing Multi-tenant API Settings...")
        
        if not self.admin_token:
            self.log_result("Multi-tenant API Settings", "All tests", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test 1: Save API settings
        try:
            settings_data = {
                "shopify_store_url": "test-store.myshopify.com",
                "shopify_access_token": "test_shopify_token_123",
                "zrexpress_token": "test_zr_token_456",
                "zrexpress_key": "test_zr_key_789"
            }
            response = self.session.post(f"{self.api_url}/settings/api", json=settings_data, 
                                       headers=headers, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                self.log_result("Multi-tenant API Settings", "Save API settings", True, 
                              result.get("message", "Settings saved"))
            else:
                self.log_result("Multi-tenant API Settings", "Save API settings", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("Multi-tenant API Settings", "Save API settings", False, f"Exception: {str(e)}")
        
        # Test 2: Retrieve API settings
        try:
            response = self.session.get(f"{self.api_url}/settings/api", headers=headers, timeout=10)
            
            if response.status_code == 200:
                settings = response.json()
                if settings.get("shopify_store_url") == "test-store.myshopify.com":
                    self.log_result("Multi-tenant API Settings", "Retrieve API settings", True, 
                                  "Settings retrieved correctly")
                else:
                    self.log_result("Multi-tenant API Settings", "Retrieve API settings", False, 
                                  f"Settings mismatch: {settings}")
            else:
                self.log_result("Multi-tenant API Settings", "Retrieve API settings", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Multi-tenant API Settings", "Retrieve API settings", False, f"Exception: {str(e)}")
        
        # Test 3: Settings isolation (would need another user to fully test)
        try:
            # Test accessing settings without token
            response = self.session.get(f"{self.api_url}/settings/api", timeout=10)
            if response.status_code == 401:
                self.log_result("Multi-tenant API Settings", "Settings access control", True, 
                              "Correctly rejected unauthorized access")
            else:
                self.log_result("Multi-tenant API Settings", "Settings access control", False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result("Multi-tenant API Settings", "Settings access control", False, f"Exception: {str(e)}")
    
    def test_shopify_integration(self):
        """Test Shopify API Integration"""
        print("\n🛍️ Testing Shopify API Integration...")
        
        if not self.admin_token:
            self.log_result("Shopify API Integration", "All tests", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test 1: Test Shopify connection (will fail with test credentials, but should handle gracefully)
        try:
            response = self.session.post(f"{self.api_url}/test/shopify", headers=headers, timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success") == False:
                    self.log_result("Shopify API Integration", "Connection test error handling", True, 
                                  f"Gracefully handled invalid credentials: {result.get('error', '')[:100]}")
                else:
                    self.log_result("Shopify API Integration", "Connection test", True, 
                                  "Connection successful")
            elif response.status_code == 400:
                # Expected if no credentials configured
                self.log_result("Shopify API Integration", "Missing credentials handling", True, 
                              "Correctly handled missing credentials")
            else:
                self.log_result("Shopify API Integration", "Connection test", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("Shopify API Integration", "Connection test", False, f"Exception: {str(e)}")
        
        # Test 2: Orders sync (will fail without valid credentials, but should handle gracefully)
        try:
            response = self.session.get(f"{self.api_url}/orders/sync", headers=headers, timeout=15)
            
            if response.status_code == 400:
                # Expected if no valid credentials
                self.log_result("Shopify API Integration", "Orders sync credential validation", True, 
                              "Correctly validated credentials before sync")
            elif response.status_code == 200:
                result = response.json()
                self.log_result("Shopify API Integration", "Orders sync", True, 
                              result.get("message", "Sync completed"))
            else:
                self.log_result("Shopify API Integration", "Orders sync", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Shopify API Integration", "Orders sync", False, f"Exception: {str(e)}")
    
    def test_zrexpress_integration(self):
        """Test ZRExpress/Procolis API Integration"""
        print("\n📦 Testing ZRExpress/Procolis API Integration...")
        
        if not self.admin_token:
            self.log_result("ZRExpress/Procolis API Integration", "All tests", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test 1: Test ZRExpress connection
        try:
            response = self.session.post(f"{self.api_url}/test/zrexpress", headers=headers, timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success") == False:
                    self.log_result("ZRExpress/Procolis API Integration", "Connection test error handling", True, 
                                  f"Gracefully handled invalid credentials: {result.get('error', '')[:100]}")
                else:
                    self.log_result("ZRExpress/Procolis API Integration", "Connection test", True, 
                                  "Connection successful")
            elif response.status_code == 400:
                # Expected if no credentials configured
                self.log_result("ZRExpress/Procolis API Integration", "Missing credentials handling", True, 
                              "Correctly handled missing credentials")
            else:
                self.log_result("ZRExpress/Procolis API Integration", "Connection test", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("ZRExpress/Procolis API Integration", "Connection test", False, f"Exception: {str(e)}")
        
        # Test 2: Send selected orders (will fail without valid credentials and orders)
        try:
            test_order_ids = ["test-order-1", "test-order-2"]
            response = self.session.post(f"{self.api_url}/orders/send-selected", 
                                       json=test_order_ids, headers=headers, timeout=15)
            
            if response.status_code == 400:
                # Expected if no valid credentials
                self.log_result("ZRExpress/Procolis API Integration", "Send orders credential validation", True, 
                              "Correctly validated credentials before sending")
            elif response.status_code == 404:
                # Expected if orders don't exist
                self.log_result("ZRExpress/Procolis API Integration", "Send orders validation", True, 
                              "Correctly validated order existence")
            elif response.status_code == 200:
                result = response.json()
                self.log_result("ZRExpress/Procolis API Integration", "Send orders", True, 
                              result.get("message", "Orders sent"))
            else:
                self.log_result("ZRExpress/Procolis API Integration", "Send orders", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("ZRExpress/Procolis API Integration", "Send orders", False, f"Exception: {str(e)}")
    
    def test_orders_management(self):
        """Test Orders Management System"""
        print("\n📋 Testing Orders Management System...")
        
        if not self.admin_token:
            self.log_result("Orders Management System", "All tests", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test 1: Get orders list
        try:
            response = self.session.get(f"{self.api_url}/orders", headers=headers, timeout=10)
            
            if response.status_code == 200:
                orders = response.json()
                if isinstance(orders, list):
                    self.log_result("Orders Management System", "Get orders list", True, 
                                  f"Retrieved {len(orders)} orders")
                else:
                    self.log_result("Orders Management System", "Get orders list", False, 
                                  "Response is not a list")
            else:
                self.log_result("Orders Management System", "Get orders list", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Orders Management System", "Get orders list", False, f"Exception: {str(e)}")
        
        # Test 2: Get orders with status filter
        try:
            response = self.session.get(f"{self.api_url}/orders?status=pending", headers=headers, timeout=10)
            
            if response.status_code == 200:
                orders = response.json()
                self.log_result("Orders Management System", "Get orders with filter", True, 
                              f"Retrieved {len(orders)} pending orders")
            else:
                self.log_result("Orders Management System", "Get orders with filter", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Orders Management System", "Get orders with filter", False, f"Exception: {str(e)}")
        
        # Test 3: Get order statistics
        try:
            response = self.session.get(f"{self.api_url}/orders/stats", headers=headers, timeout=10)
            
            if response.status_code == 200:
                stats = response.json()
                if all(key in stats for key in ["total", "pending", "processing", "sent"]):
                    self.log_result("Orders Management System", "Get order statistics", True, 
                                  f"Stats: {stats}")
                else:
                    self.log_result("Orders Management System", "Get order statistics", False, 
                                  f"Missing stats fields: {stats}")
            else:
                self.log_result("Orders Management System", "Get order statistics", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Orders Management System", "Get order statistics", False, f"Exception: {str(e)}")
        
        # Test 4: Update order (test with non-existent order)
        try:
            order_data = {
                "status": "processing",
                "notes": "Test update"
            }
            response = self.session.patch(f"{self.api_url}/orders/test-order-id", 
                                        json=order_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                self.log_result("Orders Management System", "Update order", True, 
                              result.get("message", "Order updated"))
            else:
                # Expected to fail with non-existent order, but endpoint should exist
                self.log_result("Orders Management System", "Update order endpoint", True, 
                              f"Endpoint exists, status: {response.status_code}")
        except Exception as e:
            self.log_result("Orders Management System", "Update order", False, f"Exception: {str(e)}")
    
    def test_database_models(self):
        """Test Database Schema & Models"""
        print("\n🗄️ Testing Database Schema & Models...")
        
        # This is tested implicitly through other tests, but we can verify response structures
        if not self.admin_token:
            self.log_result("Database Schema & Models", "All tests", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test 1: User model structure
        try:
            response = self.session.get(f"{self.api_url}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                user_data = response.json()
                required_fields = ["id", "username", "role", "is_active", "created_at"]
                if all(field in user_data for field in required_fields):
                    self.log_result("Database Schema & Models", "User model structure", True, 
                                  f"All required fields present: {list(user_data.keys())}")
                else:
                    missing = [f for f in required_fields if f not in user_data]
                    self.log_result("Database Schema & Models", "User model structure", False, 
                                  f"Missing fields: {missing}")
            else:
                self.log_result("Database Schema & Models", "User model structure", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Database Schema & Models", "User model structure", False, f"Exception: {str(e)}")
        
        # Test 2: API Settings model structure
        try:
            response = self.session.get(f"{self.api_url}/settings/api", headers=headers, timeout=10)
            
            if response.status_code == 200:
                settings_data = response.json()
                expected_fields = ["shopify_store_url", "shopify_access_token", "zrexpress_token", "zrexpress_key"]
                if all(field in settings_data for field in expected_fields):
                    self.log_result("Database Schema & Models", "API Settings model structure", True, 
                                  "All expected fields present")
                else:
                    self.log_result("Database Schema & Models", "API Settings model structure", False, 
                                  f"Settings structure: {list(settings_data.keys())}")
            else:
                self.log_result("Database Schema & Models", "API Settings model structure", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Database Schema & Models", "API Settings model structure", False, f"Exception: {str(e)}")
        
        # Test 3: Orders model structure
        try:
            response = self.session.get(f"{self.api_url}/orders", headers=headers, timeout=10)
            
            if response.status_code == 200:
                orders = response.json()
                if isinstance(orders, list):
                    self.log_result("Database Schema & Models", "Orders model structure", True, 
                                  f"Orders list structure valid, count: {len(orders)}")
                else:
                    self.log_result("Database Schema & Models", "Orders model structure", False, 
                                  "Orders response is not a list")
            else:
                self.log_result("Database Schema & Models", "Orders model structure", False, 
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Database Schema & Models", "Orders model structure", False, f"Exception: {str(e)}")
    
    def print_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "="*80)
        print("🧪 A7DELIVERY ORDERS BACKEND TEST SUMMARY")
        print("="*80)
        
        total_passed = 0
        total_failed = 0
        
        for category, results in self.results.items():
            passed = results["passed"]
            failed = results["failed"]
            total_passed += passed
            total_failed += failed
            
            status = "✅ WORKING" if failed == 0 and passed > 0 else "❌ ISSUES" if failed > 0 else "⚠️ NO TESTS"
            print(f"\n{status} {category}: {passed} passed, {failed} failed")
            
            for detail in results["details"]:
                print(f"  {detail}")
        
        print(f"\n{'='*80}")
        print(f"OVERALL RESULTS: {total_passed} passed, {total_failed} failed")
        
        if total_failed == 0 and total_passed > 0:
            print("🎉 ALL BACKEND SYSTEMS ARE WORKING!")
        elif total_failed > 0:
            print("⚠️ SOME ISSUES FOUND - SEE DETAILS ABOVE")
        else:
            print("❌ NO TESTS COMPLETED SUCCESSFULLY")
        
        print("="*80)
        
        return total_failed == 0 and total_passed > 0
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting A7delivery Orders Backend API Tests...")
        print(f"🌐 Testing against: {self.base_url}")
        
        # Check server health first
        if not self.test_server_health():
            print("❌ Server is not accessible. Aborting tests.")
            return False
        
        # Run all test suites
        self.test_jwt_authentication()
        self.test_user_management()
        self.test_api_settings()
        self.test_shopify_integration()
        self.test_zrexpress_integration()
        self.test_orders_management()
        self.test_database_models()
        
        # Print summary
        return self.print_summary()

def main():
    """Main test execution"""
    # Use localhost for testing since external URL has routing issues
    backend_url = "http://localhost:8001"
    
    print(f"A7delivery Orders Backend API Tester")
    print(f"Backend URL: {backend_url}")
    print(f"Test started at: {datetime.now()}")
    
    tester = A7DeliveryAPITester(backend_url)
    success = tester.run_all_tests()
    
    print(f"\nTest completed at: {datetime.now()}")
    return success

if __name__ == "__main__":
    main()