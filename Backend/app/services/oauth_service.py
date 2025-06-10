import httpx
import secrets
from typing import Optional
from sqlalchemy.orm import Session
from models.models import User
from services.auth_service import create_access_token
from config import settings

class GoogleOAuth:
    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_REDIRECT_URI
        
    def get_auth_url(self) -> str:
        """Generate Google OAuth authorization URL"""
        state = secrets.token_urlsafe(32)
        
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'scope': 'openid email profile',
            'response_type': 'code',
            'access_type': 'offline',
            'state': state,
            'prompt': 'select_account'  
        }
        
        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"https://accounts.google.com/o/oauth2/auth?{query_string}", state
    
    async def exchange_code_for_token(self, code: str) -> Optional[dict]:
        """Exchange authorization code for access token"""
        token_url = "https://oauth2.googleapis.com/token"
        
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': self.redirect_uri,
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(token_url, data=data)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError:
                return None
    
    async def get_user_info(self, access_token: str) -> Optional[dict]:
        """Get user information from Google"""
        user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        
        headers = {'Authorization': f'Bearer {access_token}'}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(user_info_url, headers=headers)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError:
                return None

def create_or_get_oauth_user(db: Session, user_info: dict, provider: str = "google") -> User:
    """Create or get existing OAuth user"""
    

    if provider == "google" and user_info.get("id"):
        existing_user = db.query(User).filter(User.google_id == user_info["id"]).first()
        if existing_user:
 
            existing_user.avatar_url = user_info.get("picture")
            existing_user.full_name = user_info.get("name")
            db.commit()
            return existing_user
    

    email = user_info.get("email")
    if email:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:

            if provider == "google":
                existing_user.google_id = user_info.get("id")
            existing_user.oauth_provider = provider
            existing_user.avatar_url = user_info.get("picture")
            existing_user.full_name = user_info.get("name")
            existing_user.email_verified = True 
            db.commit()
            return existing_user
    

    username = generate_unique_username(db, user_info.get("name", email.split("@")[0]))
    
    new_user = User(
        email=email,
        username=username,
        hashed_password=None,  
        email_verified=True,  
        oauth_provider=provider,
        google_id=user_info.get("id") if provider == "google" else None,
        avatar_url=user_info.get("picture"),
        full_name=user_info.get("name")
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

def generate_unique_username(db: Session, base_username: str) -> str:
    """Generate a unique username"""

    base_username = ''.join(c for c in base_username if c.isalnum() or c in '_-')
    if not base_username:
        base_username = "user"
    

    if not db.query(User).filter(User.username == base_username).first():
        return base_username
    

    counter = 1
    while True:
        new_username = f"{base_username}{counter}"
        if not db.query(User).filter(User.username == new_username).first():
            return new_username
        counter += 1