from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, BackgroundTasks, Response
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, model_validator

from database import get_db
from models.models import User
from services.auth_service import (
    authenticate_user, create_access_token, get_password_hash, get_user_by_email,
    create_password_reset_token, send_password_reset_email, get_reset_token,
    update_user_password, use_reset_token, create_email_verification_token,
    send_verification_email, get_verification_token, use_verification_token,
    verify_user_email, get_current_user
)
from config import settings

router = APIRouter(tags=["auth"])

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)  
    
    @model_validator(mode="before")
    @classmethod
    def confirm_pass(cls, values):  
        password = values.get('new_password')
        confirm_password = values.get('confirm_password')  
        if password and confirm_password and password != confirm_password:
            raise ValueError("Passwords do not match")
        return values

class EmailVerificationRequest(BaseModel):
    email: EmailStr
    verification_code: str = Field(..., min_length=6, max_length=6)

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)
    
    @model_validator(mode="before")
    @classmethod
    def passwords_match(cls, values):
        password = values.get('password')
        confirm_password = values.get('confirm_password')
        if password and confirm_password and password != confirm_password:
            raise ValueError("Passwords do not match")
        return values

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

@router.post("/register")
async def register(
    register_data: RegisterRequest,
    bg: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == register_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    existing_username = db.query(User).filter(User.username == register_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create user (but don't verify email yet)
    hashed_password = get_password_hash(register_data.password)
    new_user = User(
        email=register_data.email, 
        username=register_data.username, 
        hashed_password=hashed_password,
        email_verified=False  # Set to False initially
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create verification token and send email
    verification_code = create_email_verification_token(db, register_data.email)
    bg.add_task(send_verification_email, verification_code, register_data.email)
    
    return {
        "message": "Registration successful! Please check your email for verification code.",
        "email": register_data.email,
        "requires_verification": True
    }

@router.post("/verify-email")
async def verify_email(
    verification_data: EmailVerificationRequest,
    db: Session = Depends(get_db)
):
    # Get verification token
    token_record = get_verification_token(db, verification_data.email, verification_data.verification_code)
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code"
        )
    
    # Verify user's email
    user = verify_user_email(db, verification_data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    # Mark token as used
    use_verification_token(db, token_record)
    
    return {
        "message": "Email verified successfully!",
        "verified": True
    }

@router.post("/resend-verification")
async def resend_verification(
    email_data: dict,
    bg: BackgroundTasks,
    db: Session = Depends(get_db)
):
    email = email_data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required"
        )
    
    # Check if user exists
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    # Check if already verified
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified"
        )
    
    # Create new verification token and send email
    verification_code = create_email_verification_token(db, email)
    bg.add_task(send_verification_email, verification_code, email)
    
    return {"message": "Verification code sent successfully!"}

@router.post("/login")
async def login(
    login_data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Check if email is verified
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please verify your email before logging in"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    # Set HTTP-only cookie
    response.set_cookie(
        key="access_token", 
        value=f"Bearer {access_token}", 
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return {
        "message": "Login successful",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "full_name": user.full_name
        },
        "access_token": access_token,  # Also return token for frontend storage if needed
        "token_type": "bearer"
    }

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}

@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "avatar_url": current_user.avatar_url,
        "full_name": current_user.full_name,
        "email_verified": current_user.email_verified,
        "oauth_provider": current_user.oauth_provider
    }

@router.post("/forgot-password")
async def forgot_password(
    forgot_password_data: ForgotPasswordRequest,
    bg: BackgroundTasks,
    db: Session = Depends(get_db)
):
    user = get_user_by_email(db, forgot_password_data.email)
    
    if user:
        reset_token = create_password_reset_token(db, forgot_password_data.email)
        bg.add_task(
            send_password_reset_email,
            reset_token,
            forgot_password_data.email,
        )
    return {
        "message": "If the email exists, a password reset link has been sent"
    }

@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    token_record = get_reset_token(db, request.token)
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    user = update_user_password(db, token_record.email, request.new_password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    use_reset_token(db, token_record)
    return {"message": "Password reset successfully"}