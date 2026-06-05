import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from typing import Optional

from app.core.config import settings


def send_reset_email(to_email: str, reset_url: str, username: Optional[str] = None) -> None:
    """
    Kullanıcıya şifre sıfırlama e-postası gönderir.
    
    Args:
        to_email: Alıcı e-posta adresi
        reset_url: Şifre sıfırlama bağlantısı
        username: Kullanıcı adı (opsiyonel)
    """
    subject = f"[{settings.app_name}] Şifre Sıfırlama Talebi"
    
    # Kullanıcı adı varsa kişiselleştirilmiş selamlama
    greeting = f"Merhaba {username}," if username else "Merhaba,"
    
    # HTML ve düz metin versiyonları
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px; margin: 20px 0;">
            <h2 style="color: #2c3e50; margin-bottom: 20px;">🔐 Şifre Sıfırlama</h2>
            
            <p style="margin-bottom: 20px;">{greeting}</p>
            
            <p style="margin-bottom: 20px;">
                <strong>{settings.app_name}</strong> hesabınız için bir şifre sıfırlama talebi aldık.
                Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}" 
                   style="background-color: #007bff; 
                          color: white; 
                          padding: 12px 30px; 
                          text-decoration: none; 
                          border-radius: 5px;
                          font-weight: bold;
                          display: inline-block;">
                    Şifremi Sıfırla
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                ⏰ Bu bağlantı <strong>30 dakika</strong> süreyle geçerlidir.
            </p>
            
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                Eğer buton çalışmazsa, aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:
                <br>
                <a href="{reset_url}" style="color: #007bff; word-break: break-all;">{reset_url}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
            
            <p style="color: #999; font-size: 13px; font-style: italic;">
                Bu e-postayı siz talep etmediyseniz, herhangi bir işlem yapmanıza gerek yoktur.
                Hesabınız güvendedir.
            </p>
            
            <p style="color: #666; font-size: 13px; margin-top: 20px;">
                Saygılarımızla,<br>
                <strong>{settings.app_name} Ekibi</strong>
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center; color: #999; font-size: 12px;">
                <p>© {settings.app_name}. Tüm hakları saklıdır.</p>
                <p>
                    Bu e-posta size {settings.app_name} hizmetleri hakkında bilgi vermek amacıyla gönderilmiştir.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_body = f"""
{greeting}

{settings.app_name} hesabınız için bir şifre sıfırlama talebi aldık.
Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın:

🔗 {reset_url}

⏰ Bu bağlantı 30 dakika süreyle geçerlidir.

Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
Hesabınız güvendedir.

Saygılarımızla,
{settings.app_name} Ekibi

---
Bu e-posta size {settings.app_name} hizmetleri hakkında bilgi vermek amacıyla gönderilmiştir.
    """

    # Çok parçalı e-posta oluştur
    msg = MIMEMultipart('alternative')
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.app_name, settings.email_from))
    msg["To"] = to_email
    
    # E-posta başlıklarına ek bilgiler
    msg["X-Mailer"] = f"{settings.app_name} Mail Service"
    msg["X-Priority"] = "3"  # Normal öncelik
    msg["List-Unsubscribe"] = f"<mailto:{settings.email_from}?subject=unsubscribe>"
    
    # Metin ve HTML versiyonlarını ekle
    part1 = MIMEText(text_body, "plain", "utf-8")
    part2 = MIMEText(html_body, "html", "utf-8")
    
    msg.attach(part1)
    msg.attach(part2)

    # E-posta gönderimi
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
            
    except smtplib.SMTPException as e:
        # Hata durumunda loglama yapılabilir
        print(f"E-posta gönderilemedi: {str(e)}")
        raise