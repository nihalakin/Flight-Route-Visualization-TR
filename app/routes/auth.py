"""
Kullanıcı kayıt, giriş, JWT auth ve şifre sıfırlama.
- Register: email, username, first_name, last_name, password. is_admin alınmaz ve oluşturulmaz.
- Username: sistem genelinde benzersiz ve değiştirilemez (sadece kayıt sırasında alınır).
- Role-based: get_current_user, get_current_admin. Admin rolü endpoint ile değiştirilemez.
"""
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
)
from app.database import get_db
from app.models import PasswordReset, User
from app.schemas.auth import (
    ForgotPasswordRequest,
    MessageResponse,
    PasswordChange,
    ResetPasswordRequest,
    Token,
    UserRegister,
    UserResponse,
    UserUpdate,
)
import bcrypt
from jose import JWTError, jwt
from app.core.config import settings
from app.core.email import send_reset_email

logger = logging.getLogger(__name__)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    pwd = (password or "")[:72]
    return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(sub: str, expires_delta: timedelta | None = None) -> str:
    to_encode = {"sub": sub}
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_reset_token(expires_minutes: int = 30) -> tuple[str, str, datetime]:
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_reset_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    return raw_token, token_hash, expires_at


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    return user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Sadece admin kullanıcılar. Admin rolü endpoint ile değiştirilemez."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin only",
        )
    return current_user


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: Session = Depends(get_db)):
    """
    Yeni kullanıcı kaydı.
    - Zorunlu alanlar: email, username, first_name, last_name, password.
    - is_admin kullanıcıdan alınmaz; admin register ile oluşturulamaz.
    - username sistem genelinde benzersizdir ve kayıt sonrası değiştirilemez.
    is_admin kullanıcıdan alınmaz; admin register ile oluşturulamaz.
    """
    if get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    if get_user_by_username(db, data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )
    user = User(
        username=data.username.strip(),
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        hashed_password=get_password_hash(data.password),
        is_active=True,
        is_admin=False,  # Register ile asla admin oluşturulmaz
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("User registered: %s (id=%s)", user.email, user.id)
    return {
        "message": "User registered successfully",
        "user_id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Giriş: username alanına email yazılır (OAuth2 form)."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        sub=user.email,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Mevcut kullanıcı bilgisi."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username or "",
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Profil bilgilerini güncelle (ad, soyad)."""
    if data.first_name is not None:
        current_user.first_name = data.first_name.strip()
    if data.last_name is not None:
        current_user.last_name = data.last_name.strip()
    db.commit()
    db.refresh(current_user)
    logger.info("User updated: %s", current_user.email)
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username or "",
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
    )


@router.post("/me/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Şifreyi güvenli şekilde değiştir."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mevcut şifre hatalı",
        )
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    logger.info("Password changed for user: %s", current_user.email)
    return {"message": "Şifre başarıyla güncellendi"}


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Şifre sıfırlama isteği.
    - Email sistemde kayıtlı olsun/olmasın her zaman aynı mesaj döner (email enumeration koruması).
    - Token tek kullanımlık ve 30 dakika geçerlidir.
    """
    email = payload.email

    user = get_user_by_email(db, email)

    if user:
        raw_token, token_hash, expires_at = create_reset_token(expires_minutes=30)

        # Bu kullanıcıya ait eski token kayıtlarını pasif et / sil
        db.query(PasswordReset).filter(PasswordReset.user_id == user.id).delete()

        reset_entry = PasswordReset(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            is_active=True,
        )
        db.add(reset_entry)
        db.commit()

        reset_url = f"{settings.frontend_reset_url}?token={raw_token}"

        # Maili arka planda gönder
        background_tasks.add_task(send_reset_email, user.email, reset_url)

    return MessageResponse(
        message=(
            "Eğer bu email sistemimizde kayıtlı ise, "
            "şifre sıfırlama bağlantısı gönderildi."
        )
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Şifreyi resetler:
    - Token hash'lenir ve veritabanındaki token_hash ile karşılaştırılır.
    - Token süresi (30 dakika) ve is_active alanı kontrol edilir.
    - Yeni şifre bcrypt ile hashlenir ve kullanıcı güncellenir.
    - Kullanılan token kaydı pasif edilir (is_active = False), cleanup job ile silinir.
    """
    now = datetime.now(timezone.utc)

    token_hash = hash_reset_token(payload.token)

    reset_entry = (
        db.query(PasswordReset)
        .filter(
            PasswordReset.token_hash == token_hash,
        )
        .first()
    )

    if not reset_entry or not reset_entry.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı.",
        )

    if reset_entry.expires_at < now:
        reset_entry.is_active = False
        db.add(reset_entry)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı.",
        )

    user = db.query(User).filter(User.id == reset_entry.user_id).first()
    if not user:
        reset_entry.is_active = False
        db.add(reset_entry)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı.",
        )

    # Yeni şifreyi bcrypt ile hashle
    user.hashed_password = get_password_hash(payload.new_password)
    db.add(user)

    # Token tek kullanımlık: pasif hale getir (cleanup job ile silinecek)
    reset_entry.is_active = False
    db.add(reset_entry)

    db.commit()

    return MessageResponse(message="Şifreniz başarıyla güncellendi.")


@router.get("/admin/me", response_model=UserResponse)
async def admin_me(current_user: User = Depends(get_current_admin)):
    """Sadece admin: mevcut admin bilgisi. Admin rolü endpoint ile değiştirilemez."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username or "",
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
    )
