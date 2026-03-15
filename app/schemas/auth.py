"""Auth ile ilgili Pydantic şemaları. is_admin kullanıcıdan alınmaz."""
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=30)
    first_name: str
    last_name: str
    password: str


class UserUpdate(BaseModel):
    """Profil güncelleme: ad ve soyad."""
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)


class PasswordChange(BaseModel):
    """Şifre değiştirme."""
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=72)


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    first_name: str
    last_name: str
    is_active: bool
    is_admin: bool

    class Config:
        from_attributes = True
