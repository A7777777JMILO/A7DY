from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
import httpx
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'a7delivery-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="A7delivery Orders API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password: str
    role: str = "user"  # "admin" or "user"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    created_at: datetime

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class UserSettings(BaseModel):
    user_id: str
    shopify_url: Optional[str] = None
    shopify_token: Optional[str] = None
    zrexpress_token: Optional[str] = None
    zrexpress_key: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserSettingsUpdate(BaseModel):
    shopify_url: Optional[str] = None
    shopify_token: Optional[str] = None
    zrexpress_token: Optional[str] = None
    zrexpress_key: Optional[str] = None

class ShopifyOrder(BaseModel):
    id: str
    order_number: str
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    shipping_address: str
    city: str
    total_price: str
    status: str
    created_at: str
    items: List[dict] = []

class ZRExpressOrder(BaseModel):
    tracking: str
    type_livraison: str = "0"  # Domicile: 0, Stopdesk: 1
    type_colis: str = "0"  # Normal: 0, Exchange: 1
    confirmee: str = ""
    client: str
    mobile_a: str
    mobile_b: str = ""
    adresse: str
    id_wilaya: str
    commune: str
    total: str
    note: str = ""
    t_produit: str
    id_externe: str
    source: str = "A7delivery"

class EditableOrder(BaseModel):
    shopify_id: str
    customer_name: str
    customer_phone: str
    shipping_address: str
    city: str
    total_price: str
    status: str
    tracking: Optional[str] = None
    id_wilaya: str = "31"  # Default Algiers
    items: List[dict] = []

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return User(**user)

async def get_current_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

# Initialize admin user
async def init_admin():
    admin_exists = await db.users.find_one({"username": "A7JMILO"})
    if not admin_exists:
        admin_user = User(
            username="A7JMILO",
            password=get_password_hash("A7JMILO20006"),
            role="admin"
        )
        await db.users.insert_one(admin_user.dict())
        logging.info("Admin user created successfully")

# Authentication Routes
@api_router.post("/auth/login", response_model=Token)
async def login(user_credentials: LoginRequest):
    user = await db.users.find_one({"username": user_credentials.username})
    if not user or not verify_password(user_credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    user_response = UserResponse(**user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }

# User Management Routes (Admin only)
@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_admin: User = Depends(get_current_admin_user)):
    # Check if user already exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    new_user = User(
        username=user_data.username,
        password=get_password_hash(user_data.password),
        created_by=current_admin.id
    )
    
    await db.users.insert_one(new_user.dict())
    return UserResponse(**new_user.dict())

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_admin: User = Depends(get_current_admin_user)):
    users = await db.users.find({"role": "user"}).to_list(1000)
    return [UserResponse(**user) for user in users]

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_admin: User = Depends(get_current_admin_user)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete user settings
    await db.user_settings.delete_one({"user_id": user_id})
    return {"message": "User deleted successfully"}

# Settings Routes
@api_router.get("/settings", response_model=UserSettings)
async def get_user_settings(current_user: User = Depends(get_current_user)):
    settings = await db.user_settings.find_one({"user_id": current_user.id})
    if not settings:
        # Create default settings
        default_settings = UserSettings(user_id=current_user.id)
        await db.user_settings.insert_one(default_settings.dict())
        return default_settings
    return UserSettings(**settings)

@api_router.put("/settings", response_model=UserSettings)
async def update_user_settings(
    settings_data: UserSettingsUpdate, 
    current_user: User = Depends(get_current_user)
):
    update_data = settings_data.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    await db.user_settings.update_one(
        {"user_id": current_user.id},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.user_settings.find_one({"user_id": current_user.id})
    return UserSettings(**settings)

@api_router.post("/settings/test")
async def test_api_connections(current_user: User = Depends(get_current_user)):
    settings = await db.user_settings.find_one({"user_id": current_user.id})
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    results = {"shopify": False, "zrexpress": False}
    
    # Test Shopify connection
    if settings.get("shopify_url") and settings.get("shopify_token"):
        try:
            async with httpx.AsyncClient() as client:
                headers = {"X-Shopify-Access-Token": settings["shopify_token"]}
                url = f"https://{settings['shopify_url']}/admin/api/2023-10/orders.json?limit=1"
                response = await client.get(url, headers=headers)
                results["shopify"] = response.status_code == 200
        except Exception:
            results["shopify"] = False
    
    # Test ZRExpress connection
    if settings.get("zrexpress_token") and settings.get("zrexpress_key"):
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "token": settings["zrexpress_token"],
                    "key": settings["zrexpress_key"]
                }
                response = await client.get("https://procolis.com/api_v1/token", headers=headers)
                results["zrexpress"] = response.status_code == 200
        except Exception:
            results["zrexpress"] = False
    
    return results

