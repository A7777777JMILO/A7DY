#!/usr/bin/env python3
"""
A7delivery Orders Backend API Test Suite
Tests all backend functionality including authentication, user management, settings, and API integrations.
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://9a74b121-15fe-4dc6-9857-c2b82fa2cbfc.preview.emergentagent.com/api"
ADMIN_USERNAME = "A7JMILO"
ADMIN_PASSWORD = "A7JMILO20006"

class A7DeliveryAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.test_user_token = None
        self.test_user_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None, token: str = None) -> requests.Response:
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        request_headers = {"Content-Type": "application/json"}
        
        if headers:
            request_headers.update(headers)
            
        if token:
            request_headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=request_headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=request_headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=request_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=request_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise
    
    def test_admin_login(self):
        """Test admin login functionality"""
        try:
            data = {
                "username": ADMIN_USERNAME,
                "password": ADMIN_PASSWORD
            }
            
            response = self.make_request("POST", "/auth/login", data)
            
            if response.status_code == 200:
                result = response.json()
                if "access_token" in result and "user" in result:
                    self.admin_token = result["access_token"]
                    user_info = result["user"]
                    if user_info.get("role") == "admin" and user_info.get("username") == ADMIN_USERNAME:
                        self.log_test("Admin Login", True, "Admin login successful with correct role")
                        return True
                    else:
                        self.log_test("Admin Login", False, "Login successful but user role/username incorrect", user_info)
                else:
                    self.log_test("Admin Login", False, "Login response missing required fields", result)
            else:
                self.log_test("Admin Login", False, f"Login failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception during login: {str(e)}")
            
        return False
    
    def test_jwt_token_validation(self):
        """Test JWT token validation"""
        if not self.admin_token:
            self.log_test("JWT Token Validation", False, "No admin token available for testing")
            return False
            
        try:
            # Test with valid token
            response = self.make_request("GET", "/users", token=self.admin_token)
            if response.status_code == 200:
                self.log_test("JWT Token Validation - Valid Token", True, "Valid token accepted")
            else:
                self.log_test("JWT Token Validation - Valid Token", False, f"Valid token rejected: {response.status_code}")
                return False
            
            # Test with invalid token
            response = self.make_request("GET", "/users", token="invalid_token_123")
            if response.status_code == 401:
                self.log_test("JWT Token Validation - Invalid Token", True, "Invalid token properly rejected")
                return True
            else:
                self.log_test("JWT Token Validation - Invalid Token", False, f"Invalid token not rejected: {response.status_code}")
                
        except Exception as e:
            self.log_test("JWT Token Validation", False, f"Exception during token validation: {str(e)}")
            
        return False
    
    def test_unauthorized_access_protection(self):
        """Test that protected endpoints require authentication"""
        protected_endpoints = [
            ("GET", "/users"),
            ("GET", "/settings"),
            ("POST", "/users"),
            ("GET", "/shopify/orders")
        ]
        
        all_protected = True
        for method, endpoint in protected_endpoints:
            try:
                response = self.make_request(method, endpoint)
                if response.status_code == 401:
                    self.log_test(f"Unauthorized Access Protection - {method} {endpoint}", True, "Endpoint properly protected")
                else:
                    self.log_test(f"Unauthorized Access Protection - {method} {endpoint}", False, f"Endpoint not protected: {response.status_code}")
                    all_protected = False
            except Exception as e:
                self.log_test(f"Unauthorized Access Protection - {method} {endpoint}", False, f"Exception: {str(e)}")
                all_protected = False
                
        return all_protected
    
    def test_create_user(self):
        """Test user creation (admin only)"""
        if not self.admin_token:
            self.log_test("Create User", False, "No admin token available")
            return False
            
        try:
            # Create a test user
            test_username = f"testuser_{int(time.time())}"
            data = {
                "username": test_username,
                "password": "testpass123"
            }
            
            response = self.make_request("POST", "/users", data, token=self.admin_token)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("username") == test_username and result.get("role") == "user":
                    self.test_user_id = result.get("id")
                    self.log_test("Create User", True, f"User created successfully: {test_username}")
                    return True
                else:
                    self.log_test("Create User", False, "User created but response data incorrect", result)
            else:
                self.log_test("Create User", False, f"User creation failed: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Create User", False, f"Exception during user creation: {str(e)}")
            
        return False
    
    def test_get_users_list(self):
        """Test getting users list (admin only)"""
        if not self.admin_token:
            self.log_test("Get Users List", False, "No admin token available")
            return False
            
        try:
            response = self.make_request("GET", "/users", token=self.admin_token)
            
            if response.status_code == 200:
                users = response.json()
                if isinstance(users, list):
                    self.log_test("Get Users List", True, f"Retrieved {len(users)} users")
                    return True
                else:
                    self.log_test("Get Users List", False, "Response is not a list", users)
            else:
                self.log_test("Get Users List", False, f"Failed to get users: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Get Users List", False, f"Exception during get users: {str(e)}")
            
        return False
    
    def test_user_login(self):
        """Test regular user login"""
        if not self.test_user_id:
            self.log_test("User Login", False, "No test user created for login test")
            return False
            
        try:
            # Get the test user's username from the users list
            response = self.make_request("GET", "/users", token=self.admin_token)
            if response.status_code != 200:
                self.log_test("User Login", False, "Could not retrieve users list to find test user")
                return False
                
            users = response.json()
            test_user = None
            for user in users:
                if user.get("id") == self.test_user_id:
                    test_user = user
                    break
                    
            if not test_user:
                self.log_test("User Login", False, "Test user not found in users list")
                return False
            
            # Login as test user
            data = {
                "username": test_user["username"],
                "password": "testpass123"
            }
            
            response = self.make_request("POST", "/auth/login", data)
            
            if response.status_code == 200:
                result = response.json()
                if "access_token" in result and result.get("user", {}).get("role") == "user":
                    self.test_user_token = result["access_token"]
                    self.log_test("User Login", True, "Test user login successful")
                    return True
                else:
                    self.log_test("User Login", False, "Login response missing required fields", result)
            else:
                self.log_test("User Login", False, f"User login failed: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("User Login", False, f"Exception during user login: {str(e)}")
            
        return False
    
    def test_user_settings_get(self):
        """Test getting user settings"""
        if not self.test_user_token:
            self.log_test("Get User Settings", False, "No test user token available")
            return False
            
        try:
            response = self.make_request("GET", "/settings", token=self.test_user_token)
            
            if response.status_code == 200:
                settings = response.json()
                if "user_id" in settings:
                    self.log_test("Get User Settings", True, "User settings retrieved successfully")
                    return True
                else:
                    self.log_test("Get User Settings", False, "Settings response missing user_id", settings)
            else:
                self.log_test("Get User Settings", False, f"Failed to get settings: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Get User Settings", False, f"Exception during get settings: {str(e)}")
            
        return False
    
    def test_user_settings_update(self):
        """Test updating user settings"""
        if not self.test_user_token:
            self.log_test("Update User Settings", False, "No test user token available")
            return False
            
        try:
            # Update settings with test API credentials
            data = {
                "shopify_url": "test-shop.myshopify.com",
                "shopify_token": "test_shopify_token_123",
                "zrexpress_token": "test_zr_token_456",
                "zrexpress_key": "test_zr_key_789"
            }
            
            response = self.make_request("PUT", "/settings", data, token=self.test_user_token)
            
            if response.status_code == 200:
                settings = response.json()
                if (settings.get("shopify_url") == data["shopify_url"] and 
                    settings.get("shopify_token") == data["shopify_token"]):
                    self.log_test("Update User Settings", True, "User settings updated successfully")
                    return True
                else:
                    self.log_test("Update User Settings", False, "Settings not updated correctly", settings)
            else:
                self.log_test("Update User Settings", False, f"Failed to update settings: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Update User Settings", False, f"Exception during update settings: {str(e)}")
            
        return False
    
    def test_api_connection_testing(self):
        """Test API connection testing endpoint"""
        if not self.test_user_token:
            self.log_test("API Connection Testing", False, "No test user token available")
            return False
            
        try:
            response = self.make_request("POST", "/settings/test", token=self.test_user_token)
            
            if response.status_code == 200:
                results = response.json()
                if "shopify" in results and "zrexpress" in results:
                    # Both should be False since we're using test credentials
                    if results["shopify"] == False and results["zrexpress"] == False:
                        self.log_test("API Connection Testing", True, "API connection testing working correctly (test credentials failed as expected)")
                        return True
                    else:
                        self.log_test("API Connection Testing", True, f"API connection testing returned: {results} (may be valid if real credentials)")
                        return True
                else:
                    self.log_test("API Connection Testing", False, "Connection test response missing required fields", results)
            else:
                self.log_test("API Connection Testing", False, f"Connection test failed: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("API Connection Testing", False, f"Exception during connection test: {str(e)}")
            
        return False
    
    def test_shopify_orders_endpoint(self):
        """Test Shopify orders fetching endpoint"""
        if not self.test_user_token:
            self.log_test("Shopify Orders Endpoint", False, "No test user token available")
            return False
            
        try:
            response = self.make_request("GET", "/shopify/orders", token=self.test_user_token)
            
            # Should fail gracefully with test credentials
            if response.status_code == 400:
                error_data = response.json()
                if "Shopify" in error_data.get("detail", ""):
                    self.log_test("Shopify Orders Endpoint", True, "Endpoint handles missing/invalid credentials gracefully")
                    return True
                else:
                    self.log_test("Shopify Orders Endpoint", False, "Unexpected error message", error_data)
            elif response.status_code == 200:
                # If it succeeds, the credentials might be valid
                orders = response.json()
                self.log_test("Shopify Orders Endpoint", True, f"Shopify orders retrieved successfully: {len(orders)} orders")
                return True
            else:
                self.log_test("Shopify Orders Endpoint", False, f"Unexpected response: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Shopify Orders Endpoint", False, f"Exception during Shopify orders test: {str(e)}")
            
        return False
    
    def test_zrexpress_send_endpoint(self):
        """Test ZRExpress order sending endpoint"""
        if not self.test_user_token:
            self.log_test("ZRExpress Send Endpoint", False, "No test user token available")
            return False
            
        try:
            # Test with sample order data
            test_orders = [{
                "shopify_id": "test_order_123",
                "customer_name": "Ahmed Ben Ali",
                "customer_phone": "0555123456",
                "shipping_address": "123 Rue de la Paix",
                "city": "Alger",
                "total_price": "2500.00",
                "status": "paid",
                "id_wilaya": "16",
                "items": [{"name": "Test Product", "quantity": 1, "price": "2500.00"}]
            }]
            
            response = self.make_request("POST", "/zrexpress/send", test_orders, token=self.test_user_token)
            
            # Should fail gracefully with test credentials
            if response.status_code == 400:
                error_data = response.json()
                if "ZRExpress" in error_data.get("detail", ""):
                    self.log_test("ZRExpress Send Endpoint", True, "Endpoint handles missing/invalid credentials gracefully")
                    return True
                else:
                    self.log_test("ZRExpress Send Endpoint", False, "Unexpected error message", error_data)
            elif response.status_code == 200:
                # If it succeeds, the credentials might be valid
                result = response.json()
                self.log_test("ZRExpress Send Endpoint", True, f"ZRExpress send successful: {result.get('message', 'No message')}")
                return True
            else:
                self.log_test("ZRExpress Send Endpoint", False, f"Unexpected response: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("ZRExpress Send Endpoint", False, f"Exception during ZRExpress send test: {str(e)}")
            
        return False
    
    def test_admin_only_access(self):
        """Test that admin-only endpoints reject regular users"""
        if not self.test_user_token:
            self.log_test("Admin Only Access Control", False, "No test user token available")
            return False
            
        admin_endpoints = [
            ("POST", "/users", {"username": "should_fail", "password": "test123"}),
            ("DELETE", "/users/fake_id", None)
        ]
        
        all_protected = True
        for method, endpoint, data in admin_endpoints:
            try:
                response = self.make_request(method, endpoint, data, token=self.test_user_token)
                if response.status_code == 403:
                    self.log_test(f"Admin Only Access - {method} {endpoint}", True, "Regular user properly denied admin access")
                else:
                    self.log_test(f"Admin Only Access - {method} {endpoint}", False, f"Regular user not denied: {response.status_code}")
                    all_protected = False
            except Exception as e:
                self.log_test(f"Admin Only Access - {method} {endpoint}", False, f"Exception: {str(e)}")
                all_protected = False
                
        return all_protected
    
    def test_delete_user(self):
        """Test user deletion (admin only)"""
        if not self.admin_token or not self.test_user_id:
            self.log_test("Delete User", False, "No admin token or test user ID available")
            return False
            
        try:
            response = self.make_request("DELETE", f"/users/{self.test_user_id}", token=self.admin_token)
            
            if response.status_code == 200:
                result = response.json()
                if "deleted successfully" in result.get("message", ""):
                    self.log_test("Delete User", True, "User deleted successfully")
                    return True
                else:
                    self.log_test("Delete User", False, "Unexpected delete response", result)
            else:
                self.log_test("Delete User", False, f"User deletion failed: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Delete User", False, f"Exception during user deletion: {str(e)}")
            
        return False
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("=" * 80)
        print("A7DELIVERY ORDERS BACKEND API TEST SUITE")
        print("=" * 80)
        print(f"Testing against: {self.base_url}")
        print(f"Admin credentials: {ADMIN_USERNAME}")
        print("=" * 80)
        
        # Test sequence following the review requirements
        tests = [
            ("Authentication System", [
                self.test_admin_login,
                self.test_jwt_token_validation,
                self.test_unauthorized_access_protection
            ]),
            ("User Management", [
                self.test_create_user,
                self.test_get_users_list,
                self.test_user_login,
                self.test_admin_only_access
            ]),
            ("User Settings", [
                self.test_user_settings_get,
                self.test_user_settings_update,
                self.test_api_connection_testing
            ]),
            ("API Integrations", [
                self.test_shopify_orders_endpoint,
                self.test_zrexpress_send_endpoint
            ]),
            ("Cleanup", [
                self.test_delete_user
            ])
        ]
        
        total_tests = 0
        passed_tests = 0
        
        for category, test_functions in tests:
            print(f"\n--- {category} Tests ---")
            for test_func in test_functions:
                total_tests += 1
                if test_func():
                    passed_tests += 1
        
        # Print summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Print failed tests
        failed_tests = [test for test in self.test_results if not test["success"]]
        if failed_tests:
            print(f"\nFAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"❌ {test['test']}: {test['message']}")
        
        print("=" * 80)
        
        return passed_tests, total_tests, self.test_results

if __name__ == "__main__":
    tester = A7DeliveryAPITester()
    passed, total, results = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if passed == total else 1)