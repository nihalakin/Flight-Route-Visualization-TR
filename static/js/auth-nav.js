/**
 * Navbar: Giriş/Üye Ol vs Profil/Çıkış ve "Giriş Yap" linkine next parametresi ekleme.
 * Tüm sayfalarda bu script yüklendiğinde:
 * - Login linki mevcut sayfa path'i ile /login?next=... olarak güncellenir.
 * - Token varsa Profil + Çıkış Yap gösterilir, yoksa Üye Ol + Giriş Yap gösterilir.
 */
(function() {
    function initAuthNav() {
        var token = localStorage.getItem('access_token');
        var navGuest = document.getElementById('navGuest');
        var navUser = document.getElementById('navUser');
        var loginLink = document.querySelector('a[href="/login"], a.nav-btn-login[href*="login"]');
        var path = window.location.pathname || '/';
        if (path === '/login' || path === '/register') path = '/';
        var loginHref = '/login?next=' + encodeURIComponent(path);

        if (loginLink) {
            loginLink.setAttribute('href', loginHref);
        }

        if (navGuest && navUser) {
            if (token) {
                navGuest.style.display = 'none';
                navUser.style.display = 'flex';
                navUser.style.gap = '0.5rem';
                navUser.style.alignItems = 'center';
            } else {
                navGuest.style.display = 'flex';
                navUser.style.display = 'none';
            }
        }

        var logoutBtn = document.getElementById('navLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                localStorage.removeItem('access_token');
                window.location.href = '/';
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuthNav);
    } else {
        initAuthNav();
    }
})();