# Shopify Routes
@api_router.get("/shopify/orders", response_model=List[ShopifyOrder])
async def get_shopify_orders(current_user: User = Depends(get_current_user)):
    settings = await db.user_settings.find_one({"user_id": current_user.id})
    if not settings or not settings.get("shopify_url") or not settings.get("shopify_token"):
        raise HTTPException(status_code=400, detail="Shopify credentials not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            headers = {"X-Shopify-Access-Token": settings["shopify_token"]}
            url = f"https://{settings['shopify_url']}/admin/api/2023-10/orders.json?status=any&limit=50"
            response = await client.get(url, headers=headers)
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch Shopify orders")
            
            data = response.json()
            orders = []
            
            for order in data.get("orders", []):
                shipping_address = order.get("shipping_address", {})
                line_items = [
                    {
                        "name": item.get("name", ""),
                        "quantity": item.get("quantity", 0),
                        "price": item.get("price", "0")
                    }
                    for item in order.get("line_items", [])
                ]
                
                shopify_order = ShopifyOrder(
                    id=str(order.get("id", "")),
                    order_number=str(order.get("order_number", "")),
                    customer_name=f"{order.get('customer', {}).get('first_name', '')} {order.get('customer', {}).get('last_name', '')}".strip(),
                    customer_phone=order.get("customer", {}).get("phone", "") or shipping_address.get("phone", ""),
                    customer_email=order.get("customer", {}).get("email", ""),
                    shipping_address=f"{shipping_address.get('address1', '')} {shipping_address.get('address2', '')}".strip(),
                    city=shipping_address.get("city", ""),
                    total_price=str(order.get("total_price", "0")),
                    status=order.get("financial_status", "pending"),
                    created_at=order.get("created_at", ""),
                    items=line_items
                )
                orders.append(shopify_order)
            
            return orders
            
    except httpx.RequestError:
        raise HTTPException(status_code=500, detail="Error connecting to Shopify")

# ZRExpress Routes
@api_router.post("/zrexpress/send")
async def send_to_zrexpress(
    orders: List[EditableOrder], 
    current_user: User = Depends(get_current_user)
):
    settings = await db.user_settings.find_one({"user_id": current_user.id})
    if not settings or not settings.get("zrexpress_token") or not settings.get("zrexpress_key"):
        raise HTTPException(status_code=400, detail="ZRExpress credentials not configured")
    
    try:
        zr_orders = []
        for order in orders:
            tracking = f"A7D-{order.shopify_id[-6:]}-{datetime.now().strftime('%m%d')}"
            
            zr_order = {
                "Tracking": tracking,
                "TypeLivraison": "0",  # Domicile
                "TypeColis": "0",     # Normal
                "Confrimee": "",      # Not pre-confirmed
                "Client": order.customer_name,
                "MobileA": order.customer_phone,
                "MobileB": "",
                "Adresse": order.shipping_address,
                "IDWilaya": order.id_wilaya,
                "Commune": order.city,
                "Total": str(int(float(order.total_price) * 100)),  # Convert to cents
                "Note": f"Order #{order.shopify_id}",
                "TProduit": ", ".join([item.get("name", "") for item in order.items]),
                "id_Externe": order.shopify_id,
                "Source": "A7delivery"
            }
            zr_orders.append(zr_order)
        
        # Send to ZRExpress
        async with httpx.AsyncClient() as client:
            headers = {
                "token": settings["zrexpress_token"],
                "key": settings["zrexpress_key"],
                "Content-Type": "application/json"
            }
            
            payload = {"Colis": zr_orders}
            response = await client.post(
                "https://procolis.com/api_v1/add_colis",
                headers=headers,
                json=payload
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Failed to send orders to ZRExpress: {response.text}"
                )
            
            return {
                "message": f"Successfully sent {len(orders)} orders to ZRExpress",
                "tracking_numbers": [order["Tracking"] for order in zr_orders],
                "response": response.json() if response.text else {}
            }
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Error connecting to ZRExpress: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await init_admin()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()