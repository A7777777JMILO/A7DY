from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import os
import uuid
import bcrypt
import jwt
import httpx
import json
from urllib.parse import urlencode

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = "A7DELIVERY_SECRET_KEY_2025"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Create FastAPI app
app = FastAPI(title="A7delivery Orders", version="1.0.0")
api_router = APIRouter(prefix="/api")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"  # "admin" or "user"

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class APISettings(BaseModel):
    shopify_store_url: Optional[str] = None
    shopify_access_token: Optional[str] = None
    zrexpress_token: Optional[str] = None
    zrexpress_key: Optional[str] = None

class Order(BaseModel):
    id: Optional[str] = None
    shopify_order_id: Optional[str] = None
    order_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    shipping_address: Optional[Dict] = None
    billing_address: Optional[Dict] = None
    line_items: Optional[List[Dict]] = None
    total_price: Optional[str] = None
    financial_status: Optional[str] = None
    fulfillment_status: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    status: str = "pending"  # pending, processing, sent, delivered
    tracking_number: Optional[str] = None
    notes: Optional[str] = None

# Utility Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

# Shopify API functions
async def fetch_shopify_orders(store_url: str, access_token: str) -> List[Dict]:
    try:
        if not store_url.startswith('https://'):
            store_url = f"https://{store_url}"
        
        if not store_url.endswith('.myshopify.com'):
            store_url = f"{store_url}.myshopify.com"
            
        url = f"{store_url}/admin/api/2024-01/orders.json"
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("orders", [])
            else:
                print(f"Shopify API Error: {response.status_code} - {response.text}")
                return []
    except Exception as e:
        print(f"Error fetching Shopify orders: {str(e)}")
        return []

async def test_shopify_connection(store_url: str, access_token: str) -> Dict:
    try:
        if not store_url.startswith('https://'):
            store_url = f"https://{store_url}"
        
        if not store_url.endswith('.myshopify.com'):
            store_url = f"{store_url}.myshopify.com"
            
        url = f"{store_url}/admin/api/2024-01/shop.json"
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                shop_data = response.json().get("shop", {})
                return {
                    "success": True,
                    "shop_name": shop_data.get("name"),
                    "domain": shop_data.get("myshopify_domain"),
                    "email": shop_data.get("email")
                }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Connection failed: {str(e)}"
        }

# ZRExpress/Procolis API functions
async def send_to_zrexpress(orders: List[Dict], token: str, key: str) -> Dict:
    try:
        # Transform orders to Procolis format
        colis_data = []
        for order in orders:
            address = order.get("shipping_address", {})
            colis_item = {
                "Tracking": order.get("tracking_number", f"A7DEL-{order.get('id', uuid.uuid4())}"),
                "TypeLivraison": "0",  # Domicile
                "TypeColis": "0",
                "Confrimee": "",
                "Client": order.get("customer_name", ""),
                "MobileA": order.get("customer_phone", ""),
                "MobileB": "",
                "Adresse": f"{address.get('address1', '')} {address.get('address2', '')}".strip(),
                "IDWilaya": "16",  # Default Algiers, should be mapped
                "Commune": address.get("city", ""),
                "Total": str(int(float(order.get("total_price", "0")) * 100)),  # Convert to cents
                "Note": order.get("notes", ""),
                "TProduit": ", ".join([item.get("title", "") for item in order.get("line_items", [])]),
                "id_Externe": order.get("shopify_order_id", order.get("id", "")),
                "Source": "A7delivery"
            }
            colis_data.append(colis_item)
        
        payload = {"Colis": colis_data}
        
        headers = {
            "token": token,
            "key": key,
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://procolis.com/api_v1/add_colis",
                json=payload,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "data": result,
                    "message": f"Successfully sent {len(colis_data)} orders"
                }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}"
                }
                
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to send orders: {str(e)}"
        }

async def test_zrexpress_connection(token: str, key: str) -> Dict:
    try:
        headers = {
            "token": token,
            "key": key,
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://procolis.com/api_v1/token",
                headers=headers
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "ZRExpress connection successful"
                }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Connection failed: {str(e)}"
        }

# Initialize Admin User
async def create_admin_user():
    admin_exists = await db.users.find_one({"username": "A7JMILO"})
    if not admin_exists:
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "A7JMILO",
            "password": hash_password("436b0bc9005add01239a43435d502d197a647de839285829215bdd04a21de/RAOUF@20006"),
            "role": "admin",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "expires_at": None
        }
        await db.users.insert_one(admin_user)
        print("✅ Admin user A7JMILO created successfully")

# Authentication Routes
@api_router.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"username": form_data.username})
    
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated"
        )
    
    # Check expiry for non-admin users
    if user["role"] != "admin" and user.get("expires_at"):
        if datetime.utcnow() > user["expires_at"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account has expired"
            )
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# User Management Routes (Admin only)
@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, admin_user: dict = Depends(get_admin_user)):
    # Check if user exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    new_user = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=365) if user_data.role == "user" else None
    }
    
    await db.users.insert_one(new_user)
    return UserResponse(**new_user)

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(admin_user: dict = Depends(get_admin_user)):
    users = await db.users.find({"role": "user"}).to_list(100)
    return [UserResponse(**user) for user in users]

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin_user: dict = Depends(get_admin_user)):
    result = await db.users.delete_one({"id": user_id, "role": "user"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

@api_router.patch("/users/{user_id}/toggle")
async def toggle_user_status(user_id: str, admin_user: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id, "role": "user"})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user["is_active"]
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": new_status}}
    )
    return {"message": f"User {'activated' if new_status else 'deactivated'} successfully"}

