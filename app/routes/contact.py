"""
İletişim formu işlemleri:
- İletişim formu gönderimi
- İletişim sayfası görüntüleme
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from starlette.templating import Jinja2Templates

from app.database import get_db
from app.models import ContactForm

router = APIRouter(prefix="/contact", tags=["contact"])
templates = Jinja2Templates(directory="templates")


class ContactFormSubmit(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    subject: str = Field(..., min_length=5, max_length=255)
    message: str = Field(..., min_length=10, max_length=5000)


@router.get("/", response_class=HTMLResponse)
async def contact_page(request: Request):
    """İletişim sayfasını gösterir."""
    return templates.TemplateResponse("contact.html", {"request": request})


@router.get("", response_class=HTMLResponse)
async def contact_page_no_slash(request: Request):
    """İletişim sayfasını gösterir (trailing slash olmadan)."""
    return templates.TemplateResponse("contact.html", {"request": request})


@router.post("/submit", status_code=status.HTTP_201_CREATED)
async def submit_contact_form(
    form_data: ContactFormSubmit,
    db: Session = Depends(get_db),
):
    """
    İletişim formunu kaydeder.
    """
    contact_form = ContactForm(
        name=form_data.name.strip(),
        email=form_data.email.strip(),
        subject=form_data.subject.strip(),
        message=form_data.message.strip(),
        status="pending",
    )
    db.add(contact_form)
    db.commit()
    db.refresh(contact_form)
    
    return {
        "success": True,
        "message": "İletişim formunuz başarıyla gönderildi. En kısa sürede size dönüş yapacağız.",
        "id": contact_form.id
    }
