from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from datetime import timedelta

from database import get_db
from services.auth_service import create_access_token, get_current_user
from services.oauth_service import GoogleOAuth, create_or_get_oauth_user
from config import settings
from models.models import User

oauth_router = APIRouter(tags=["oauth"])

@oauth_router.get("/auth/google")
async def google_auth(request: Request):
    """Initiate Google OAuth flow"""
    google_oauth = GoogleOAuth()
    auth_url, state = google_oauth.get_auth_url()
    return RedirectResponse(url=auth_url)

@oauth_router.get("/auth/google/callback")
async def google_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: Session = Depends(get_db)
):
    """Handle Google OAuth callback"""
    
    # Determine the frontend URL based on environment
    frontend_url = "http://localhost:5173"  # React dev server
    if settings.ENVIRONMENT == "production":
        frontend_url = "https://yourdomain.com"  # Your production URL
    
    if error:
        return RedirectResponse(url=f"{frontend_url}/login?error=oauth_cancelled")
    
    if not code:
        return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")
    
    google_oauth = GoogleOAuth()
    
    try:
        token_data = await google_oauth.exchange_code_for_token(code)
        if not token_data:
            return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")
        
        user_info = await google_oauth.get_user_info(token_data["access_token"])
        if not user_info:
            return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")
        
        user = create_or_get_oauth_user(db, user_info, "google")
        
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        
        # Redirect to frontend with token as URL parameter (for React to handle)
        # In production, you might want to use a more secure method
        response = RedirectResponse(
            url=f"{frontend_url}/auth/callback?token={access_token}&type=google_success", 
            status_code=status.HTTP_302_FOUND
        )
        
        # Also set HTTP-only cookie as backup
        response.set_cookie(
            key="access_token",
            value=f"Bearer {access_token}",
            httponly=True,
            secure=settings.ENVIRONMENT == "production", 
            samesite="lax",
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
        return response
        
    except Exception as e:
        print(f"OAuth error: {str(e)}")
        return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")

@oauth_router.post("/auth/unlink-google")
async def unlink_google_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unlink Google account from user profile"""
    
    user = db.query(User).filter(User.email == current_user.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has a password set
    if not user.hashed_password and user.oauth_provider == "google":
        raise HTTPException(
            status_code=400, 
            detail="Cannot unlink Google account. Please set a password first."
        )

    user.google_id = None
    if user.oauth_provider == "google":
        user.oauth_provider = None
    
    db.commit()
    
    return {"message": "Google account unlinked successfully"}

@oauth_router.get("/auth/providers")
async def get_oauth_providers():
    """Get available OAuth providers configuration"""
    return {
        "google": {
            "enabled": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
            "auth_url": "/api/auth/google"
        }
    }