# API Settings Routes
@api_router.post("/settings/api")
async def save_api_settings(settings: APISettings, current_user: dict = Depends(get_current_user)):
    await db.api_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {**settings.dict(), "updated_at": datetime.utcnow()}},
        upsert=True
    )
    return {"message": "API settings saved successfully"}

@api_router.get("/settings/api", response_model=APISettings)
async def get_api_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.api_settings.find_one({"user_id": current_user["id"]})
    if not settings:
        return APISettings()
    return APISettings(**settings)

# Connection Test Routes
@api_router.post("/test/shopify")
async def test_shopify(current_user: dict = Depends(get_current_user)):
    settings = await db.api_settings.find_one({"user_id": current_user["id"]})
    if not settings or not settings.get("shopify_store_url") or not settings.get("shopify_access_token"):
        raise HTTPException(status_code=400, detail="Shopify credentials not configured")
    
    result = await test_shopify_connection(settings["shopify_store_url"], settings["shopify_access_token"])
    return result

@api_router.post("/test/zrexpress")
async def test_zrexpress(current_user: dict = Depends(get_current_user)):
    settings = await db.api_settings.find_one({"user_id": current_user["id"]})
    if not settings or not settings.get("zrexpress_token") or not settings.get("zrexpress_key"):
        raise HTTPException(status_code=400, detail="ZRExpress credentials not configured")
    
    result = await test_zrexpress_connection(settings["zrexpress_token"], settings["zrexpress_key"])
    return result

# Orders Routes
@api_router.get("/orders/sync")
async def sync_orders_from_shopify(current_user: dict = Depends(get_current_user)):
    settings = await db.api_settings.find_one({"user_id": current_user["id"]})
    if not settings or not settings.get("shopify_store_url") or not settings.get("shopify_access_token"):
        raise HTTPException(status_code=400, detail="Shopify credentials not configured")
    
    shopify_orders = await fetch_shopify_orders(settings["shopify_store_url"], settings["shopify_access_token"])
    
    synced_count = 0
    for shopify_order in shopify_orders:
        # Check if order already exists
        existing = await db.orders.find_one({
            "user_id": current_user["id"],
            "shopify_order_id": str(shopify_order["id"])
        })
        
        if not existing:
            order_data = {
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "shopify_order_id": str(shopify_order["id"]),
                "order_number": shopify_order.get("order_number"),
                "customer_name": f"{shopify_order.get('customer', {}).get('first_name', '')} {shopify_order.get('customer', {}).get('last_name', '')}".strip(),
                "customer_phone": shopify_order.get('customer', {}).get('phone'),
                "customer_email": shopify_order.get('customer', {}).get('email'),
                "shipping_address": shopify_order.get('shipping_address'),
                "billing_address": shopify_order.get('billing_address'),
                "line_items": shopify_order.get('line_items', []),
                "total_price": shopify_order.get('total_price'),
                "financial_status": shopify_order.get('financial_status'),
                "fulfillment_status": shopify_order.get('fulfillment_status'),
                "created_at": datetime.fromisoformat(shopify_order.get('created_at').replace('Z', '+00:00')),
                "updated_at": datetime.fromisoformat(shopify_order.get('updated_at').replace('Z', '+00:00')),
                "status": "pending",
                "synced_at": datetime.utcnow()
            }
            await db.orders.insert_one(order_data)
            synced_count += 1
    
    return {"message": f"Synced {synced_count} new orders from Shopify"}

@api_router.get("/orders", response_model=List[Order])
async def get_orders(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query).sort("created_at", -1).to_list(100)
    return [Order(**order) for order in orders]

@api_router.patch("/orders/{order_id}")
async def update_order(order_id: str, updated_order: Order, current_user: dict = Depends(get_current_user)):
    await db.orders.update_one(
        {"id": order_id, "user_id": current_user["id"]},
        {"$set": {**updated_order.dict(exclude_unset=True), "updated_at": datetime.utcnow()}}
    )
    return {"message": "Order updated successfully"}

@api_router.post("/orders/send-selected")
async def send_selected_orders(order_ids: List[str], current_user: dict = Depends(get_current_user)):
    settings = await db.api_settings.find_one({"user_id": current_user["id"]})
    if not settings or not settings.get("zrexpress_token") or not settings.get("zrexpress_key"):
        raise HTTPException(status_code=400, detail="ZRExpress credentials not configured")
    
    # Get selected orders
    orders = await db.orders.find({
        "id": {"$in": order_ids},
        "user_id": current_user["id"]
    }).to_list(100)
    
    if not orders:
        raise HTTPException(status_code=404, detail="No orders found")
    
    result = await send_to_zrexpress(orders, settings["zrexpress_token"], settings["zrexpress_key"])
    
    if result["success"]:
        # Update orders status
        await db.orders.update_many(
            {"id": {"$in": order_ids}, "user_id": current_user["id"]},
            {"$set": {"status": "sent", "sent_at": datetime.utcnow()}}
        )
    
    return result

@api_router.get("/orders/stats")
async def get_order_stats(current_user: dict = Depends(get_current_user)):
    total = await db.orders.count_documents({"user_id": current_user["id"]})
    pending = await db.orders.count_documents({"user_id": current_user["id"], "status": "pending"})
    processing = await db.orders.count_documents({"user_id": current_user["id"], "status": "processing"})
    sent = await db.orders.count_documents({"user_id": current_user["id"], "status": "sent"})
    
    return {
        "total": total,
        "pending": pending,
        "processing": processing,
        "sent": sent
    }

# Include router
app.include_router(api_router)

# Startup event
@app.on_event("startup")
async def startup_event():
    await create_admin_user()
    print("✅ A7delivery Orders backend started successfully!")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Root endpoint
@app.get("/")
async def root():
    return {"message": "A7delivery Orders API v1.0", "status": "running"}