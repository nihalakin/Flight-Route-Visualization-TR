from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import send_reset_email
from app.core.security import create_reset_token, hash_password, hash_token
from app.db import models
from app.db.database import get_db
from app.schemas.auth import ForgotPasswordRequest, MessageResponse, ResetPasswordRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = payload.email

    user = db.query(models.User).filter(models.User.email == email).first()

    if user:
        raw_token, token_hash, expires_at = create_reset_token(expires_minutes=30)

        db.query(models.PasswordReset).filter(
            models.PasswordReset.user_id == user.id
        ).delete()

        reset_entry = models.PasswordReset(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(reset_entry)
        db.commit()

        reset_url = f"{settings.frontend_reset_url}?token={raw_token}"

        background_tasks.add_task(send_reset_email, user.email, reset_url)

    return MessageResponse(
        message=(
            "Eğer bu email sistemimizde kayıtlı ise, "
            "şifre sıfırlama bağlantısı gönderildi."
        )
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    token_hash = hash_token(payload.token)

    reset_entry = (
        db.query(models.PasswordReset)
        .filter(models.PasswordReset.token_hash == token_hash)
        .first()
    )

    if not reset_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı.",
        )

    if reset_entry.expires_at < now:
        db.delete(reset_entry)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı.",
        )

    user = db.query(models.User).filter(models.User.id == reset_entry.user_id).first()
    if not user:
        db.delete(reset_entry)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı.",
        )

    user.password_hash = hash_password(payload.new_password)
    db.add(user)

    db.delete(reset_entry)

    db.commit()

    return MessageResponse(message="Şifreniz başarıyla güncellendi.")

