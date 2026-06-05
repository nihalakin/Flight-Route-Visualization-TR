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
        var profileNameEl = document.getElementById('profileDropdownName');
        var profileEmailEl = document.getElementById('profileDropdownEmail');
        var profileAvatarInitialsEl = document.getElementById('profileAvatarInitials');
        var loginLink = document.querySelector('a.nav-btn-login[href*="login"], a[href="/login"]');
        var path = window.location.pathname || '/';
        if (path === '/login' || path === '/register') path = '/';
        var loginHref = '/login?next=' + encodeURIComponent(path);

        if (loginLink) loginLink.setAttribute('href', loginHref);

        function showGuest() {
            if (navGuest) navGuest.style.display = 'flex';
            if (navUser) navUser.style.display = 'none';
            if (navAdminDashboard) navAdminDashboard.style.display = 'none';
        }

        if (navGuest && navUser) {
            if (token) {
                navGuest.style.display = 'none';
                navUser.style.display = 'flex';
                navUser.style.gap = '0.5rem';
                navUser.style.alignItems = 'center';

                // Kullanıcı bilgilerini ve admin durumunu getir
                fetch(window.location.origin + '/api/me', {
                    headers: { 'Authorization': 'Bearer ' + token }
                })
                .then(function(r) {
                    if (!r.ok) return null;
                    return r.json();
                })
                .then(function(me) {
                    if (!me) {
                        // Token geçersiz ise çıkış yapılmış gibi davran
                        localStorage.removeItem('access_token');
                        showGuest();
                        return;
                    }

                    // Admin dashboard görünürlüğü
                    if (navAdminDashboard) {
                        navAdminDashboard.style.display = me.is_admin ? 'inline-flex' : 'none';
                    }

                    // Dropdown'da isim / email
                    if (profileNameEl) {
                        var fullName = ((me.first_name || '') + ' ' + (me.last_name || '')).trim();
                        profileNameEl.textContent = fullName || (me.username || 'Kullanıcı');
                    }
                    if (profileEmailEl) {
                        profileEmailEl.textContent = me.email || '';
                    }

                    // Avatar baş harfleri
                    if (profileAvatarInitialsEl) {
                        var firstInitial = (me.first_name || '').trim().charAt(0).toUpperCase();
                        var lastInitial = (me.last_name || '').trim().charAt(0).toUpperCase();
                        var initials = (firstInitial + lastInitial).trim();
                        if (!initials) {
                            initials = (me.username || '?').trim().charAt(0).toUpperCase() || 'U';
                        }
                        profileAvatarInitialsEl.textContent = initials;
                    }
                })
                .catch(function() {
                    // API hata verirse de güvenli tarafta kal: kullanıcıyı çıkış yapmış say
                    localStorage.removeItem('access_token');
                    showGuest();
                });

                initProfileDropdown();
            } else {
                showGuest();
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

    function initProfileDropdown() {
        var trigger = document.getElementById('profileDropdownTrigger');
        var menu = document.getElementById('profileDropdownMenu');
        var dropdown = document.getElementById('profileDropdown');
        if (!trigger || !menu || !dropdown) return;

        var isOpen = false;

        function openMenu() {
            if (isOpen) return;
            isOpen = true;
            dropdown.classList.add('profile-dropdown--open');
            menu.classList.add('profile-dropdown__menu--open');
            menu.setAttribute('aria-hidden', 'false');
            trigger.setAttribute('aria-expanded', 'true');
        }

        function closeMenu() {
            if (!isOpen) return;
            isOpen = false;
            dropdown.classList.remove('profile-dropdown--open');
            menu.classList.remove('profile-dropdown__menu--open');
            menu.setAttribute('aria-hidden', 'true');
            trigger.setAttribute('aria-expanded', 'false');
        }

        trigger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        menu.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        document.addEventListener('click', function() {
            closeMenu();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeMenu();
            }
        });

        // Menü içindeki data-nav attribute'lu öğeler için yönlendirme
        menu.querySelectorAll('[data-nav]').forEach(function(item) {
            item.addEventListener('click', function() {
                var target = this.getAttribute('data-nav');
                if (target) {
                    window.location.href = target;
                }
                closeMenu();
            });
        });
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
