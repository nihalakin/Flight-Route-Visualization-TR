import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from app.core.config import settings


def send_reset_email(to_email: str, reset_url: str) -> None:
    """
    Şifre sıfırlama e-postası gönderir.
    - Lokal geliştirmede (localhost/127.0.0.1) sadece plain text gönderilir (senin çalışan örneğin gibi)
    - Gerçek ortamda (domain) plain + basit HTML birlikte gönderilir
    """
    subject = f"Şifre Sıfırlama Talebi - {settings.app_name}"

    # Her durumda kullanılan düz metin gövde (senin çalışan versiyonunun profesyonel hali)
    text_body = f"""
Merhaba,

Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın (30 dakika içinde geçerlidir):

{reset_url}

Bağlantı çalışmazsa yukarıdaki linki tarayıcınıza kopyalayıp yapıştırın.

Eğer bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.

İyi günler,
{settings.app_name} Ekibi
"""

    # Lokal geliştirme: Sadece plain text (mail istemcileri localhost linki HTML’de daha agresif filtreleyebiliyor)
    if "localhost" in reset_url or "127.0.0.1" in reset_url:
        msg = MIMEText(text_body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = formataddr((settings.app_name, settings.email_from))
        msg["To"] = to_email
    else:
        # Production/staging: plain + basit HTML birlikte
        html_body = f"""
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Şifre Sıfırlama</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;padding:16px 0;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;border:1px solid #e5e7eb;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
            <tr>
              <td align="center" style="padding-bottom:16px;">
                <span style="font-size:22px;font-weight:600;color:#2563eb;">{settings.app_name}</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;">
                <h1 style="margin:0;font-size:20px;font-weight:600;color:#111827;text-align:center;">
                  Şifre Sıfırlama Talebi
                </h1>
              </td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#374151;padding-bottom:16px;">
                Merhaba,
              </td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#374151;padding-bottom:16px;">
                <strong>{settings.app_name}</strong> hesabınız için şifre sıfırlama talebinde bulundunuz.
                Şifrenizi sıfırlamak için aşağıdaki butona tıklayın.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 0 20px 0;">
                <a href="{reset_url}"
                   style="display:inline-block;padding:12px 28px;background-color:#2563eb;color:#ffffff;
                          text-decoration:none;border-radius:6px;font-size:15px;font-weight:500;">
                  Şifremi Sıfırla
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#6b7280;padding-bottom:12px;text-align:center;">
                Bu bağlantı <strong>30 dakika</strong> süreyle geçerlidir.
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#6b7280;padding:12px 12px 16px 12px;background-color:#f9fafb;border-radius:6px;">
                Bağlantı çalışmazsa aşağıdaki adresi kopyalayıp tarayıcınızın adres çubuğuna yapıştırın:
                <br /><br />
                <a href="{reset_url}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">
                  {reset_url}
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#6b7280;padding-top:16px;">
                Eğer bu isteği siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz. Hesabınızda herhangi bir değişiklik yapılmayacaktır.
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:1.6;color:#374151;padding-top:20px;">
                Saygılarımızla,<br />
                <strong>{settings.app_name} Ekibi</strong>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formataddr((settings.app_name, settings.email_from))
        msg["To"] = to_email

        part_text = MIMEText(text_body, "plain", "utf-8")
        part_html = MIMEText(html_body, "html", "utf-8")

        msg.attach(part_text)
        msg.attach(part_html)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)