/**
 * navbar.html dosyasını yükleyip #navbar-container içine yerleştirir,
 * aktif menü linkini sayfa path'ine göre ayarlar ve giriş/çıkış davranışını başlatır.
 */
(function() {
    var container = document.getElementById('navbar-container');
    if (!container) return;

    function setActiveLink() {
        var path = window.location.pathname || '/';
        document.querySelectorAll('.nav-link[data-nav-path]').forEach(function(a) {
            var linkPath = a.getAttribute('data-nav-path');
            if (linkPath === path || (path === '/' && linkPath === '/')) {
                a.classList.add('active');
            } else {
                a.classList.remove('active');
            }
        });
    }

    function initAuthNav() {
        var token = localStorage.getItem('access_token');
        var navGuest = document.getElementById('navGuest');
        var navUser = document.getElementById('navUser');
        var navAdminDashboard = document.getElementById('navAdminDashboard');
        var loginLink = document.querySelector('a.nav-btn-login[href*="login"], a[href="/login"]');
        var path = window.location.pathname || '/';
        if (path === '/login' || path === '/register') path = '/';
        var loginHref = '/login?next=' + encodeURIComponent(path);

        if (loginLink) loginLink.setAttribute('href', loginHref);

        if (navGuest && navUser) {
            if (token) {
                navGuest.style.display = 'none';
                navUser.style.display = 'flex';
                navUser.style.gap = '0.5rem';
                navUser.style.alignItems = 'center';
                // Admin link: sadece /api/me cevabındaki is_admin ile göster/gizle (rol frontend'de saklanmaz)
                if (navAdminDashboard) {
                    fetch(window.location.origin + '/api/me', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    })
                    .then(function(r) { return r.ok ? r.json() : null; })
                    .then(function(me) {
                        if (!navAdminDashboard) return;
                        navAdminDashboard.style.display = (me && me.is_admin) ? 'inline-flex' : 'none';
                    })
                    .catch(function() {
                        if (navAdminDashboard) navAdminDashboard.style.display = 'none';
                    });
                }
            } else {
                navGuest.style.display = 'flex';
                navUser.style.display = 'none';
                if (navAdminDashboard) navAdminDashboard.style.display = 'none';
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

    function initHamburger() {
        var hamburger = container.querySelector('.hamburger');
        var navMenu = container.querySelector('.nav-menu');
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', function() {
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });
            container.querySelectorAll('.nav-link').forEach(function(link) {
                link.addEventListener('click', function() {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                });
            });
        }
    }

    fetch('/partials/navbar.html')
        .then(function(r) { return r.text(); })
        .then(function(html) {
            container.innerHTML = html;
            setActiveLink();
            initAuthNav();
            initHamburger();
        })
        .catch(function() {
            container.innerHTML = '<nav class="navbar"><div class="nav-container">Navbar yüklenemedi.</div></nav>';
        });
})();
