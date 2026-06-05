/**
 * Havayolu Yorumları – Dataset bazlı analiz için kopya JS.
 * Şu an birebir airline-reviews.js mantığını kullanır; farklı bir veri kaynağı için
 * bu dosyayı özgürce düzenleyebilirsin.
 */
// Dataset sayfası için basit "boş veri" başlangıcı.
// API çağrısı yapmaz; tüm alanları boş/0 olarak doldurur ve
// "yükleniyor" ekranından çıkıp içeriği gösterir.

(function () {
    'use strict';

    var loadingEl = document.getElementById('loading-state');
    var emptyEl = document.getElementById('empty-state');
    var contentEl = document.getElementById('content-area');
    var sectionsContainer = document.getElementById('airline-sections');
    var airlineSelect = document.getElementById('airline-select');
    var resultsCountEl = document.getElementById('results-count');

    function showContent() {
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
        if (contentEl) contentEl.style.display = 'block';
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function initEmptyState() {
        // Yükleniyor ekranını kapat, içerik alanını aç.
        showContent();

        // Dropdown boş, sonuç sayacı 0.
        if (airlineSelect) {
            airlineSelect.innerHTML = '<option value="">Tüm Havayolları</option>';
        }
        if (resultsCountEl) {
            resultsCountEl.textContent = '0 yorum';
        }
        if (sectionsContainer) {
            sectionsContainer.innerHTML = '';
        }

        // Genel istatistikler 0.
        setText('stat-total', '0');
        setText('stat-positive', '0');
        setText('stat-negative', '0');
        setText('stat-neutral', '0');
        setText('stat-positive-pct', '0%');
        setText('stat-negative-pct', '0%');
        setText('stat-neutral-pct', '0%');
        setText('stat-rating', '0.0');
        var starsEl = document.getElementById('stat-stars');
        if (starsEl) {
            starsEl.innerHTML = '';
        }

        // Özet listeleri boş mesajı ile doldur.
        var summaryIds = [
            'summary-complaints-list',
            'summary-liked-list',
            'all-summary-complaints-list',
            'all-summary-liked-list',
            'score-distribution-list',
            'summary-recommendations-list',
            'route-satisfaction-list',
        ];
        summaryIds.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
            }
        });

        // Yorum sekmeleri boş.
        var sentimentLists = [
            'sentiment-list-positive',
            'sentiment-list-neutral',
            'sentiment-list-negative',
        ];
        sentimentLists.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<p class="sentiment-tab-list-empty">Bu kategoride henüz yorum yok.</p>';
            }
        });

        setText('sentiment-page-info-positive', '');
        setText('sentiment-page-info-neutral', '');
        setText('sentiment-page-info-negative', '');

        ['positive', 'neutral', 'negative'].forEach(function (key) {
            var prevBtn = document.getElementById('sentiment-page-prev-' + key);
            var nextBtn = document.getElementById('sentiment-page-next-' + key);
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
        });

        // Duygu merkez metni 0.
        var centerText = document.getElementById('sentiment-center-text');
        if (centerText) {
            var valueEl = centerText.querySelector('.sentiment-center-value');
            var labelEl = centerText.querySelector('.sentiment-center-label');
            if (valueEl) valueEl.textContent = '0';
            if (labelEl) labelEl.textContent = 'Toplam';
        }

        // Yolcu sadakati yüzdesi 0.
        setText('route-repeat-percent', '%0');
        var repeatTextEl = document.getElementById('route-repeat-text');
        if (repeatTextEl) {
            repeatTextEl.textContent = 'Yeterli veri bulunmuyor.';
        }

        // Başlangıçta global görünüm + demo veriler
        mockGlobalAirlines();

        // Ardından, test için "rastgele" bir havayolu seçilmiş gibi
        // spesifik-havayolu bileşenlerini de doldur.
        mockSelectedAirline();

        // Dropdown değiştiğinde global / spesifik görünüm arasında geçiş yap.
        if (airlineSelect && !airlineSelect.__datasetBound) {
            airlineSelect.__datasetBound = true;
            airlineSelect.addEventListener('change', function () {
                var val = airlineSelect.value || '';
                if (!val) {
                    // Tüm havayolları seçildi → global demo görünüm
                    mockGlobalAirlines();
                } else {
                    // Herhangi bir havayolu seçildi → sahte "Demo" verisi ile spesifik görünüm
                    mockSelectedAirline();
                }
            });
        }
    }

    function mockGlobalAirlines() {
        if (emptyEl) emptyEl.style.display = 'flex';
        if (sectionsContainer) sectionsContainer.innerHTML = '';
        if (resultsCountEl) resultsCountEl.textContent = '12 yorum';

        var overviewSection = document.getElementById('airline-overview-section');
        var comparisonSection = document.getElementById('multi-airline-comparison-section');
        var allSummarySection = document.getElementById('all-airlines-summary-section');
        var generalStatsSection = document.getElementById('general-stats-section');
        var sentimentChartSection = document.getElementById('sentiment-chart-section');
        var singleSummarySection = document.getElementById('analysis-summary-section');
        var routeSection = document.querySelector('.route-satisfaction-section');

        if (overviewSection) overviewSection.style.display = 'block';
        if (comparisonSection) comparisonSection.style.display = 'block';
        if (allSummarySection) allSummarySection.style.display = 'block';
        if (generalStatsSection) generalStatsSection.style.display = 'none';
        if (sentimentChartSection) sentimentChartSection.style.display = 'none';
        if (singleSummarySection) singleSummarySection.style.display = 'none';
        if (routeSection) routeSection.style.display = 'none';

        // Havayolu özet kartları için örnek veriler
        var grid = document.getElementById('airline-overview-grid');
        if (grid) {
            grid.innerHTML = ''
                + '<article class="airline-overview-card">'
                +   '<div class="airline-overview-header">'
                +     '<div class="airline-overview-title">'
                +       '<div class="airline-overview-avatar">TA</div>'
                +       '<div>'
                +         '<div class="airline-overview-name">Test Air</div>'
                +         '<div class="airline-overview-rating"><i class="fas fa-star"></i> 4.3 / 5.0</div>'
                +       '</div>'
                +     '</div>'
                +   '</div>'
                +   '<div class="airline-overview-main">'
                +     '<div>'
                +       '<div class="airline-overview-total">'
                +         '<span class="airline-overview-total-label">Toplam Yorumlar</span>'
                +         '<span class="airline-overview-total-value">7</span>'
                +       '</div>'
                +       '<div class="airline-overview-breakdown">'
                +         '<div class="airline-overview-breakdown-label"><span class="airline-overview-dot positive"></span> Olumlu</div>'
                +         '<div class="airline-overview-breakdown-value">4</div>'
                +         '<div class="airline-overview-breakdown-label"><span class="airline-overview-dot neutral"></span> Nötr</div>'
                +         '<div class="airline-overview-breakdown-value">2</div>'
                +         '<div class="airline-overview-breakdown-label"><span class="airline-overview-dot negative"></span> Olumsuz</div>'
                +         '<div class="airline-overview-breakdown-value">1</div>'
                +       '</div>'
                +     '</div>'
                +     '<div class="airline-overview-ring-wrapper">'
                +       '<div class="airline-overview-ring">'
                +         '<div class="airline-overview-ring-fill" style="background: conic-gradient(#22c55e 0 57%, #eab308 57% 86%, #ef4444 86% 100%);"></div>'
                +         '<span class="airline-overview-ring-center">%57</span>'
                +       '</div>'
                +     '</div>'
                +   '</div>'
                + '</article>'
                + '<article class="airline-overview-card">'
                +   '<div class="airline-overview-header">'
                +     '<div class="airline-overview-title">'
                +       '<div class="airline-overview-avatar">DA</div>'
                +       '<div>'
                +         '<div class="airline-overview-name">Demo Airlines</div>'
                +         '<div class="airline-overview-rating"><i class="fas fa-star"></i> 4.0 / 5.0</div>'
                +       '</div>'
                +     '</div>'
                +   '</div>'
                +   '<div class="airline-overview-main">'
                +     '<div>'
                +       '<div class="airline-overview-total">'
                +         '<span class="airline-overview-total-label">Toplam Yorumlar</span>'
                +         '<span class="airline-overview-total-value">5</span>'
                +       '</div>'
                +       '<div class="airline-overview-breakdown">'
                +         '<div class="airline-overview-breakdown-label"><span class="airline-overview-dot positive"></span> Olumlu</div>'
                +         '<div class="airline-overview-breakdown-value">3</div>'
                +         '<div class="airline-overview-breakdown-label"><span class="airline-overview-dot neutral"></span> Nötr</div>'
                +         '<div class="airline-overview-breakdown-value">1</div>'
                +         '<div class="airline-overview-breakdown-label"><span class="airline-overview-dot negative"></span> Olumsuz</div>'
                +         '<div class="airline-overview-breakdown-value">1</div>'
                +       '</div>'
                +     '</div>'
                +     '<div class="airline-overview-ring-wrapper">'
                +       '<div class="airline-overview-ring">'
                +         '<div class="airline-overview-ring-fill" style="background: conic-gradient(#22c55e 0 60%, #eab308 60% 80%, #ef4444 80% 100%);"></div>'
                +         '<span class="airline-overview-ring-center">%60</span>'
                +       '</div>'
                +     '</div>'
                +   '</div>'
                + '</article>';
        }

        // Çoklu havayolu sentiment listesi için demo
        var sentimentList = document.getElementById('multi-airline-sentiment-list');
        if (sentimentList) {
            sentimentList.innerHTML =
                '<div class="multi-airline-sentiment-row">' +
                    '<div class="multi-airline-sentiment-name">Test Air</div>' +
                    '<div class="multi-airline-sentiment-bar">' +
                        '<div class="multi-airline-sentiment-segment positive" style="width:57%;"></div>' +
                        '<div class="multi-airline-sentiment-segment neutral" style="width:29%;"></div>' +
                        '<div class="multi-airline-sentiment-segment negative" style="width:14%;"></div>' +
                    '</div>' +
                    '<div class="multi-airline-sentiment-value">7</div>' +
                '</div>' +
                '<div class="multi-airline-sentiment-row">' +
                    '<div class="multi-airline-sentiment-name">Demo Airlines</div>' +
                    '<div class="multi-airline-sentiment-bar">' +
                        '<div class="multi-airline-sentiment-segment positive" style="width:60%;"></div>' +
                        '<div class="multi-airline-sentiment-segment neutral" style="width:20%;"></div>' +
                        '<div class="multi-airline-sentiment-segment negative" style="width:20%;"></div>' +
                    '</div>' +
                    '<div class="multi-airline-sentiment-value">5</div>' +
                '</div>';
        }

        // Çoklu hacim trend grafiği demo
        if (typeof Chart !== 'undefined') {
            var trendCanvas = document.getElementById('multi-airline-volume-trend');
            if (trendCanvas) {
                var ctx = trendCanvas.getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Kas', 'Ara', 'Oca', 'Şub', 'Mar', 'Nis'],
                        datasets: [
                            { label: 'Test Air', data: [1, 2, 1, 1, 1, 1], borderColor: '#ef4444', backgroundColor: 'transparent', tension: 0.3 },
                            { label: 'Demo Airlines', data: [0, 1, 1, 1, 1, 1], borderColor: '#06b6d4', backgroundColor: 'transparent', tension: 0.3 }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: true } },
                        scales: {
                            y: { beginAtZero: true, ticks: { stepSize: 1 } },
                            x: { grid: { display: false } }
                        }
                    }
                });
            }
        }

        // Tüm havayolları yapay zeka özeti için demo metinler
        var allComplaints = document.getElementById('all-summary-complaints-list');
        var allLiked = document.getElementById('all-summary-liked-list');
        if (allComplaints) {
            allComplaints.innerHTML =
                '<div class="summary-item"><i class="fas fa-exclamation-circle"></i><div><div class="summary-item-title">Genel Gecikmeler</div><div class="summary-item-desc">Birçok havayolunda kalkış saatlerinde gecikmeler yaşanıyor.</div></div></div>';
        }
        if (allLiked) {
            allLiked.innerHTML =
                '<div class="summary-item"><i class="fas fa-check-circle"></i><div><div class="summary-item-title">Uygun Fiyatlar</div><div class="summary-item-desc">Yolcular, kampanya dönemlerindeki fiyatlardan genel olarak memnun.</div></div></div>';
        }
    }

    function mockSelectedAirline() {
        // Boş / global state'i gizle
        if (emptyEl) emptyEl.style.display = 'none';

        // Dropdown'da sahte bir havayolu seç
        if (airlineSelect) {
            airlineSelect.innerHTML =
                '<option value="">Tüm Havayolları</option>' +
                '<option value="Demo Airlines" selected>Demo Airlines</option>';
        }
        if (resultsCountEl) {
            resultsCountEl.textContent = '5 yorum';
        }
        if (sectionsContainer) {
            sectionsContainer.innerHTML = '<section class="airline-section"><div class="airline-section-header"><h2 class="airline-section-title"><i class="fas fa-plane"></i> Demo Airlines</h2><span class="airline-section-count">5 yorum</span></div><div class="airline-reviews-list"><p class="analysis-list-empty">Bu alan test amaçlıdır. Gerçek yorumlar API bağlandığında gösterilecek.</p></div></section>';
        }

        // Global özetleri gizle, seçili-havayolu bloklarını aç
        var overviewSection = document.getElementById('airline-overview-section');
        var comparisonSection = document.getElementById('multi-airline-comparison-section');
        var allSummarySection = document.getElementById('all-airlines-summary-section');
        var generalStatsSection = document.getElementById('general-stats-section');
        var sentimentChartSection = document.getElementById('sentiment-chart-section');
        var singleSummarySection = document.getElementById('analysis-summary-section');
        var routeSection = document.querySelector('.route-satisfaction-section');

        if (overviewSection) overviewSection.style.display = 'none';
        if (comparisonSection) comparisonSection.style.display = 'none';
        if (allSummarySection) allSummarySection.style.display = 'none';

        if (generalStatsSection) generalStatsSection.style.display = 'block';
        if (sentimentChartSection) sentimentChartSection.style.display = 'block';
        if (singleSummarySection) singleSummarySection.style.display = 'block';
        if (routeSection) routeSection.style.display = 'block';

        // Basit örnek istatistikler
        setText('stat-total', '5');
        setText('stat-positive', '3');
        setText('stat-negative', '1');
        setText('stat-neutral', '1');
        setText('stat-positive-pct', '60%');
        setText('stat-negative-pct', '20%');
        setText('stat-neutral-pct', '20%');
        setText('stat-rating', '4.2');
        var starsEl = document.getElementById('stat-stars');
        if (starsEl) {
            starsEl.innerHTML = '<i class="fas fa-star stat-star stat-star-filled"></i>'.repeat(4) +
                '<i class="far fa-star stat-star stat-star-empty"></i>';
        }

        // Duygu donut grafiği (varsa)
        if (typeof Chart !== 'undefined') {
            var donutCanvas = document.getElementById('sentiment-chart');
            if (donutCanvas) {
                var ctx = donutCanvas.getContext('2d');
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Pozitif', 'Negatif', 'Nötr'],
                        datasets: [{
                            data: [3, 1, 1],
                            backgroundColor: ['#22c55e', '#ef4444', '#94a3b8'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: { legend: { display: false } },
                        cutout: '70%'
                    }
                });
            }
        }

        var centerText = document.getElementById('sentiment-center-text');
        if (centerText) {
            var valueEl = centerText.querySelector('.sentiment-center-value');
            var labelEl = centerText.querySelector('.sentiment-center-label');
            if (valueEl) valueEl.textContent = '5';
            if (labelEl) labelEl.textContent = 'Toplam';
        }

        // Seçili havayolu özeti için sahte veriler
        var complaintsEl = document.getElementById('summary-complaints-list');
        var likedEl = document.getElementById('summary-liked-list');
        if (complaintsEl) {
            complaintsEl.innerHTML =
                '<div class="summary-item"><i class="fas fa-exclamation-circle"></i><div><div class="summary-item-title">Gecikmeler</div><div class="summary-item-desc">Uçuşların zamanında kalkmaması sık şikayet ediliyor.</div></div></div>';
        }
        if (likedEl) {
            likedEl.innerHTML =
                '<div class="summary-item"><i class="fas fa-check-circle"></i><div><div class="summary-item-title">Kabin Ekibi</div><div class="summary-item-desc">Personelin güler yüzlü ve yardımcı olması öne çıkıyor.</div></div></div>';
        }

        var scoreList = document.getElementById('score-distribution-list');
        if (scoreList) {
            scoreList.innerHTML =
                '<div class="score-distribution-row score-distribution-row--5">' +
                    '<div class="score-distribution-label">5 ★</div>' +
                    '<div class="score-distribution-bar-track"><div class="score-distribution-bar-fill" style="width:60%;"></div></div>' +
                    '<div class="score-distribution-percent">60%</div>' +
                '</div>';
        }

        var routeList = document.getElementById('route-satisfaction-list');
        if (routeList) {
            routeList.innerHTML =
                '<div class="route-row">' +
                    '<div class="route-name">IST → ADB</div>' +
                    '<div class="route-row-bar-track"><div class="route-row-bar-fill" style="width:80%;background:#22c55e;"></div></div>' +
                    '<div class="route-score route-score-positive">4.5</div>' +
                '</div>';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEmptyState);
    } else {
        initEmptyState();
    }

})();

