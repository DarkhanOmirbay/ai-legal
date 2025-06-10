import secrets
import hashlib
import smtplib
import random
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
from config import settings
from models.models import User, PasswordResetToken, EmailVerificationToken
from database import get_db
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password) -> str:
    return pwd_context.hash(password)

def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

# Password reset functions
def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)

def create_reset_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def create_password_reset_token(db: Session, email: str):
    db.query(PasswordResetToken).filter(PasswordResetToken.email == email).delete()
    
    token = generate_reset_token()
    token_hash = create_reset_token_hash(token)
    expires_at = datetime.utcnow() + timedelta(hours=1)
    
    db_token = PasswordResetToken(
        email=email,
        token=token_hash,
        expires_at=expires_at
    )
    
    db.add(db_token)
    db.commit()
    
    return token

def get_reset_token(db: Session, token: str):
    token_hash = create_reset_token_hash(token)
    
    return db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token_hash,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()

def update_user_password(db: Session, email: str, new_password: str):
    user = get_user_by_email(db, email)
    if user:
        user.hashed_password = get_password_hash(new_password)
        db.commit()
        return user
    return None

def use_reset_token(db: Session, token_record: PasswordResetToken):
    token_record.used = True
    db.commit()

# Email verification functions
def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return str(random.randint(100000, 999999))

def create_email_verification_token(db: Session, email: str):
    """Create email verification token with 6-digit code"""
    # Delete any existing verification tokens for this email
    db.query(EmailVerificationToken).filter(EmailVerificationToken.email == email).delete()
    
    verification_code = generate_verification_code()
    expires_at = datetime.utcnow() + timedelta(minutes=15)  # 15 minutes expiry
    
    db_token = EmailVerificationToken(
        email=email,
        code=verification_code,
        expires_at=expires_at
    )
    
    db.add(db_token)
    db.commit()
    
    return verification_code

def get_verification_token(db: Session, email: str, code: str):
    """Get valid verification token"""
    return db.query(EmailVerificationToken).filter(
        EmailVerificationToken.email == email,
        EmailVerificationToken.code == code,
        EmailVerificationToken.used == False,
        EmailVerificationToken.expires_at > datetime.utcnow()
    ).first()

def use_verification_token(db: Session, token_record: EmailVerificationToken):
    """Mark verification token as used"""
    token_record.used = True
    db.commit()

def verify_user_email(db: Session, email: str):
    """Mark user's email as verified"""
    user = get_user_by_email(db, email)
    if user:
        user.email_verified = True
        db.commit()
        return user
    return None

# Email sending functions
def send_email(to_email: str, subject: str, body: str):
    """Send email using SMTP"""
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.FROM_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        text = msg.as_string()
        server.sendmail(settings.FROM_EMAIL, to_email, text)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return False

def send_verification_email(verification_code: str, email: str):
    """Send email verification code"""
    subject = "Email Verification Code - AI Legal Assistant"
    
    body = f"""
    <html>
        <body>
            <h2>Email Verification</h2>
            <p>Thank you for registering with AI Legal Assistant!</p>
            <p>Your verification code is:</p>
            <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px;">{verification_code}</h1>
            <p>This code will expire in 15 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        </body>
    </html>
    """
    
    return send_email(email, subject, body)

def send_password_reset_email(reset_token: str, email: str):
    """Send password reset email"""
    reset_link = f"http://localhost:5173/reset-password?token={reset_token}"
    
    subject = "Password Reset Request"
    
    body = f"""
    <html>
        <body>
            <h2>Password Reset Request</h2>
            <p>You have requested to reset your password. Click the link below to reset it:</p>
            <p><a href="{reset_link}">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
        </body>
    </html>
    """
    
    return send_email(email, subject, body)