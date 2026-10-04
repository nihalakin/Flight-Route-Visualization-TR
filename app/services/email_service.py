"""
E-posta gönderme servisi.
SMTP kullanarak e-posta gönderir.
"""
import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.email_from = os.getenv("EMAIL_FROM", "nodiadestek@gmail.com")

    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
    ) -> bool:
        """
        E-posta gönderir.
        
        Args:
            to_email: Alıcı e-posta adresi
            subject: E-posta konusu
            body: E-posta metin içeriği
            html_body: E-posta HTML içeriği (opsiyonel)
            
        Returns:
            bool: Gönderme başarılı mı
        """
        try:
            message = MIMEMultipart("alternative")
            message["From"] = self.email_from
            message["To"] = to_email
            message["Subject"] = subject

            # Metin içeriği
            text_part = MIMEText(body, "plain", "utf-8")
            message.attach(text_part)

            # HTML içeriği (varsa)
            if html_body:
                html_part = MIMEText(html_body, "html", "utf-8")
                message.attach(html_part)

            # SMTP bağlantısı ve gönderme
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)

            logger.info(f"E-posta başarıyla gönderildi: {to_email} - {subject}")
            return True

        except Exception as e:
            logger.error(f"E-posta gönderme hatası: {e}")
            return False


# Singleton instance
email_service = EmailService()
