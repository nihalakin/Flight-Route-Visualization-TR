/**
 * Admin Dashboard: kullanıcı listesi ve silme.
 * common.js (getApiBase, getToken, fetchWithAuth) kullanır.
 */
(function () {
    'use strict';

    var apiBase = window.NodiaApp ? window.NodiaApp.getApiBase() : window.location.origin;
    var token = window.NodiaApp ? window.NodiaApp.getToken() : localStorage.getItem('access_token');

    // --- DOM referansları ---
    var usersTableBody = document.getElementById('usersTableBody');
    var loadingRow = document.getElementById('loadingRow');
    var emptyRow = document.getElementById('emptyRow');
    var userCountText = document.getElementById('userCountText');
    var userSearchInput = document.getElementById('userSearchInput');
    var userRoleFilter = document.getElementById('userRoleFilter');
    var userSortSelect = document.getElementById('userSortSelect');
    var userPaginationInfo = document.getElementById('userPaginationInfo');
    var userPaginationInfoBottom = document.getElementById('userPaginationInfoBottom');
    var userPrevPageBtn = document.getElementById('userPrevPage');
    var userNextPageBtn = document.getElementById('userNextPage');

    var reviewsTableBody = document.getElementById('reviewsTableBody');
    var reviewsLoadingRow = document.getElementById('reviewsLoadingRow');
    var reviewsEmptyRow = document.getElementById('reviewsEmptyRow');
    var reviewCountText = document.getElementById('reviewCountText');
    var reviewStatusFilter = document.getElementById('reviewStatusFilter');
    var reviewSearchInput = document.getElementById('reviewSearchInput');
    var reviewPrevPageBtn = document.getElementById('reviewPrevPage');
    var reviewNextPageBtn = document.getElementById('reviewNextPage');

    var couponsTableBody = document.getElementById('couponsTableBody');
    var couponsLoadingRow = document.getElementById('couponsLoadingRow');
    var couponsEmptyRow = document.getElementById('couponsEmptyRow');
    var couponCountText = document.getElementById('couponCountText');
    var couponSearchInput = document.getElementById('couponSearchInput');
    var couponStatusFilter = document.getElementById('couponStatusFilter');

    var couponCreateForm = document.getElementById('couponCreateForm');
    var couponCreateExtra = document.getElementById('couponCreateExtra');
    var couponCreateMore = document.getElementById('couponCreateMore');
    var couponEditModal = document.getElementById('couponEditModal');
    var couponEditForm = document.getElementById('couponEditForm');
    var couponEditCancel = document.getElementById('couponEditCancel');

    // Havalimanları
    var airportsTableBody = document.getElementById('airportsTableBody');
    var airportsLoadingRow = document.getElementById('airportsLoadingRow');
    var airportsEmptyRow = document.getElementById('airportsEmptyRow');
    var airportCountText = document.getElementById('airportCountText');
    var airportSearchInput = document.getElementById('airportSearchInput');
    var airportRegionFilter = document.getElementById('airportRegionFilter');
    var airportTypeFilter = document.getElementById('airportTypeFilter');
    var airportSortSelect = document.getElementById('airportSortSelect');
    var airportPaginationInfo = document.getElementById('airportPaginationInfo');
    var airportPaginationInfoBottom = document.getElementById('airportPaginationInfoBottom');
    var airportPrevPageBtn = document.getElementById('airportPrevPage');
    var airportNextPageBtn = document.getElementById('airportNextPage');
    var airportCreateForm = document.getElementById('airportCreateForm');
    var airportEditModal = document.getElementById('airportEditModal');
    var airportEditForm = document.getElementById('airportEditForm');
    var airportEditCancel = document.getElementById('airportEditCancel');

    var alertContainer = document.getElementById('alertContainer');
    var adminEmailSpan = document.getElementById('adminEmail');
    var goToProfileBtn = document.getElementById('goToProfileBtn');
    var logoutBtn = document.getElementById('logoutBtn');
    var sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');

    // Dashboard özet kartları
    var dashboardUserTotal = document.getElementById('dashboardUserTotal');
    var dashboardUser24h = document.getElementById('dashboardUser24h');
    var dashboardUser7d = document.getElementById('dashboardUser7d');
    var dashboardReviewTotal = document.getElementById('dashboardReviewTotal');
    var dashboardReview24h = document.getElementById('dashboardReview24h');
    var dashboardReview7d = document.getElementById('dashboardReview7d');
    var dashboardCouponTotal = document.getElementById('dashboardCouponTotal');
    var dashboardCouponActive = document.getElementById('dashboardCouponActive');
    var dashboardCouponUsage = document.getElementById('dashboardCouponUsage');

    // Grafikler
    var userGrowthChart;
    var reviewRatingChart;
    var couponStatusChart;

    // Basit state yönetimi
    var USERS_PER_PAGE = 10;
    var REVIEWS_PER_PAGE = 10;
    var COUPONS_PER_PAGE = 10;
    var AIRPORTS_PER_PAGE = 10;

    var usersData = [];
    var usersPage = 1;

    var reviewsData = [];
    var reviewsPage = 1;

    var couponsData = [];
    var couponsPage = 1;

    var airportsData = [];
    var airportsPage = 1;

    function showAlert(message, type) {
        if (!alertContainer) return;
        var div = document.createElement('div');
        var typeClasses = type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
        div.className = 'px-4 py-3 rounded-2xl text-sm flex items-center justify-between gap-2 border shadow-md';
        div.className += ' ' + typeClasses;
        div.innerHTML = '<span>' + message + '</span><button class="text-xs text-slate-500 hover:text-slate-700">Kapat</button>';
        div.querySelector('button').addEventListener('click', function () { div.remove(); });
        alertContainer.appendChild(div);
        setTimeout(function () { if (div.parentNode) div.remove(); }, 5000);
    }

    function parseDate(value) {
        if (!value) return null;
        var d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }

    function computePeriodStats(items, dateSelector) {
        var now = new Date();
        var dayMs = 24 * 60 * 60 * 1000;
        var oneDayAgo = new Date(now.getTime() - dayMs);
        var sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);
        var fourteenDaysAgo = new Date(now.getTime() - 14 * dayMs);
        var total = items.length;
        var last24 = 0;
        var last7 = 0;
        var prev7 = 0;

        items.forEach(function (item) {
            var dt = dateSelector(item);
            if (!dt) return;
            if (dt >= oneDayAgo) last24++;
            if (dt >= sevenDaysAgo) last7++;
            else if (dt >= fourteenDaysAgo && dt < sevenDaysAgo) prev7++;
        });

        var change7 = null;
        if (prev7 > 0) {
            change7 = ((last7 - prev7) / prev7) * 100;
        }
        return {
            total: total,
            last24: last24,
            last7: last7,
            prev7: prev7,
            change7: change7
        };
    }

    function updateDashboardSummary() {
        if (dashboardUserTotal) {
            var uStats = computePeriodStats(usersData, function (u) { return parseDate(u.created_at); });
            dashboardUserTotal.textContent = uStats.total || 0;
            if (dashboardUser24h) dashboardUser24h.textContent = 'Son 24 saatte ' + (uStats.last24 || 0) + ' yeni';
            if (dashboardUser7d) {
                var label = 'Son 7 gün: ' + (uStats.last7 || 0) + ' yeni';
                if (typeof uStats.change7 === 'number') {
                    var sign = uStats.change7 >= 0 ? '+' : '';
                    label += ' (' + sign + uStats.change7.toFixed(1) + '% vs önceki 7 gün)';
                }
                dashboardUser7d.textContent = label;
            }
        }

        if (dashboardReviewTotal) {
            var rStats = computePeriodStats(reviewsData, function (r) { return parseDate(r.created_at); });
            dashboardReviewTotal.textContent = rStats.total || 0;
            if (dashboardReview24h) dashboardReview24h.textContent = 'Son 24 saatte ' + (rStats.last24 || 0) + ' yeni';
            if (dashboardReview7d) {
                var rLabel = 'Son 7 gün: ' + (rStats.last7 || 0) + ' yeni';
                if (typeof rStats.change7 === 'number') {
                    var rSign = rStats.change7 >= 0 ? '+' : '';
                    rLabel += ' (' + rSign + rStats.change7.toFixed(1) + '% vs önceki 7 gün)';
                }
                dashboardReview7d.textContent = rLabel;
            }
        }

        if (dashboardCouponTotal) {
            var totalCoupons = couponsData.length;
            var activeCoupons = couponsData.filter(function (c) { return !!c.is_active; }).length;
            var usedOrFull = couponsData.filter(function (c) {
                var maxUses = c.max_uses != null ? c.max_uses : 1;
                var useCount = c.use_count != null ? c.use_count : 0;
                return c.is_used || useCount >= maxUses;
            }).length;
            dashboardCouponTotal.textContent = totalCoupons || 0;
            if (dashboardCouponActive) dashboardCouponActive.textContent = 'Aktif kupon: ' + (activeCoupons || 0);
            if (dashboardCouponUsage) {
                var usageRate = totalCoupons > 0 ? (usedOrFull / totalCoupons) * 100 : 0;
                dashboardCouponUsage.textContent = 'Kullanım oranı: ' + usageRate.toFixed(1) + '%';
            }
        }
    }

    function updateCharts() {
        if (!window.Chart) return;

        // Kullanıcı büyüme grafiği (tarihe göre günlük sayım)
        var userCtx = document.getElementById('userGrowthChart');
        if (userCtx) {
            var userBuckets = {};
            usersData.forEach(function (u) {
                var d = parseDate(u.created_at);
                if (!d) return;
                var key = d.toISOString().slice(0, 10);
                userBuckets[key] = (userBuckets[key] || 0) + 1;
            });
            var userLabels = Object.keys(userBuckets).sort();
            var userValues = userLabels.map(function (k) { return userBuckets[k]; });

            if (!userGrowthChart) {
                userGrowthChart = new Chart(userCtx, {
                    type: 'line',
                    data: {
                        labels: userLabels,
                        datasets: [{
                            label: 'Yeni kullanıcı',
                            data: userValues,
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.12)',
                            tension: 0.3,
                            fill: true,
                            pointRadius: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { ticks: { maxTicksLimit: 6 } },
                            y: { beginAtZero: true, ticks: { precision: 0 } }
                        }
                    }
                });
            } else {
                userGrowthChart.data.labels = userLabels;
                userGrowthChart.data.datasets[0].data = userValues;
                userGrowthChart.update();
            }
        }

        // Yorum rating dağılımı
        var reviewCtx = document.getElementById('reviewRatingChart');
        if (reviewCtx) {
            var ratingBuckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            reviewsData.forEach(function (r) {
                var rating = Number(r.rating);
                if (rating >= 1 && rating <= 5) {
                    ratingBuckets[rating] = (ratingBuckets[rating] || 0) + 1;
                }
            });
            var rLabels = ['1', '2', '3', '4', '5'];
            var rValues = rLabels.map(function (k) { return ratingBuckets[Number(k)] || 0; });

            if (!reviewRatingChart) {
                reviewRatingChart = new Chart(reviewCtx, {
                    type: 'bar',
                    data: {
                        labels: rLabels,
                        datasets: [{
                            label: 'Yorum sayısı',
                            data: rValues,
                            backgroundColor: ['#fee2e2', '#fed7aa', '#fef3c7', '#d9f99d', '#bbf7d0'],
                            borderColor: '#94a3b8',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { grid: { display: false } },
                            y: { beginAtZero: true, ticks: { precision: 0 } }
                        }
                    }
                });
            } else {
                reviewRatingChart.data.datasets[0].data = rValues;
                reviewRatingChart.update();
            }
        }

        // Kupon durum dağılımı
        var couponCtx = document.getElementById('couponStatusChart');
        if (couponCtx) {
            var active = 0;
            var inactive = 0;
            var full = 0;
            couponsData.forEach(function (c) {
                var maxUses = c.max_uses != null ? c.max_uses : 1;
                var useCount = c.use_count != null ? c.use_count : 0;
                if (c.is_used || useCount >= maxUses) {
                    full++;
                } else if (c.is_active) {
                    active++;
                } else {
                    inactive++;
                }
            });
            var cLabels = ['Aktif', 'Pasif', 'Kullanım dolu'];
            var cValues = [active, inactive, full];

            if (!couponStatusChart) {
                couponStatusChart = new Chart(couponCtx, {
                    type: 'pie',
                    data: {
                        labels: cLabels,
                        datasets: [{
                            data: cValues,
                            backgroundColor: ['#e0f2fe', '#e5e7eb', '#ede9fe'],
                            borderColor: '#ffffff',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { boxWidth: 10, font: { size: 10 } }
                            }
                        }
                    }
                });
            } else {
                couponStatusChart.data.datasets[0].data = cValues;
                couponStatusChart.update();
            }
        }
    }

    function refreshDashboard() {
        updateDashboardSummary();
        updateCharts();
    }

    function requireTokenOrRedirect() {
        if (!token) {
            (window.NodiaApp && window.NodiaApp.redirectToLogin) ? window.NodiaApp.redirectToLogin('/admin/dashboard') : (window.location.href = '/login?next=' + encodeURIComponent('/admin/dashboard'));
            return false;
        }
        return true;
    }

    function checkAdminAndLoad() {
        if (!requireTokenOrRedirect()) return;
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/me', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (r) {
                if (r.status === 401) {
                    if (window.NodiaApp && window.NodiaApp.setToken) window.NodiaApp.setToken(null);
                    else localStorage.removeItem('access_token');
                    window.location.href = '/login?next=' + encodeURIComponent('/admin/dashboard');
                    return null;
                }
                if (r.status === 403) {
                    window.location.href = '/profile';
                    return null;
                }
                return r.json();
            })
            .then(function (admin) {
                if (!admin) return;
                if (adminEmailSpan) {
                    adminEmailSpan.textContent = admin.email;
                    adminEmailSpan.classList.remove('hidden');
                }
                loadUsers();
                loadReviews();
                loadCoupons();
                loadAirports();
            })
            .catch(function () { showAlert('Admin bilgisi alınamadı. Lütfen tekrar giriş yapın.', 'error'); });
    }

    function getFilteredSortedUsers() {
        var term = userSearchInput ? userSearchInput.value.toLowerCase().trim() : '';
        var role = userRoleFilter ? userRoleFilter.value : 'all';
        var sort = userSortSelect ? userSortSelect.value : 'created_desc';

        var filtered = usersData.slice();
        if (term) {
            filtered = filtered.filter(function (u) {
                var full = ((u.first_name || '') + ' ' + (u.last_name || '') + ' ' + (u.email || '')).toLowerCase();
                return full.indexOf(term) !== -1;
            });
        }
        if (role === 'admin') {
            filtered = filtered.filter(function (u) { return !!u.is_admin; });
        } else if (role === 'user') {
            filtered = filtered.filter(function (u) { return !u.is_admin; });
        }

        filtered.sort(function (a, b) {
            if (sort === 'name_asc' || sort === 'name_desc') {
                var nameA = ((a.first_name || '') + ' ' + (a.last_name || '')).toLowerCase();
                var nameB = ((b.first_name || '') + ' ' + (b.last_name || '')).toLowerCase();
                if (nameA < nameB) return sort === 'name_asc' ? -1 : 1;
                if (nameA > nameB) return sort === 'name_asc' ? 1 : -1;
                return 0;
            }
            // created_at varsayılan
            var da = parseDate(a.created_at);
            var db = parseDate(b.created_at);
            var ta = da ? da.getTime() : 0;
            var tb = db ? db.getTime() : 0;
            if (sort === 'created_asc') return ta - tb;
            return tb - ta; // created_desc
        });

        return filtered;
    }

    function renderUsersTable() {
        if (!usersTableBody) return;

        var filtered = getFilteredSortedUsers();
        var total = filtered.length;

        if (userCountText) {
            userCountText.textContent = total + ' kullanıcı';
        }

        var totalPages = total === 0 ? 1 : Math.ceil(total / USERS_PER_PAGE);
        if (usersPage > totalPages) usersPage = totalPages;
        if (usersPage < 1) usersPage = 1;

        var start = (usersPage - 1) * USERS_PER_PAGE;
        var end = start + USERS_PER_PAGE;
        var pageItems = filtered.slice(start, end);

        usersTableBody.innerHTML = '';

        if (loadingRow) loadingRow.classList.add('hidden');
        if (pageItems.length === 0) {
            if (emptyRow) emptyRow.classList.remove('hidden');
        } else {
            if (emptyRow) emptyRow.classList.add('hidden');

            pageItems.forEach(function (u) {
                var created = u.created_at ? new Date(u.created_at).toLocaleString('tr-TR') : '-';
                var badgeClass = u.is_admin ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200';
                var badgeText = u.is_admin ? 'Admin' : 'Kullanıcı';
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td class="py-3.5 pl-4 pr-3 whitespace-nowrap text-slate-900">' + (u.first_name || '-') + '</td>' +
                    '<td class="px-3 py-3.5 whitespace-nowrap text-slate-900">' + (u.last_name || '-') + '</td>' +
                    '<td class="px-3 py-3.5 whitespace-nowrap text-slate-700">' + u.email + '</td>' +
                    '<td class="px-3 py-3.5 whitespace-nowrap text-slate-500 text-xs">' + created + '</td>' +
                    '<td class="px-3 py-3.5 whitespace-nowrap"><span class="inline-flex items-center rounded-full border ' + badgeClass + ' px-2.5 py-0.5 text-[11px] font-medium">' + badgeText + '</span></td>' +
                    '<td class="py-3.5 pl-3 pr-4 text-right whitespace-nowrap"><button class="text-xs px-3 py-1.5 rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50 delete-user-btn" data-user-id="' + u.id + '">Kullanıcıyı Sil</button></td>';
                usersTableBody.appendChild(tr);
            });

            [].forEach.call(document.querySelectorAll('.delete-user-btn'), function (btn) {
                btn.addEventListener('click', function () {
                    var userId = this.getAttribute('data-user-id');
                    if (!userId || !confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz? İşlem geri alınamaz.')) return;
                    deleteUser(userId);
                });
            });
        }

        var from = total === 0 ? 0 : start + 1;
        var to = total === 0 ? 0 : Math.min(end, total);
        var infoText = 'Kayıtlar ' + from + '–' + to + ' / ' + total;
        if (userPaginationInfo) userPaginationInfo.textContent = infoText;
        if (userPaginationInfoBottom) userPaginationInfoBottom.textContent = infoText;

        if (userPrevPageBtn) userPrevPageBtn.disabled = usersPage <= 1;
        if (userNextPageBtn) userNextPageBtn.disabled = usersPage >= totalPages;
    }

    function loadUsers() {
        if (loadingRow) loadingRow.classList.remove('hidden');
        if (emptyRow) emptyRow.classList.add('hidden');
        if (usersTableBody) usersTableBody.innerHTML = '';
        if (userCountText) userCountText.textContent = 'Kullanıcılar yükleniyor...';

        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (r) {
                if (!r.ok && (r.status === 401 || r.status === 403)) showAlert('Bu sayfaya erişim yetkiniz yok.', 'error');
                else if (!r.ok) showAlert('Kullanıcılar yüklenemedi.', 'error');
                return r.json();
            })
            .then(function (users) {
                if (!users || !Array.isArray(users)) users = [];
                usersData = users;
                usersPage = 1;
                renderUsersTable();
                refreshDashboard();
            })
            .catch(function () {
                if (loadingRow) loadingRow.classList.add('hidden');
                showAlert('Kullanıcılar yüklenirken bir hata oluştu.', 'error');
            });
    }

    function mapStatusBadge(status) {
        var s = (status || '').toLowerCase();
        if (s === 'approved') return { text: 'Onaylı', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        if (s === 'rejected') return { text: 'Reddedilen', classes: 'bg-rose-50 text-rose-700 border-rose-200' };
        return { text: 'Beklemede', classes: 'bg-amber-50 text-amber-700 border-amber-200' };
    }

    function getFilteredPagedReviews() {
        var term = reviewSearchInput ? reviewSearchInput.value.toLowerCase().trim() : '';
        var filtered = reviewsData.slice();
        if (term) {
            filtered = filtered.filter(function (r) {
                var fullName = ((r.user_first_name || '') + ' ' + (r.user_last_name || '') + ' ' + (r.title || '') + ' ' + (r.content || '')).toLowerCase();
                return fullName.indexOf(term) !== -1;
            });
        }
        var total = filtered.length;
        var totalPages = total === 0 ? 1 : Math.ceil(total / REVIEWS_PER_PAGE);
        if (reviewsPage > totalPages) reviewsPage = totalPages;
        if (reviewsPage < 1) reviewsPage = 1;
        var start = (reviewsPage - 1) * REVIEWS_PER_PAGE;
        var end = start + REVIEWS_PER_PAGE;
        var pageItems = filtered.slice(start, end);
        return {
            items: pageItems,
            total: total,
            totalPages: totalPages,
            start: start,
            end: end
        };
    }

    function renderReviewsTable() {
        if (!reviewsTableBody) return;
        reviewsTableBody.innerHTML = '';
        var result = getFilteredPagedReviews();
        var items = result.items;

        if (reviewCountText) reviewCountText.textContent = result.total + ' yorum';

        if (reviewsLoadingRow) reviewsLoadingRow.classList.add('hidden');
        if (items.length === 0) {
            if (reviewsEmptyRow) reviewsEmptyRow.classList.remove('hidden');
        } else {
            if (reviewsEmptyRow) reviewsEmptyRow.classList.add('hidden');
        }

        items.forEach(function (r) {
            var created = r.created_at ? new Date(r.created_at).toLocaleString('tr-TR') : '-';
            var badge = mapStatusBadge(r.status);
            var fullName = ((r.user_first_name || '') + ' ' + (r.user_last_name || '')).trim() || 'İsimsiz kullanıcı';
            var username = r.user_username ? ('@' + r.user_username) : '';
            var title = r.title || '';
            var content = r.content || '';
            var shortContent = content.length > 140 ? content.slice(0, 140) + '…' : content;
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td class="py-3.5 pl-4 pr-3 align-top text-slate-900 text-xs sm:text-sm">#' + r.id + '</td>' +
                '<td class="px-3 py-3.5 align-top text-slate-800 text-xs sm:text-sm">' +
                    '<div class="font-semibold">' + fullName + '</div>' +
                    (username ? '<div class="text-[11px] text-slate-500">' + username + '</div>' : '') +
                '</td>' +
                '<td class="px-3 py-3.5 align-top text-slate-900 text-xs sm:text-sm">' +
                    '<div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">' +
                        '<i class="fas fa-star text-[10px]"></i>' +
                        '<span>' + (r.rating || '-') + '/5</span>' +
                    '</div>' +
                '</td>' +
                '<td class="px-3 py-3.5 align-top text-slate-900 text-xs sm:text-sm max-w-xs">' +
                    (title ? '<div class="font-semibold mb-1">' + title + '</div>' : '') +
                    '<div class="text-[11px] sm:text-xs text-slate-600 leading-snug">' + shortContent + '</div>' +
                '</td>' +
                '<td class="px-3 py-3.5 align-top whitespace-nowrap text-slate-500 text-[11px] sm:text-xs">' + created + '</td>' +
                '<td class="px-3 py-3.5 align-top whitespace-nowrap">' +
                    '<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ' + badge.classes + '">' +
                        badge.text +
                    '</span>' +
                '</td>' +
                '<td class="py-3.5 pl-3 pr-4 align-top text-right whitespace-nowrap space-x-1 sm:space-x-2">' +
                    '<button class="text-[11px] sm:text-xs px-2 sm:px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 approve-review-btn" data-review-id="' + r.id + '">Onayla</button>' +
                    '<button class="text-[11px] sm:text-xs px-2 sm:px-3 py-1.5 rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50 reject-review-btn" data-review-id="' + r.id + '">Reddet</button>' +
                    '<button class="text-[11px] sm:text-xs px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 delete-review-btn" data-review-id="' + r.id + '">Sil</button>' +
                '</td>';
            reviewsTableBody.appendChild(tr);
        });

        [].forEach.call(document.querySelectorAll('.approve-review-btn'), function (btn) {
            btn.addEventListener('click', function () {
                var id = this.getAttribute('data-review-id');
                if (!id) return;
                approveReview(id);
            });
        });
        [].forEach.call(document.querySelectorAll('.reject-review-btn'), function (btn) {
            btn.addEventListener('click', function () {
                var id = this.getAttribute('data-review-id');
                if (!id) return;
                rejectReview(id);
            });
        });
        [].forEach.call(document.querySelectorAll('.delete-review-btn'), function (btn) {
            btn.addEventListener('click', function () {
                var id = this.getAttribute('data-review-id');
                if (!id || !confirm('Bu yorumu kalıcı olmamak üzere gizlemek istediğinizden emin misiniz?')) return;
                softDeleteReview(id);
            });
        });

        if (reviewPrevPageBtn) reviewPrevPageBtn.disabled = reviewsPage <= 1;
        if (reviewNextPageBtn) reviewNextPageBtn.disabled = reviewsPage >= result.totalPages;
    }

    function loadReviews() {
        if (!reviewsTableBody) return;
        if (reviewsLoadingRow) reviewsLoadingRow.classList.remove('hidden');
        if (reviewsEmptyRow) reviewsEmptyRow.classList.add('hidden');
        reviewsTableBody.innerHTML = '';
        if (reviewCountText) reviewCountText.textContent = 'Yorumlar yükleniyor...';

        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        var statusVal = reviewStatusFilter ? reviewStatusFilter.value : 'all';
        var url = '/api/admin/reviews';
        if (statusVal && statusVal !== 'all') {
            url += '?status_filter=' + encodeURIComponent(statusVal);
        }

        fetchFn(url, { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (r) {
                if (!r.ok && (r.status === 401 || r.status === 403)) showAlert('Yorum listesine erişim yetkiniz yok.', 'error');
                else if (!r.ok) showAlert('Yorumlar yüklenemedi.', 'error');
                return r.json();
            })
            .then(function (reviews) {
                if (!reviews || !Array.isArray(reviews)) reviews = [];
                reviewsData = reviews;
                reviewsPage = 1;
                renderReviewsTable();
                refreshDashboard();
            })
            .catch(function () {
                if (reviewsLoadingRow) reviewsLoadingRow.classList.add('hidden');
                showAlert('Yorumlar yüklenirken bir hata oluştu.', 'error');
            });
    }

    function approveReview(reviewId) {
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/reviews/' + encodeURIComponent(reviewId) + '/approve', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (res) {
                if (res.ok) {
                    showAlert('Yorum onaylandı.', 'success');
                    loadReviews();
                } else {
                    var detail = res.data && res.data.detail;
                    showAlert(detail || 'Yorum onaylanamadı.', 'error');
                }
            })
            .catch(function () { showAlert('Onay işlemi sırasında bir hata oluştu.', 'error'); });
    }

    function rejectReview(reviewId) {
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/reviews/' + encodeURIComponent(reviewId) + '/reject', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (res) {
                if (res.ok) {
                    showAlert('Yorum reddedildi.', 'success');
                    loadReviews();
                } else {
                    var detail = res.data && res.data.detail;
                    showAlert(detail || 'Yorum reddedilemedi.', 'error');
                }
            })
            .catch(function () { showAlert('Reddetme işlemi sırasında bir hata oluştu.', 'error'); });
    }

    function softDeleteReview(reviewId) {
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/reviews/' + encodeURIComponent(reviewId), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (res) {
                if (res.ok) {
                    showAlert('Yorum silindi (soft delete).', 'success');
                    loadReviews();
                } else {
                    var detail = res.data && res.data.detail;
                    showAlert(detail || 'Yorum silinemedi.', 'error');
                }
            })
            .catch(function () { showAlert('Silme işlemi sırasında bir hata oluştu.', 'error'); });
    }

    // --- Kuponlar ---
    function loadCoupons() {
        if (!couponsTableBody) return;
        if (couponsLoadingRow) couponsLoadingRow.classList.remove('hidden');
        if (couponsEmptyRow) couponsEmptyRow.classList.add('hidden');
        couponsTableBody.innerHTML = '';
        if (couponCountText) couponCountText.textContent = 'Yükleniyor...';

        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/coupons', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (r) {
                if (!r.ok && (r.status === 401 || r.status === 403)) showAlert('Kupon listesine erişim yetkiniz yok.', 'error');
                else if (!r.ok) showAlert('Kuponlar yüklenemedi.', 'error');
                return r.json();
            })
            .then(function (coupons) {
                if (!coupons || !Array.isArray(coupons)) coupons = [];
                couponsData = coupons;
                couponsPage = 1;
                renderCouponsTable();
                refreshDashboard();
            })
            .catch(function () {
                if (couponsLoadingRow) couponsLoadingRow.classList.add('hidden');
                showAlert('Kuponlar yüklenirken bir hata oluştu.', 'error');
            });
    }

    // --- Havalimanları ---
    function getFilteredPagedAirports() {
        var term = airportSearchInput ? airportSearchInput.value.toLowerCase().trim() : '';
        var region = airportRegionFilter ? airportRegionFilter.value : 'all';
        var type = airportTypeFilter ? airportTypeFilter.value : 'all';
        var sort = airportSortSelect ? airportSortSelect.value : 'city_asc';

        var filtered = airportsData.slice();

        if (term) {
            filtered = filtered.filter(function (a) {
                var text = ((a.name || '') + ' ' + (a.city || '') + ' ' + (a.iata || '') + ' ' + (a.icao || '')).toLowerCase();
                return text.indexOf(term) !== -1;
            });
        }
        if (region && region !== 'all') {
            filtered = filtered.filter(function (a) {
                return (a.region || '').toLowerCase() === region.toLowerCase();
            });
        }
        if (type && type !== 'all') {
            filtered = filtered.filter(function (a) {
                return (a.type || '').toLowerCase() === type.toLowerCase();
            });
        }

        filtered.sort(function (a, b) {
            function cmpStrings(sa, sb) {
                sa = (sa || '').toLowerCase();
                sb = (sb || '').toLowerCase();
                if (sa < sb) return -1;
                if (sa > sb) return 1;
                return 0;
            }
            if (sort === 'city_asc') return cmpStrings(a.city, b.city);
            if (sort === 'city_desc') return -cmpStrings(a.city, b.city);
            if (sort === 'name_asc') return cmpStrings(a.name, b.name);
            if (sort === 'name_desc') return -cmpStrings(a.name, b.name);
            if (sort === 'iata_asc') return cmpStrings(a.iata, b.iata);
            if (sort === 'iata_desc') return -cmpStrings(a.iata, b.iata);
            return 0;
        });

        var total = filtered.length;
        var totalPages = total === 0 ? 1 : Math.ceil(total / AIRPORTS_PER_PAGE);
        if (airportsPage > totalPages) airportsPage = totalPages;
        if (airportsPage < 1) airportsPage = 1;
        var start = (airportsPage - 1) * AIRPORTS_PER_PAGE;
        var end = start + AIRPORTS_PER_PAGE;
        var pageItems = filtered.slice(start, end);
        return {
            items: pageItems,
            total: total,
            totalPages: totalPages,
            start: start,
            end: end
        };
    }

    function renderAirportsTable() {
        if (!airportsTableBody) return;

        var result = getFilteredPagedAirports();
        var items = result.items;
        var total = result.total;

        airportsTableBody.innerHTML = '';

        if (airportsLoadingRow) airportsLoadingRow.classList.add('hidden');

        if (airportCountText) {
            airportCountText.textContent = total + ' havalimanı';
        }

        if (items.length === 0) {
            if (airportsEmptyRow) airportsEmptyRow.classList.remove('hidden');
        } else {
            if (airportsEmptyRow) airportsEmptyRow.classList.add('hidden');
            items.forEach(function (a) {
                var tr = document.createElement('tr');
                var yearText = a.year != null ? a.year : '-';
                tr.innerHTML =
                    '<td class="py-3.5 pl-4 pr-3 whitespace-nowrap text-slate-900 font-medium">' + (a.name || '-') + '</td>' +
                    '<td class="px-3 py-3.5 whitespace-nowrap text-slate-700">' + (a.city || '-') + '</td>' +
                    '<td class="px-3 py-3.5 whitespace-nowrap text-slate-600 text-xs">' + (a.region || '-') + '</td>' +
                    '<td class="px-3 py-3.5 whitespace-nowrap font-mono text-xs text-slate-800">' + (a.iata || '-') + '</td>' +
                    '<td class="px-3 py-3.5 whitespace-nowrap font-mono text-xs text-slate-800">' + (a.icao || '-') + '</td>' +
                    '<td class="px-3 py-3.5 whitespace-nowrap hidden md:table-cell text-slate-600 text-xs">' + (a.type || '-') + '</td>' +
                    '<td class="px-3 py-3.5 whitespace-nowrap hidden lg:table-cell text-slate-600 text-xs">' + yearText + '</td>' +
                    '<td class="py-3.5 pl-3 pr-4 text-right whitespace-nowrap space-x-2">' +
                        '<button class="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 edit-airport-btn" data-id="' + a.id + '">Düzenle</button>' +
                        '<button class="text-xs px-3 py-1.5 rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50 delete-airport-btn" data-id="' + a.id + '" data-name="' + (a.name || '').replace(/"/g, '&quot;') + '">Sil</button>' +
                    '</td>';
                airportsTableBody.appendChild(tr);
            });

            [].forEach.call(document.querySelectorAll('.edit-airport-btn'), function (btn) {
                btn.addEventListener('click', function () {
                    var id = this.getAttribute('data-id');
                    if (!id) return;
                    var airport = airportsData.find(function (a) { return String(a.id) === String(id); });
                    if (!airport) return;
                    document.getElementById('editAirportId').value = airport.id;
                    document.getElementById('editAirportName').value = airport.name || '';
                    document.getElementById('editAirportCity').value = airport.city || '';
                    document.getElementById('editAirportRegion').value = airport.region || '';
                    document.getElementById('editAirportIata').value = airport.iata || '';
                    document.getElementById('editAirportIcao').value = airport.icao || '';
                    document.getElementById('editAirportType').value = airport.type || '';
                    document.getElementById('editAirportYear').value = airport.year != null ? airport.year : '';
                    document.getElementById('editAirportLat').value = airport.lat != null ? airport.lat : '';
                    document.getElementById('editAirportLon').value = airport.lon != null ? airport.lon : '';
                    document.getElementById('editAirportFlights').value = airport.flights || '';
                    if (airportEditModal) {
                        airportEditModal.classList.remove('hidden');
                        airportEditModal.setAttribute('aria-hidden', 'false');
                    }
                });
            });

            [].forEach.call(document.querySelectorAll('.delete-airport-btn'), function (btn) {
                btn.addEventListener('click', function () {
                    var id = this.getAttribute('data-id');
                    var name = this.getAttribute('data-name') || '';
                    if (!id || !confirm('"' + name + '" havalimanını silmek istediğinizden emin misiniz?')) return;
                    deleteAirport(id);
                });
            });
        }

        var from = total === 0 ? 0 : result.start + 1;
        var to = total === 0 ? 0 : Math.min(result.end, total);
        var infoText = 'Kayıtlar ' + from + '–' + to + ' / ' + total;
        if (airportPaginationInfo) airportPaginationInfo.textContent = infoText;
        if (airportPaginationInfoBottom) airportPaginationInfoBottom.textContent = infoText;

        if (airportPrevPageBtn) airportPrevPageBtn.disabled = airportsPage <= 1;
        if (airportNextPageBtn) airportNextPageBtn.disabled = airportsPage >= result.totalPages;
    }

    function loadAirports() {
        if (!airportsTableBody) return;
        if (airportsLoadingRow) airportsLoadingRow.classList.remove('hidden');
        if (airportsEmptyRow) airportsEmptyRow.classList.add('hidden');
        airportsTableBody.innerHTML = '';
        if (airportCountText) airportCountText.textContent = 'Havalimanları yükleniyor...';

        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/airports', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (r) {
                if (!r.ok && (r.status === 401 || r.status === 403)) showAlert('Havalimanı listesine erişim yetkiniz yok.', 'error');
                else if (!r.ok) showAlert('Havalimanları yüklenemedi.', 'error');
                return r.json();
            })
            .then(function (airports) {
                if (!airports || !Array.isArray(airports)) airports = [];
                airportsData = airports;
                airportsPage = 1;
                renderAirportsTable();
            })
            .catch(function () {
                if (airportsLoadingRow) airportsLoadingRow.classList.add('hidden');
                showAlert('Havalimanları yüklenirken bir hata oluştu.', 'error');
            });
    }

    function createAirport(payload) {
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/airports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
        })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (res) {
                if (res.ok) {
                    showAlert('Havalimanı eklendi.', 'success');
                    loadAirports();
                    if (airportCreateForm) airportCreateForm.reset();
                } else {
                    var detail = res.data && (res.data.detail || res.data.message);
                    showAlert(detail || 'Havalimanı eklenemedi.', 'error');
                }
            })
            .catch(function () { showAlert('Havalimanı eklenirken bir hata oluştu.', 'error'); });
    }

    function updateAirport(id, payload) {
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/airports/' + encodeURIComponent(id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
        })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (res) {
                if (res.ok) {
                    showAlert('Havalimanı güncellendi.', 'success');
                    loadAirports();
                    if (airportEditModal) {
                        airportEditModal.classList.add('hidden');
                        airportEditModal.setAttribute('aria-hidden', 'true');
                    }
                } else {
                    var detail = res.data && (res.data.detail || res.data.message);
                    showAlert(detail || 'Havalimanı güncellenemedi.', 'error');
                }
            })
            .catch(function () { showAlert('Havalimanı güncellenirken bir hata oluştu.', 'error'); });
    }

    function deleteAirport(id) {
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/airports/' + encodeURIComponent(id), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (res) {
                if (res.ok) {
                    showAlert('Havalimanı silindi.', 'success');
                    loadAirports();
                } else {
                    var detail = res.data && (res.data.detail || res.data.message);
                    showAlert(detail || 'Havalimanı silinemedi.', 'error');
                }
            })
            .catch(function () { showAlert('Silme işlemi sırasında bir hata oluştu.', 'error'); });
    }

    function getFilteredPagedCoupons() {
        var term = couponSearchInput ? couponSearchInput.value.toLowerCase().trim() : '';
        var statusFilter = couponStatusFilter ? couponStatusFilter.value : 'all';
        var filtered = couponsData.slice();
        if (term) {
            filtered = filtered.filter(function (c) {
                var label = ((c.code || '') + ' ' + (c.airline_name || '')).toLowerCase();
                return label.indexOf(term) !== -1;
            });
        }

        filtered = filtered.filter(function (c) {
            var maxUses = c.max_uses != null ? c.max_uses : 1;
            var useCount = c.use_count != null ? c.use_count : 0;
            var isFull = c.is_used || useCount >= maxUses;
            if (statusFilter === 'active') return c.is_active && !isFull;
            if (statusFilter === 'inactive') return !c.is_active && !isFull;
            if (statusFilter === 'full') return isFull;
            return true;
        });

        var total = filtered.length;
        var totalPages = total === 0 ? 1 : Math.ceil(total / COUPONS_PER_PAGE);
        if (couponsPage > totalPages) couponsPage = totalPages;
        if (couponsPage < 1) couponsPage = 1;
        var start = (couponsPage - 1) * COUPONS_PER_PAGE;
        var end = start + COUPONS_PER_PAGE;
        var pageItems = filtered.slice(start, end);
        return {
            items: pageItems,
            total: total,
            totalPages: totalPages
        };
    }

    function renderCouponsTable() {
        if (!couponsTableBody) return;
        couponsTableBody.innerHTML = '';

        var result = getFilteredPagedCoupons();
        var coupons = result.items;

        if (couponsLoadingRow) couponsLoadingRow.classList.add('hidden');

        if (!coupons || coupons.length === 0) {
            if (couponsEmptyRow) couponsEmptyRow.classList.remove('hidden');
            if (couponCountText) couponCountText.textContent = '0 kupon';
            return;
        }
        if (couponsEmptyRow) couponsEmptyRow.classList.add('hidden');
        if (couponCountText) couponCountText.textContent = result.total + ' kupon';

        coupons.forEach(function (c) {
            var expiry = c.expiry_date ? new Date(c.expiry_date).toLocaleDateString('tr-TR') : '-';
            var refund = c.refund_amount != null ? (Number(c.refund_amount).toFixed(2) + ' TL') : '-';
            var maxUses = c.max_uses != null ? c.max_uses : 1;
            var useCount = c.use_count != null ? c.use_count : 0;
            var usageText = useCount + ' / ' + maxUses;
            var statusBadges = [];
            if (c.is_used || useCount >= maxUses) {
                statusBadges.push('<span class="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 text-slate-600 px-2.5 py-0.5 text-[11px] font-medium">Kullanım doldu</span>');
            } else if (c.is_active) {
                statusBadges.push('<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[11px] font-medium">Aktif</span>');
            } else {
                statusBadges.push('<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[11px] font-medium">Pasif</span>');
            }
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td class="py-3.5 pl-4 pr-3 whitespace-nowrap font-medium text-slate-900">' + (c.code || '-') + '</td>' +
                '<td class="px-3 py-3.5 whitespace-nowrap text-slate-700">' + (c.airline_name || '-') + '</td>' +
                '<td class="px-3 py-3.5 whitespace-nowrap text-slate-700">' + refund + '</td>' +
                '<td class="px-3 py-3.5 whitespace-nowrap text-slate-600 text-xs">' + usageText + '</td>' +
                '<td class="px-3 py-3.5 whitespace-nowrap text-slate-500 text-xs">' + expiry + '</td>' +
                '<td class="px-3 py-3.5 whitespace-nowrap">' + statusBadges.join(' ') + '</td>' +
                '<td class="py-3.5 pl-3 pr-4 text-right whitespace-nowrap space-x-2">' +
                    '<button class="text-xs px-3 py-1.5 rounded-full border border-violet-200 text-violet-700 hover:bg-violet-50 edit-coupon-btn" data-coupon-id="' + c.id + '" data-code="' + (c.code || '').replace(/"/g, '&quot;') + '" data-airline="' + (c.airline_name || '').replace(/"/g, '&quot;') + '" data-refund="' + (c.refund_amount != null ? c.refund_amount : '') + '" data-expiry="' + (c.expiry_date || '') + '" data-max-uses="' + maxUses + '" data-active="' + (c.is_active ? '1' : '0') + '">Düzenle</button>' +
                    '<button class="text-xs px-3 py-1.5 rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50 delete-coupon-btn" data-coupon-id="' + c.id + '" data-code="' + (c.code || '').replace(/"/g, '&quot;') + '">Sil</button>' +
                '</td>';
            couponsTableBody.appendChild(tr);
        });

        [].forEach.call(document.querySelectorAll('.edit-coupon-btn'), function (btn) {
            btn.addEventListener('click', function () {
                var id = this.getAttribute('data-coupon-id');
                var code = this.getAttribute('data-code');
                var airline = this.getAttribute('data-airline');
                var refund = this.getAttribute('data-refund');
                var expiry = this.getAttribute('data-expiry');
                var maxUses = this.getAttribute('data-max-uses') || '1';
                var active = this.getAttribute('data-active') === '1';
                if (!id) return;
                document.getElementById('editCouponId').value = id;
                document.getElementById('editCouponCode').value = code || '';
                document.getElementById('editCouponAirline').value = airline || '';
                document.getElementById('editCouponRefund').value = refund || '';
                document.getElementById('editCouponExpiry').value = expiry || '';
                var editMaxEl = document.getElementById('editCouponMaxUses');
                if (editMaxEl) editMaxEl.value = maxUses;
                document.getElementById('editCouponActive').checked = active;
                if (couponEditModal) {
                    couponEditModal.classList.remove('hidden');
                    couponEditModal.setAttribute('aria-hidden', 'false');
                }
            });
        });
        [].forEach.call(document.querySelectorAll('.delete-coupon-btn'), function (btn) {
            btn.addEventListener('click', function () {
                var id = this.getAttribute('data-coupon-id');
                var code = this.getAttribute('data-code');
                if (!id || !confirm('"' + (code || id) + '" kuponunu silmek (soft delete) istediğinizden emin misiniz?')) return;
                deleteCoupon(id);
            });
        });
    }

    function createCoupon(payload) {
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/coupons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
        })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (res) {
                if (res.ok) {
                    showAlert('Kupon eklendi.', 'success');
                    loadCoupons();
                    if (couponCreateForm) couponCreateForm.reset();
                } else {
                    var detail = res.data && (res.data.detail || res.data.message);
                    showAlert(detail || 'Kupon eklenemedi.', 'error');
                }
            })
            .catch(function () { showAlert('Kupon eklenirken bir hata oluştu.', 'error'); });
    }

    function updateCoupon(id, payload) {
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/coupons/' + encodeURIComponent(id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
        })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (res) {
                if (res.ok) {
                    showAlert('Kupon güncellendi.', 'success');
                    loadCoupons();
                    if (couponEditModal) {
                        couponEditModal.classList.add('hidden');
                        couponEditModal.setAttribute('aria-hidden', 'true');
                    }
                } else {
                    var detail = res.data && (res.data.detail || res.data.message);
                    showAlert(detail || 'Kupon güncellenemedi.', 'error');
                }
            })
            .catch(function () { showAlert('Kupon güncellenirken bir hata oluştu.', 'error'); });
    }

    function deleteCoupon(id) {
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/coupons/' + encodeURIComponent(id), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (res) {
                if (res.ok) {
                    showAlert('Kupon silindi (soft delete).', 'success');
                    loadCoupons();
                } else {
                    var detail = res.data && (res.data.detail || res.data.message);
                    showAlert(detail || 'Kupon silinemedi.', 'error');
                }
            })
            .catch(function () { showAlert('Silme işlemi sırasında bir hata oluştu.', 'error'); });
    }

    if (couponCreateForm) {
        couponCreateForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var codeEl = document.getElementById('newCouponCode');
            var refundEl = document.getElementById('newCouponRefund');
            var expiryEl = document.getElementById('newCouponExpiry');
            var code = (codeEl && codeEl.value || '').trim().toUpperCase();
            var refund = refundEl ? parseFloat(refundEl.value) : NaN;
            var expiry = expiryEl ? expiryEl.value : '';
            if (!code) { showAlert('Kupon kodu gerekli.', 'error'); return; }
            if (isNaN(refund) || refund < 0) { showAlert('Geçerli bir indirim tutarı girin.', 'error'); return; }
            if (!expiry) { showAlert('Son kullanım tarihi gerekli.', 'error'); return; }
            var maxUsesEl = document.getElementById('newCouponMaxUses');
            var maxUses = maxUsesEl ? parseInt(maxUsesEl.value, 10) : 1;
            if (isNaN(maxUses) || maxUses < 1) maxUses = 1;
            var payload = {
                code: code,
                airline_name: (document.getElementById('newCouponAirline') && document.getElementById('newCouponAirline').value.trim()) || null,
                refund_amount: refund,
                expiry_date: expiry,
                max_uses: maxUses,
                is_active: true
            };
            var origEl = document.getElementById('newCouponOriginal');
            var issueEl = document.getElementById('newCouponIssue');
            var reasonEl = document.getElementById('newCouponCancelReason');
            var activeEl = document.getElementById('newCouponActive');
            if (couponCreateExtra && !couponCreateExtra.classList.contains('hidden')) {
                if (origEl && origEl.value) payload.original_amount = parseFloat(origEl.value);
                if (issueEl && issueEl.value) payload.issue_date = issueEl.value;
                if (reasonEl && reasonEl.value) payload.cancel_reason = reasonEl.value.trim();
                if (activeEl) payload.is_active = activeEl.checked;
            }
            createCoupon(payload);
        });
    }
    if (couponCreateMore) {
        couponCreateMore.addEventListener('click', function () {
            if (couponCreateExtra) {
                couponCreateExtra.classList.remove('hidden');
                couponCreateMore.classList.add('hidden');
            }
        });
    }
    if (couponEditForm) {
        couponEditForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var id = document.getElementById('editCouponId').value;
            if (!id) return;
            var airline = (document.getElementById('editCouponAirline') && document.getElementById('editCouponAirline').value || '').trim();
            var refund = document.getElementById('editCouponRefund').value;
            var expiry = document.getElementById('editCouponExpiry').value;
            var maxUsesEl = document.getElementById('editCouponMaxUses');
            var maxUses = maxUsesEl ? parseInt(maxUsesEl.value, 10) : null;
            if (maxUses !== null && (isNaN(maxUses) || maxUses < 1)) maxUses = 1;
            var active = document.getElementById('editCouponActive').checked;
            var payload = {
                airline_name: airline || null,
                refund_amount: refund !== '' ? parseFloat(refund) : null,
                expiry_date: expiry || null,
                max_uses: maxUses,
                is_active: active
            };
            updateCoupon(id, payload);
        });
    }
    if (couponEditCancel) {
        couponEditCancel.addEventListener('click', function () {
            if (couponEditModal) {
                couponEditModal.classList.add('hidden');
                couponEditModal.setAttribute('aria-hidden', 'true');
            }
        });
    }
    if (couponEditModal) {
        couponEditModal.addEventListener('click', function (e) {
            if (e.target === couponEditModal) {
                couponEditModal.classList.add('hidden');
                couponEditModal.setAttribute('aria-hidden', 'true');
            }
        });
    }

    if (airportCreateForm) {
        airportCreateForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = (document.getElementById('newAirportName').value || '').trim();
            var city = (document.getElementById('newAirportCity').value || '').trim();
            var region = (document.getElementById('newAirportRegion').value || '').trim();
            var iata = (document.getElementById('newAirportIata').value || '').trim().toUpperCase();
            var icao = (document.getElementById('newAirportIcao').value || '').trim().toUpperCase();
            var type = (document.getElementById('newAirportType').value || '').trim();
            var yearVal = document.getElementById('newAirportYear').value;
            var latVal = document.getElementById('newAirportLat').value;
            var lonVal = document.getElementById('newAirportLon').value;
            var flights = (document.getElementById('newAirportFlights').value || '').trim();

            if (!name || !city || !iata || !icao) {
                showAlert('İsim, şehir, IATA ve ICAO alanları zorunludur.', 'error');
                return;
            }

            var year = yearVal !== '' ? parseInt(yearVal, 10) : null;
            if (yearVal !== '' && (isNaN(year) || year < 1900 || year > 2100)) {
                showAlert('Geçerli bir açılış yılı girin.', 'error');
                return;
            }
            var lat = latVal !== '' ? parseFloat(latVal) : null;
            var lon = lonVal !== '' ? parseFloat(lonVal) : null;

            var payload = {
                name: name,
                city: city,
                region: region || null,
                iata: iata,
                icao: icao,
                type: type || null,
                year: year,
                lat: lat,
                lon: lon,
                flights: flights || null
            };
            createAirport(payload);
        });
    }

    if (airportEditForm) {
        airportEditForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var id = document.getElementById('editAirportId').value;
            if (!id) return;
            var name = (document.getElementById('editAirportName').value || '').trim();
            var city = (document.getElementById('editAirportCity').value || '').trim();
            var region = (document.getElementById('editAirportRegion').value || '').trim();
            var iata = (document.getElementById('editAirportIata').value || '').trim().toUpperCase();
            var icao = (document.getElementById('editAirportIcao').value || '').trim().toUpperCase();
            var type = (document.getElementById('editAirportType').value || '').trim();
            var yearVal = document.getElementById('editAirportYear').value;
            var latVal = document.getElementById('editAirportLat').value;
            var lonVal = document.getElementById('editAirportLon').value;
            var flights = (document.getElementById('editAirportFlights').value || '').trim();

            if (!name || !city || !iata || !icao) {
                showAlert('İsim, şehir, IATA ve ICAO alanları zorunludur.', 'error');
                return;
            }

            var year = yearVal !== '' ? parseInt(yearVal, 10) : null;
            if (yearVal !== '' && (isNaN(year) || year < 1900 || year > 2100)) {
                showAlert('Geçerli bir açılış yılı girin.', 'error');
                return;
            }
            var lat = latVal !== '' ? parseFloat(latVal) : null;
            var lon = lonVal !== '' ? parseFloat(lonVal) : null;

            var payload = {
                name: name,
                city: city,
                region: region || null,
                iata: iata,
                icao: icao,
                type: type || null,
                year: year,
                lat: lat,
                lon: lon,
                flights: flights || null
            };
            updateAirport(id, payload);
        });
    }
    if (airportEditCancel) {
        airportEditCancel.addEventListener('click', function () {
            if (airportEditModal) {
                airportEditModal.classList.add('hidden');
                airportEditModal.setAttribute('aria-hidden', 'true');
            }
        });
    }
    if (airportEditModal) {
        airportEditModal.addEventListener('click', function (e) {
            if (e.target === airportEditModal) {
                airportEditModal.classList.add('hidden');
                airportEditModal.setAttribute('aria-hidden', 'true');
            }
        });
    }

    function deleteUser(userId) {
        var fetchFn = window.NodiaApp && window.NodiaApp.fetchWithAuth ? window.NodiaApp.fetchWithAuth : function (url, opts) { return fetch(apiBase + url, opts); };
        fetchFn('/api/admin/users/' + encodeURIComponent(userId), { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (res) {
                if (res.ok && res.data && res.data.success) {
                    showAlert('Kullanıcı başarıyla silindi.', 'success');
                    loadUsers();
                } else {
                    var detail = res.data && (res.data.detail || res.data.message);
                    if (res.status === 400 && detail) showAlert(detail, 'error');
                    else if (res.status === 403) showAlert('Bu işlemi yapma yetkiniz yok.', 'error');
                    else showAlert(detail || 'Kullanıcı silinemedi.', 'error');
                }
            })
            .catch(function () { showAlert('Silme işlemi sırasında bir hata oluştu.', 'error'); });
    }

    function performLogout() {
        if (window.NodiaApp && window.NodiaApp.logout) {
            window.NodiaApp.logout();
        } else {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
        }
    }

    if (goToProfileBtn) goToProfileBtn.addEventListener('click', function () { window.location.href = '/profile'; });
    if (logoutBtn) logoutBtn.addEventListener('click', performLogout);
    if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', performLogout);

    if (reviewStatusFilter) {
        reviewStatusFilter.addEventListener('change', function () {
            loadReviews();
        });
    }
    if (reviewSearchInput) {
        reviewSearchInput.addEventListener('input', function () {
            reviewsPage = 1;
            renderReviewsTable();
        });
    }
    if (reviewPrevPageBtn) {
        reviewPrevPageBtn.addEventListener('click', function () {
            if (reviewsPage > 1) {
                reviewsPage--;
                renderReviewsTable();
            }
        });
    }
    if (reviewNextPageBtn) {
        reviewNextPageBtn.addEventListener('click', function () {
            reviewsPage++;
            renderReviewsTable();
        });
    }

    if (userSearchInput) {
        userSearchInput.addEventListener('input', function () {
            usersPage = 1;
            renderUsersTable();
        });
    }
    if (userRoleFilter) {
        userRoleFilter.addEventListener('change', function () {
            usersPage = 1;
            renderUsersTable();
        });
    }
    if (userSortSelect) {
        userSortSelect.addEventListener('change', function () {
            usersPage = 1;
            renderUsersTable();
        });
    }
    if (userPrevPageBtn) {
        userPrevPageBtn.addEventListener('click', function () {
            if (usersPage > 1) {
                usersPage--;
                renderUsersTable();
            }
        });
    }
    if (userNextPageBtn) {
        userNextPageBtn.addEventListener('click', function () {
            usersPage++;
            renderUsersTable();
        });
    }

    if (couponSearchInput) {
        couponSearchInput.addEventListener('input', function () {
            couponsPage = 1;
            renderCouponsTable();
        });
    }
    if (couponStatusFilter) {
        couponStatusFilter.addEventListener('change', function () {
            couponsPage = 1;
            renderCouponsTable();
        });
    }

    if (airportSearchInput) {
        airportSearchInput.addEventListener('input', function () {
            airportsPage = 1;
            renderAirportsTable();
        });
    }
    if (airportRegionFilter) {
        airportRegionFilter.addEventListener('change', function () {
            airportsPage = 1;
            renderAirportsTable();
        });
    }
    if (airportTypeFilter) {
        airportTypeFilter.addEventListener('change', function () {
            airportsPage = 1;
            renderAirportsTable();
        });
    }
    if (airportSortSelect) {
        airportSortSelect.addEventListener('change', function () {
            airportsPage = 1;
            renderAirportsTable();
        });
    }
    if (airportPrevPageBtn) {
        airportPrevPageBtn.addEventListener('click', function () {
            if (airportsPage > 1) {
                airportsPage--;
                renderAirportsTable();
            }
        });
    }
    if (airportNextPageBtn) {
        airportNextPageBtn.addEventListener('click', function () {
            airportsPage++;
            renderAirportsTable();
        });
    }

    // Sidebar aç/kapat (sayfalar arası geçiş normal linklerle yapılır)
    var adminSidebar = document.getElementById('adminSidebar');
    var sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    var sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

    if (sidebarToggleBtn && adminSidebar) {
        sidebarToggleBtn.addEventListener('click', function () {
            adminSidebar.classList.toggle('-translate-x-full');
        });
    }
    if (sidebarCloseBtn && adminSidebar) {
        sidebarCloseBtn.addEventListener('click', function () {
            adminSidebar.classList.add('-translate-x-full');
        });
    }

    checkAdminAndLoad();
})();
