// register.js - Kayıt sayfası işlevleri

document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const errorText = document.getElementById('errorText');
    const successText = document.getElementById('successText');
    const loginLink = document.getElementById('loginLink');

    // URL'deki next parametresi (giriş sonrası yönlendirilecek sayfa)
    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get('next') || '';
    const loginUrl = nextUrl ? '/login?next=' + encodeURIComponent(nextUrl) : '/login';

    // Şifre validasyonu
    function validatePassword(password) {
        return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
    }

    // Form gönderimi
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Mesajları gizle
            errorDiv.classList.add('hidden');
            successDiv.classList.add('hidden');
            
            const formData = {
                first_name: document.getElementById('firstname').value.trim(),
                last_name: document.getElementById('lastname').value.trim(),
                email: document.getElementById('email').value.trim(),
                password: document.getElementById('password').value
            };
            
            // Şifre validasyonu
            if (!validatePassword(formData.password)) {
                errorText.textContent = 'Şifre en az 8 karakter olmalı, 1 büyük harf ve 1 rakam içermelidir.';
                errorDiv.classList.remove('hidden');
                return;
            }
            
            try {
                // Sunucu URL'sini ayarla (port dönüşümü)
                const baseUrl = window.location.origin.replace(':5501', ':8000').replace(':5500', ':8000');
                const url = `${baseUrl}/api/register`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });
                
                let data;
                try {
                    data = await response.json();
                } catch (jsonError) {
                    console.error('JSON parse hatası:', jsonError);
                    errorText.textContent = `Sunucu hatası: Geçersiz yanıt formatı.`;
                    errorDiv.classList.remove('hidden');
                    return;
                }
                
                if (response.ok) {
                    successText.textContent = 'Hesap oluşturuldu! Giriş sayfasına yönlendiriliyorsun...';
                    successDiv.classList.remove('hidden');
                    
                    setTimeout(() => {
                        const baseUrl = window.location.origin.replace(':5501', ':8000').replace(':5500', ':8000');
                        window.location.href = baseUrl + loginUrl;
                    }, 2000);
                } else {
                    let errorMessage = 'Kayıt başarısız';
                    
                    if (data.detail) {
                        if (Array.isArray(data.detail)) {
                            errorMessage = data.detail.map(err => err.msg || err.message).join(', ');
                        } else {
                            errorMessage = data.detail;
                        }
                    } else if (data.message) {
                        errorMessage = data.message;
                    } else if (data.error) {
                        errorMessage = data.error;
                    }
                    
                    errorText.textContent = errorMessage;
                    errorDiv.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Kayıt hatası:', error);
                errorText.textContent = `Bağlantı hatası: ${error.message || 'Sunucuya ulaşılamadı.'}`;
                errorDiv.classList.remove('hidden');
            }
        });
    }

    // Login linki (next parametresi korunur)
    if (loginLink) {
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            const baseUrl = window.location.origin.replace(':5501', ':8000').replace(':5500', ':8000');
            window.location.href = baseUrl + loginUrl;
        });
    }
});