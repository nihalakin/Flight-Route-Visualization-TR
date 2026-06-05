/**
 * Havayolu Yorumları – Onaylı yorumlar, havayolu seçimine göre listelenir.
 */
(function () {
    'use strict';

    var API_BASE = window.location.origin;
    var loadingEl = document.getElementById('loading-state');
    var emptyEl = document.getElementById('empty-state');
    var contentEl = document.getElementById('content-area');
    var sectionsContainer = document.getElementById('airline-sections');
    var airlineSelect = document.getElementById('airline-select');
    var resultsCountEl = document.getElementById('results-count');
    var reviewFilterButtonsContainer = document.getElementById('review-filter-buttons');
    var reviewSearchInput = document.getElementById('review-search-input');

    var byAirlineData = [];
    var currentSentimentFilter = '';
    var currentSearchQuery = '';
    var currentDateRange = 'all'; // '30d', '90d', '1y', 'all'
    var airlinePages = {};
    var currentSelectedAirline = null;
    var currentAnalysisMode = 'user'; // 'user' | 'dataset'
    var REVIEWS_PER_PAGE = 5;

    function showLoading(show) {
        if (loadingEl) loadingEl.style.display = show ? 'flex' : 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        if (contentEl) contentEl.style.display = show ? 'none' : 'block';
    }

    function showEmpty(show) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = show ? 'flex' : 'none';
        if (contentEl) contentEl.style.display = show ? 'none' : 'block';
    }

    function showContent(show) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        if (contentEl) contentEl.style.display = show ? 'block' : 'none';
    }

    function escapeHtml(s) {
        if (s == null) return '';
        var t = String(s);
        return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatDate(d) {
        if (!d) return '—';
        var date = new Date(d);
        return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getInitialsFromReview(review) {
        var first = (review.first_name || '').trim();
        var last = (review.last_name || '').trim();
        if (first || last) {
            var f = first ? first.charAt(0).toUpperCase() : '';
            var l = last ? last.charAt(0).toUpperCase() : '';
            return (f + l) || 'A';
        }
        var username = (review.username || '').trim();
        if (!username) return 'A';
        var parts = username.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        var uf = parts[0].charAt(0).toUpperCase();
        var ul = parts[parts.length - 1].charAt(0).toUpperCase();
        return uf + ul;
    }

    function renderReviewCard(review) {
        var route = review.route || '—';
        var reviewDate = formatDate(review.review_date);
        var title = (review.title || '').trim();
        var content = (review.content || '').trim();
        var username = review.username || 'Anonim';
        var contributions = review.user_total_reviews || null;
        var initials = getInitialsFromReview(review);
        var initialsCode = (initials.charCodeAt(0) || 0) + (initials.charCodeAt(1) || 0);
        var avatarColorClass = 'avatar-color-' + (initialsCode % 6);
        var rating = Math.min(5, Math.max(1, parseInt(review.rating, 10) || 0));
        var stars = '';
        for (var i = 1; i <= 5; i++) {
            stars += i <= rating
                ? '<i class="fas fa-star star-filled"></i>'
                : '<i class="far fa-star star-empty"></i>';
        }

        return (
            '<div class="review-card">' +
                '<div class="review-card-meta">' +
                    '<span class="review-avatar-circle ' + avatarColorClass + '" aria-hidden="true">' + escapeHtml(initials) + '</span>' +
                    '<span class="review-username">' + escapeHtml(username) + '</span>' +
                    (contributions && contributions > 1
                        ? '<span class="review-contributions" title="Bu kullanıcının onaylı yorum sayısı">' +
                          escapeHtml(String(contributions)) +
                          ' katkı' +
                          '</span>'
                        : '') +
                    '<span class="review-route"><i class="fas fa-route"></i> ' + escapeHtml(route) + '</span>' +
                    '<span class="review-date"><i class="far fa-calendar-alt"></i> ' + escapeHtml(reviewDate) + '</span>' +
                    '<span class="review-rating">' + stars + ' <span class="rating-num">' + rating + '/5</span></span>' +
                '</div>' +
                (title ? '<h4 class="review-title">' + escapeHtml(title) + '</h4>' : '') +
                (content ? '<div class="review-content">' + escapeHtml(content) + '</div>' : '') +
            '</div>'
        );
    }

    function getSentimentFromRatingValue(rating) {
        var star = Math.min(5, Math.max(1, parseInt(rating, 10) || 0));
        if (star >= 4) return 'positive';
        if (star <= 2) return 'negative';
        return 'neutral';
    }

    function renderAirlineSection(airlineName, reviews, page, totalPages, totalCount) {
        page = page || 1;
        totalPages = totalPages || 1;
        totalCount = totalCount || reviews.length;
        var startIndex = totalCount === 0 ? 0 : (page - 1) * REVIEWS_PER_PAGE + 1;
        var endIndex = Math.min(page * REVIEWS_PER_PAGE, totalCount);
        var cardsHtml = reviews.map(function (r) { return renderReviewCard(r); }).join('');
        return (
            '<section class="airline-section" data-airline="' + escapeHtml(airlineName) + '">' +
                '<div class="airline-section-header">' +
                    '<h2 class="airline-section-title"><i class="fas fa-plane"></i> ' + escapeHtml(airlineName) + '</h2>' +
                    '<span class="airline-section-count">' + reviews.length + ' yorum</span>' +
                '</div>' +
                '<div class="airline-reviews-list">' + cardsHtml + '</div>' +
                '<div class="airline-section-footer">' +
                    '<span class="airline-section-page-info">' + (totalCount ? ('Gösterilen ' + startIndex + '–' + endIndex + ' / ' + totalCount + ' yorum') : 'Yorum yok') + '</span>' +
                    (totalPages > 1 ? (
                        '<div class="airline-section-pager">' +
                            '<button type="button" class="airline-page-btn" data-airline="' + escapeHtml(airlineName) + '" data-dir="prev"' + (page <= 1 ? ' disabled' : '') + '>Önceki</button>' +
                            '<button type="button" class="airline-page-btn" data-airline="' + escapeHtml(airlineName) + '" data-dir="next"' + (page >= totalPages ? ' disabled' : '') + '>Sonraki</button>' +
                        '</div>'
                    ) : '') +
                '</div>' +
            '</section>'
        );
    }

    function populateDropdown() {
        if (!airlineSelect) return;
        airlineSelect.innerHTML = '<option value="">Tüm Havayolları</option>';
        for (var i = 0; i < byAirlineData.length; i++) {
            var name = byAirlineData[i].airline_name || 'Diğer';
            var opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            airlineSelect.appendChild(opt);
        }
    }

    function normalizeAirlineKey(name) {
        if (!name) return null;
        var n = String(name).toLowerCase();
        if (n.includes('turkish') || n.includes('thy') || n.includes('türk hava')) return 'turkish';
        if (n.includes('pegasus')) return 'pegasus';
        if (n.includes('ajet')) return 'ajet';
        if (n.includes('sunexpress') || n.includes('sun express')) return 'sunexpress';
        return null;
    }

    var multiAirlineTrendChart = null;
    var globalTopicsLoaded = false;

    function renderAirlineOverviewCards() {
        var section = document.getElementById('airline-overview-section');
        var grid = document.getElementById('airline-overview-grid');
        var comparisonSection = document.getElementById('multi-airline-comparison-section');
        var sentimentListEl = document.getElementById('multi-airline-sentiment-list');
        var comparisonHeading = document.querySelector('.multi-airline-page-heading');
        var comparisonSub = document.querySelector('.multi-airline-page-subtitle');
        if (!section || !grid) return;

        if (currentSelectedAirline) {
            section.style.display = 'none';
            grid.innerHTML = '';
            if (comparisonSection) comparisonSection.style.display = 'none';
            if (comparisonHeading) comparisonHeading.style.display = 'none';
            if (comparisonSub) comparisonSub.style.display = 'none';
            if (sentimentListEl) sentimentListEl.innerHTML = '';
            if (multiAirlineTrendChart) {
                multiAirlineTrendChart.destroy();
                multiAirlineTrendChart = null;
            }
            var allSummarySection = document.getElementById('all-airlines-summary-section');
            if (allSummarySection) {
                allSummarySection.style.display = 'none';
            }
            return;
        }

        var targetOrder = ['turkish', 'pegasus', 'ajet', 'sunexpress'];
        var displayNames = {
            turkish: 'Türk Hava Yolları',
            pegasus: 'Pegasus',
            ajet: 'AJet',
            sunexpress: 'SunExpress'
        };

        var byKey = {};
        byAirlineData.forEach(function (g) {
            var key = normalizeAirlineKey(g.airline_name);
            if (!key) return;
            if (!byKey[key]) byKey[key] = [];
            (g.reviews || []).forEach(function (r) { byKey[key].push(r); });
        });

        var cards = [];
        targetOrder.forEach(function (key) {
            var reviews = byKey[key] || [];
            if (!reviews.length) return;
            var total = reviews.length;
            var pos = 0, neu = 0, neg = 0;
            var ratingSum = 0;
            reviews.forEach(function (r) {
                var star = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 0));
                ratingSum += star;
                var sent = getSentimentFromRatingValue(star);
                if (sent === 'positive') pos++;
                else if (sent === 'negative') neg++;
                else neu++;
            });
            var avgRating = total ? (ratingSum / total) : 0;
            var positivePct = total ? Math.round((pos / total) * 100) : 0;
            cards.push({
                key: key,
                name: displayNames[key] || key,
                reviews: reviews,
                total: total,
                pos: pos,
                neu: neu,
                neg: neg,
                avgRating: avgRating,
                positivePct: positivePct
            });
        });

        if (!cards.length) {
            section.style.display = 'none';
            grid.innerHTML = '';
            if (comparisonSection) comparisonSection.style.display = 'none';
            if (comparisonHeading) comparisonHeading.style.display = 'none';
            if (comparisonSub) comparisonSub.style.display = 'none';
            if (sentimentListEl) sentimentListEl.innerHTML = '';
            if (multiAirlineTrendChart) {
                multiAirlineTrendChart.destroy();
                multiAirlineTrendChart = null;
            }
            var allSummarySectionEmpty = document.getElementById('all-airlines-summary-section');
            if (allSummarySectionEmpty) {
                allSummarySectionEmpty.style.display = 'none';
            }
            return;
        }

        var html = cards.map(function (c) {
            var initials = c.name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
            var total = c.total || 1;
            var posPct = Math.round((c.pos / total) * 100);
            var neuPct = Math.round((c.neu / total) * 100);
            var negPct = Math.max(0, 100 - posPct - neuPct);
            var midPct = posPct + neuPct;
            var ringStyle =
                'background: conic-gradient(' +
                '#22c55e 0 ' + posPct + '%,' +
                '#eab308 ' + posPct + '% ' + midPct + '%,' +
                '#ef4444 ' + midPct + '% 100%)';
            return '' +
                '<article class="airline-overview-card">' +
                    '<div class="airline-overview-header">' +
                        '<div class="airline-overview-title">' +
                            '<div class="airline-overview-avatar">' + escapeHtml(initials) + '</div>' +
                            '<div>' +
                                '<div class="airline-overview-name">' + escapeHtml(c.name) + '</div>' +
                                '<div class="airline-overview-rating"><i class="fas fa-star"></i> ' + c.avgRating.toFixed(1) + ' / 5.0</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="airline-overview-main">' +
                        '<div>' +
                            '<div class="airline-overview-total">' +
                                '<span class="airline-overview-total-label">Toplam Yorumlar</span>' +
                                '<span class="airline-overview-total-value">' + c.total.toLocaleString('tr-TR') + '</span>' +
                            '</div>' +
                            '<div class="airline-overview-breakdown">' +
                                '<div class="airline-overview-breakdown-label"><span class="airline-overview-dot positive"></span> Olumlu</div>' +
                                '<div class="airline-overview-breakdown-value">' + c.pos.toLocaleString('tr-TR') + '</div>' +
                                '<div class="airline-overview-breakdown-label"><span class="airline-overview-dot neutral"></span> Nötr</div>' +
                                '<div class="airline-overview-breakdown-value">' + c.neu.toLocaleString('tr-TR') + '</div>' +
                                '<div class="airline-overview-breakdown-label"><span class="airline-overview-dot negative"></span> Olumsuz</div>' +
                                '<div class="airline-overview-breakdown-value">' + c.neg.toLocaleString('tr-TR') + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="airline-overview-ring-wrapper">' +
                            '<div class="airline-overview-ring">' +
                                '<div class="airline-overview-ring-fill" style="' + ringStyle + '"></div>' +
                                '<span class="airline-overview-ring-center">%' + posPct + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</article>';
        }).join('');

        grid.innerHTML = html;
        section.style.display = 'block';
        if (comparisonHeading) comparisonHeading.style.display = 'block';
        if (comparisonSub) comparisonSub.style.display = 'block';

        // Tüm havayolları görünümünde, global özet kartını göster (veri yüklendiyse)
        var allSummarySectionReady = document.getElementById('all-airlines-summary-section');
        if (allSummarySectionReady && globalTopicsLoaded && currentAnalysisMode === 'user') {
            allSummarySectionReady.style.display = 'block';
        }

        if (comparisonSection && sentimentListEl) {
            // Sentiment bars
            sentimentListEl.innerHTML = cards.map(function (c) {
                var total = c.total || 1;
                var posPct = Math.round((c.pos / total) * 100);
                var neuPct = Math.round((c.neu / total) * 100);
                var negPct = 100 - posPct - neuPct;
                return '' +
                    '<div class="multi-airline-sentiment-row">' +
                        '<div class="multi-airline-sentiment-name">' + escapeHtml(c.name) + '</div>' +
                        '<div class="multi-airline-sentiment-bar">' +
                            '<div class="multi-airline-sentiment-segment positive" style="width:' + posPct + '%"></div>' +
                            '<div class="multi-airline-sentiment-segment neutral" style="width:' + neuPct + '%"></div>' +
                            '<div class="multi-airline-sentiment-segment negative" style="width:' + negPct + '%"></div>' +
                        '</div>' +
                        '<div class="multi-airline-sentiment-value">' + c.total.toLocaleString('tr-TR') + '</div>' +
                    '</div>';
            }).join('');

            // Volume trend chart (last 6 months)
            var now = new Date();
            var monthKeys = [];
            var monthLabels = [];
            for (var i = 5; i >= 0; i--) {
                var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                var y = d.getFullYear();
                var m = d.getMonth() + 1;
                monthKeys.push(y + '-' + String(m).padStart(2, '0'));
                monthLabels.push(d.toLocaleDateString('tr-TR', { month: 'short' }));
            }

            var datasets = [];
            var colorMap = {
                turkish: '#ef4444',
                pegasus: '#f97316',
                ajet: '#64748b',
                sunexpress: '#06b6d4'
            };

            cards.forEach(function (c) {
                var monthly = {};
                monthKeys.forEach(function (k) { monthly[k] = 0; });
                (c.reviews || []).forEach(function (r) {
                    var d = r.travel_date;
                    if (!d) return;
                    var date = new Date(d);
                    if (isNaN(date.getTime())) return;
                    var y = date.getFullYear();
                    var m = date.getMonth() + 1;
                    var key = y + '-' + String(m).padStart(2, '0');
                    if (monthly.hasOwnProperty(key)) monthly[key]++;
                });
                var dataPoints = monthKeys.map(function (k) { return monthly[k] || 0; });
                datasets.push({
                    label: c.name,
                    data: dataPoints,
                    borderColor: colorMap[c.key] || '#6366f1',
                    backgroundColor: 'transparent',
                    tension: 0.35,
                    borderWidth: 2
                });
            });

            var canvas = document.getElementById('multi-airline-volume-trend');
            if (canvas && typeof Chart !== 'undefined') {
                var ctx = canvas.getContext('2d');
                if (multiAirlineTrendChart) {
                    multiAirlineTrendChart.destroy();
                    multiAirlineTrendChart = null;
                }
                multiAirlineTrendChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: monthLabels,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                labels: {
                                    boxWidth: 10,
                                    boxHeight: 10,
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    font: { size: 11 }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { stepSize: 1 }
                            },
                            x: {
                                grid: { display: false }
                            }
                        }
                    }
                });
            }

            comparisonSection.style.display = 'block';
        }

        if (!globalTopicsLoaded) {
            loadGlobalTopicsOverview();
        }
    }

    function loadGlobalTopicsOverview() {
        var complaintsEl = document.getElementById('global-complaints-list');
        var praisesEl = document.getElementById('global-praises-list');
        var allSummarySection = document.getElementById('all-airlines-summary-section');
        var allComplaintsList = document.getElementById('all-summary-complaints-list');
        var allLikedList = document.getElementById('all-summary-liked-list');

        if (!allSummarySection || !allComplaintsList || !allLikedList) return;
        if (globalTopicsLoaded) return;

        var airlines = ['Türk Hava Yolları', 'Pegasus', 'AJet', 'SunExpress'];
        var requests = airlines.map(function (name) {
            var url = API_BASE + '/api/analyze-reviews/result?airline=' + encodeURIComponent(name);
            return fetch(url)
                .then(function (res) { return res.ok ? res.json() : null; })
                .catch(function () { return null; });
        });

        Promise.all(requests).then(function (results) {
            var complaints = [];
            var praises = [];
            results.forEach(function (data) {
                if (!data) return;
                if (Array.isArray(data.most_complained_topics)) {
                    complaints = complaints.concat(data.most_complained_topics);
                }
                if (Array.isArray(data.most_liked_aspects)) {
                    praises = praises.concat(data.most_liked_aspects);
                }
            });

            function uniqueTop(list, limit) {
                var seen = {};
                var out = [];
                for (var i = 0; i < list.length; i++) {
                    var raw = String(list[i] || '').trim();
                    if (!raw) continue;
                    var key = raw.toLowerCase();
                    if (seen[key]) continue;
                    seen[key] = true;
                    out.push(raw);
                    if (out.length >= limit) break;
                }
                return out;
            }

            var topComplaints = uniqueTop(complaints, 3);
            var topPraises = uniqueTop(praises, 3);

            function renderSummaryList(targetEl, items, isNegative) {
                if (!targetEl) return;
                if (!items.length) {
                    targetEl.innerHTML = '<p class="summary-list-empty">Veri yok</p>';
                    return;
                }
                targetEl.innerHTML = items.map(function (text) {
                    var str = String(text || '').trim();
                    if (!str) return '';
                    var idx = str.indexOf(':');
                    var title = idx > 0 ? str.slice(0, idx).trim() : '';
                    var desc = idx > 0 ? str.slice(idx + 1).trim() : str;
                    var icon = isNegative ? 'fa-exclamation-circle' : 'fa-check-circle';
                    if (title && desc) {
                        return '<div class="summary-item"><i class="fas ' + icon + '" aria-hidden="true"></i><div><div class="summary-item-title">' +
                            escapeHtml(title) +
                            '</div><div class="summary-item-desc">' +
                            escapeHtml(desc) +
                            '</div></div></div>';
                    }
                    return '<div class="summary-item"><i class="fas ' + icon + '" aria-hidden="true"></i><div class="summary-item-desc">' +
                        escapeHtml(str) +
                        '</div></div>';
                }).join('');
            }

            renderSummaryList(allComplaintsList, topComplaints, true);
            renderSummaryList(allLikedList, topPraises, false);

            // Sadece kullanıcı yorumları modunda ve tüm havayolları seçiliyken gösterilecek (ek mantık aşağıda)
            allSummarySection.style.display = (topComplaints.length || topPraises.length) ? 'block' : 'none';

            globalTopicsLoaded = true;
        });
    }

    function updateResultsCountDisplay(totalVisible) {
        if (!resultsCountEl) return;
        var label = totalVisible === 1 ? '1 yorum' : totalVisible + ' yorum';
        resultsCountEl.textContent = label;
    }

    function matchesDateRange(review, range) {
        if (range === 'all') return true;
        // Varsayılan tarih filtresi: yorumun yazılma tarihi (review_date)
        var raw = review.review_date;
        if (!raw) return false;
        var date = new Date(raw);
        if (isNaN(date.getTime())) return false;
        var now = new Date();
        var diffMs = now.getTime() - date.getTime();
        var dayMs = 24 * 60 * 60 * 1000;
        if (range === '30d') return diffMs <= 30 * dayMs;
        if (range === '90d') return diffMs <= 90 * dayMs;
        if (range === '1y') return diffMs <= 365 * dayMs;
        return true;
    }

    function matchesSearch(review, query) {
        if (!query) return true;
        var q = String(query).toLocaleLowerCase('tr-TR');
        var content = String(review.content || '').toLocaleLowerCase('tr-TR');
        return content.indexOf(q) !== -1;
    }

    function renderSections(selectedAirline) {
        if (!sectionsContainer) return;
        var html = '';
        var totalVisible = 0;
        for (var i = 0; i < byAirlineData.length; i++) {
            var group = byAirlineData[i];
            var name = group.airline_name || 'Diğer';
            var reviews = (group.reviews || []).slice();
            if (reviews.length === 0) continue;
            if (selectedAirline && name !== selectedAirline) continue;
            var filtered = reviews.filter(function (r) {
                if (!matchesDateRange(r, currentDateRange)) return false;
                if (!matchesSearch(r, currentSearchQuery)) return false;
                if (currentSentimentFilter) {
                    return getSentimentFromRatingValue(r.rating) === currentSentimentFilter;
                }
                return true;
            });
            var totalCount = filtered.length;
            if (!totalCount) continue;
            var totalPages = Math.max(1, Math.ceil(totalCount / REVIEWS_PER_PAGE));
            var currentPage = airlinePages[name] || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;
            airlinePages[name] = currentPage;
            var start = (currentPage - 1) * REVIEWS_PER_PAGE;
            var pageReviews = filtered.slice(start, start + REVIEWS_PER_PAGE);
            totalVisible += totalCount;
            html += renderAirlineSection(name, pageReviews, currentPage, totalPages, totalCount);
        }
        sectionsContainer.innerHTML = html;
        updateResultsCountDisplay(totalVisible);
        renderAirlineOverviewCards();

        if (!renderSections.paginationBound) {
            renderSections.paginationBound = true;
            sectionsContainer.addEventListener('click', function (evt) {
                var btn = evt.target.closest('.airline-page-btn');
                if (!btn) return;
                var airline = btn.getAttribute('data-airline');
                var dir = btn.getAttribute('data-dir');
                if (!airline || !dir) return;
                var currentPage = airlinePages[airline] || 1;
                if (dir === 'prev') currentPage -= 1;
                if (dir === 'next') currentPage += 1;
                airlinePages[airline] = currentPage;
                renderSections(currentSelectedAirline);
            });
        }
    }

    function onAirlineChange() {
        var value = airlineSelect && airlineSelect.value ? airlineSelect.value.trim() : '';
        currentSelectedAirline = value || null;
        airlinePages = {};
        renderSections(currentSelectedAirline);
        loadAnalysisResultForAirline(value || '');

        // Kullanıcı yorum analizi modunda: sadece Tüm Havayolları seçiliyken global özet görünsün
        var allSummarySection = document.getElementById('all-airlines-summary-section');
        if (allSummarySection) {
            if (currentAnalysisMode === 'user' && !currentSelectedAirline && globalTopicsLoaded) {
                allSummarySection.style.display = 'block';
            } else {
                allSummarySection.style.display = 'none';
            }
        }
    }

    function loadReviews() {
        if (currentAnalysisMode !== 'user') {
            return;
        }
        if (!sectionsContainer) return;
        showLoading(true);

        fetch(API_BASE + '/api/public/reviews/by-airline')
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var byAirline = data && data.by_airline;
                if (!byAirline || !Array.isArray(byAirline) || byAirline.length === 0) {
                    showEmpty(true);
                    return;
                }

                byAirlineData = byAirline.filter(function (g) {
                    return (g.reviews || []).length > 0;
                });

                if (byAirlineData.length === 0) {
                    showEmpty(true);
                    return;
                }

                populateDropdown();
                currentSelectedAirline = airlineSelect ? (airlineSelect.value || '').trim() || null : null;
                renderSections(currentSelectedAirline);
                showContent(true);

                // Kullanıcı yorum analizi modunda: Tüm Havayolları görünümünde global özet varsa göster
                var allSummarySection = document.getElementById('all-airlines-summary-section');
                if (allSummarySection && currentAnalysisMode === 'user' && !currentSelectedAirline && globalTopicsLoaded) {
                    allSummarySection.style.display = 'block';
                }

                if (airlineSelect) {
                    airlineSelect.addEventListener('change', onAirlineChange);
                }
                bindReviewFilterButtons();
                loadAnalysisResultForAirline(currentSelectedAirline || '');
            })
            .catch(function () {
                showEmpty(true);
            });
    }

    var sentimentChartInstance = null;
    var scoreDistributionChart = null;
    var trendByFlightDateChart = null;

    function bindReviewFilterButtons() {
        if (!reviewFilterButtonsContainer || bindReviewFilterButtons.bound) return;
        bindReviewFilterButtons.bound = true;
        reviewFilterButtonsContainer.addEventListener('click', function (evt) {
            var btn = evt.target.closest('.review-filter-btn');
            if (!btn) return;
            var sentiment = btn.getAttribute('data-sentiment') || '';
            currentSentimentFilter = sentiment;
            airlinePages = {};
            var allBtns = reviewFilterButtonsContainer.querySelectorAll('.review-filter-btn');
            allBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            renderSections(currentSelectedAirline);
        });

        var dateSelect = document.getElementById('review-date-select');
        if (dateSelect) {
            currentDateRange = dateSelect.value || 'all';
            dateSelect.addEventListener('change', function () {
                currentDateRange = dateSelect.value || 'all';
                airlinePages = {};
                renderSections(currentSelectedAirline);
            });
        }

        if (reviewSearchInput) {
            var searchTimeout = null;
            reviewSearchInput.addEventListener('input', function () {
                var value = (reviewSearchInput.value || '').trim();
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }
                searchTimeout = setTimeout(function () {
                    currentSearchQuery = value.toLocaleLowerCase('tr-TR');
                    airlinePages = {};
                    renderSections(currentSelectedAirline);
                }, 200);
            });
        }
    }

    function updateGeneralStats(data) {
        var total = 0, positive = 0, negative = 0, neutral = 0;
        var avgRating = 0;
        if (data) {
            var sd = data.sentiment_distribution || {};
            positive = parseInt(sd.positive, 10) || 0;
            negative = parseInt(sd.negative, 10) || 0;
            neutral = parseInt(sd.neutral, 10) || 0;
            total = positive + negative + neutral;
            var ra = data.rating_analysis || {};
            avgRating = ra.average_rating != null ? Number(ra.average_rating) : 0;
        }
        var pct = total ? function (n) { return Math.round((n / total) * 100); } : function () { return 0; };
        setText('stat-total', total);
        setText('stat-positive', positive);
        setText('stat-negative', negative);
        setText('stat-neutral', neutral);
        setText('stat-positive-pct', pct(positive) + '%');
        setText('stat-negative-pct', pct(negative) + '%');
        setText('stat-neutral-pct', pct(neutral) + '%');
        setText('stat-rating', avgRating > 0 ? avgRating.toFixed(1) : '0.0');
        var starsEl = document.getElementById('stat-stars');
        if (starsEl) {
            var r = Math.min(5, Math.max(0, Math.round(avgRating)));
            var html = '';
            for (var i = 1; i <= 5; i++) {
                html += i <= r ? '<i class="fas fa-star stat-star stat-star-filled"></i>' : '<i class="far fa-star stat-star stat-star-empty"></i>';
            }
            starsEl.innerHTML = html;
        }
        function setText(id, val) {
            var el = document.getElementById(id);
            if (el) el.textContent = val;
        }
    }

    function loadAnalysisResultForAirline(airline) {
        var generalStatsSection = document.getElementById('general-stats-section');
        var sentimentChartSection = document.getElementById('sentiment-chart-section');
        var summarySection = document.getElementById('analysis-summary-section');
        var routeSection = document.querySelector('.route-satisfaction-section');

        if (!airline) {
            updateGeneralStats(null);
            if (generalStatsSection) generalStatsSection.style.display = 'none';
            if (sentimentChartSection) sentimentChartSection.style.display = 'none';
            if (summarySection) summarySection.style.display = 'none';
            if (routeSection) routeSection.style.display = 'none';
            if (scoreDistributionChart) { scoreDistributionChart.destroy(); scoreDistributionChart = null; }
            if (trendByFlightDateChart) { trendByFlightDateChart.destroy(); trendByFlightDateChart = null; }
            if (sentimentChartInstance) { sentimentChartInstance.destroy(); sentimentChartInstance = null; }
            return;
        }

        if (generalStatsSection) generalStatsSection.style.display = 'block';
        if (sentimentChartSection) sentimentChartSection.style.display = 'block';
        if (summarySection) summarySection.style.display = 'block';
        if (routeSection) routeSection.style.display = 'block';

        var url = API_BASE + '/api/analyze-reviews/result?airline=' + encodeURIComponent(airline);
        fetch(url)
            .then(function (res) { return res.ok ? res.json() : Promise.resolve(null); })
            .then(function (data) {
                updateGeneralStats(data);
                updateAnalysisSummarySection(airline, data);
                updateSentimentTabs(airline);
                renderAnalysisResults(data || {});
            })
            .catch(function () {
                updateGeneralStats(null);
                updateAnalysisSummarySection(airline, null);
                updateSentimentTabs(airline);
            });
    }

    var sentimentTabsBound = false;

    var sentimentPages = {
        positive: 1,
        neutral: 1,
        negative: 1,
    };

    var SENTIMENT_REVIEWS_PER_PAGE = 5;

    function updateSentimentTabs(airline) {
        var listPositive = document.getElementById('sentiment-list-positive');
        var listNeutral = document.getElementById('sentiment-list-neutral');
        var listNegative = document.getElementById('sentiment-list-negative');
        if (!listPositive || !listNeutral || !listNegative) return;

        var reviews = [];
        for (var i = 0; i < byAirlineData.length; i++) {
            if (byAirlineData[i].airline_name === airline) {
                reviews = (byAirlineData[i].reviews || []).slice();
                break;
            }
        }

        function bySentiment(r) {
            var rating = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 0));
            if (rating >= 4) return 'positive';
            if (rating <= 2) return 'negative';
            return 'neutral';
        }

        function sortByDate(a, b) {
            var da = new Date(a.review_date || 0).getTime();
            var db = new Date(b.review_date || 0).getTime();
            return db - da;
        }

        var allPositive = reviews.filter(function (r) { return bySentiment(r) === 'positive'; }).sort(sortByDate);
        var allNeutral = reviews.filter(function (r) { return bySentiment(r) === 'neutral'; }).sort(sortByDate);
        var allNegative = reviews.filter(function (r) { return bySentiment(r) === 'negative'; }).sort(sortByDate);

        function fillList(listEl, infoEl, sentimentKey, allList, sentimentClass) {
            if (!listEl || !infoEl) return;
            var total = allList.length;
            if (total === 0) {
                listEl.innerHTML = '<p class="sentiment-tab-list-empty">Bu kategoride henüz yorum yok.</p>';
                infoEl.textContent = '';
                var prevBtnEmpty = document.getElementById('sentiment-page-prev-' + sentimentKey);
                var nextBtnEmpty = document.getElementById('sentiment-page-next-' + sentimentKey);
                if (prevBtnEmpty) prevBtnEmpty.disabled = true;
                if (nextBtnEmpty) nextBtnEmpty.disabled = true;
                return;
            }
            var totalPages = Math.max(1, Math.ceil(total / SENTIMENT_REVIEWS_PER_PAGE));
            var page = sentimentPages[sentimentKey] || 1;
            if (page > totalPages) page = totalPages;
            if (page < 1) page = 1;
            sentimentPages[sentimentKey] = page;
            var start = (page - 1) * SENTIMENT_REVIEWS_PER_PAGE;
            var currentList = allList.slice(start, start + SENTIMENT_REVIEWS_PER_PAGE);

            var html = currentList.map(function (r) {
                var card = renderReviewCard(r);
                return card.replace('class="review-card"', 'class="review-card sentiment-' + sentimentClass + '"');
            }).join('');
            listEl.innerHTML = html;

            var startIndex = start + 1;
            var endIndex = Math.min(start + SENTIMENT_REVIEWS_PER_PAGE, total);
            infoEl.textContent = 'Gösterilen ' + startIndex + '–' + endIndex + ' / ' + total + ' yorum';

            var prevBtn = document.getElementById('sentiment-page-prev-' + sentimentKey);
            var nextBtn = document.getElementById('sentiment-page-next-' + sentimentKey);
            if (prevBtn) prevBtn.disabled = page <= 1;
            if (nextBtn) nextBtn.disabled = page >= totalPages;
        }

        fillList(
            listPositive,
            document.getElementById('sentiment-page-info-positive'),
            'positive',
            allPositive,
            'positive'
        );
        fillList(
            listNeutral,
            document.getElementById('sentiment-page-info-neutral'),
            'neutral',
            allNeutral,
            'neutral'
        );
        fillList(
            listNegative,
            document.getElementById('sentiment-page-info-negative'),
            'negative',
            allNegative,
            'negative'
        );

        if (!sentimentTabsBound) {
            sentimentTabsBound = true;
            var btnPositive = document.getElementById('sentiment-tab-btn-positive');
            var btnNeutral = document.getElementById('sentiment-tab-btn-neutral');
            var btnNegative = document.getElementById('sentiment-tab-btn-negative');
            var panelPositive = document.getElementById('sentiment-tab-panel-positive');
            var panelNeutral = document.getElementById('sentiment-tab-panel-neutral');
            var panelNegative = document.getElementById('sentiment-tab-panel-negative');

            function switchTab(activeBtn, activePanel) {
                [btnPositive, btnNeutral, btnNegative].forEach(function (btn) {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                });
                [panelPositive, panelNeutral, panelNegative].forEach(function (panel) {
                    panel.classList.remove('active');
                    panel.setAttribute('hidden', '');
                });
                activeBtn.classList.add('active');
                activeBtn.setAttribute('aria-selected', 'true');
                activePanel.classList.add('active');
                activePanel.removeAttribute('hidden');
            }

            if (btnPositive) btnPositive.addEventListener('click', function () { switchTab(btnPositive, panelPositive); });
            if (btnNeutral) btnNeutral.addEventListener('click', function () { switchTab(btnNeutral, panelNeutral); });
            if (btnNegative) btnNegative.addEventListener('click', function () { switchTab(btnNegative, panelNegative); });

            var panelsContainer = document.querySelector('.sentiment-tab-panels');
            if (panelsContainer) {
                panelsContainer.addEventListener('click', function (evt) {
                    var btn = evt.target.closest('.sentiment-page-btn');
                    if (!btn) return;
                    var key = btn.getAttribute('data-sentiment');
                    var dir = btn.getAttribute('data-dir');
                    if (!key || !dir) return;
                    var current = sentimentPages[key] || 1;
                    if (dir === 'prev') current -= 1;
                    if (dir === 'next') current += 1;
                    sentimentPages[key] = current;
                    updateSentimentTabs(airline);
                });
            }
        }
    }

    function updateAnalysisSummarySection(airline, data) {
        var complaintsList = document.getElementById('summary-complaints-list');
        var likedList = document.getElementById('summary-liked-list');
        if (!complaintsList || !likedList) return;

        var complaints = (data && data.most_complained_topics) ? data.most_complained_topics : [];
        var liked = (data && data.most_liked_aspects) ? data.most_liked_aspects : [];

        function renderSummaryItem(text, iconClass, isNegative) {
            var str = String(text || '').trim();
            if (!str) return '';
            var idx = str.indexOf(':');
            var title = idx > 0 ? str.slice(0, idx).trim() : '';
            var desc = idx > 0 ? str.slice(idx + 1).trim() : str;
            var icon = isNegative ? 'fa-exclamation-circle' : 'fa-check-circle';
            if (title && desc) {
                return '<div class="summary-item"><i class="fas ' + icon + '" aria-hidden="true"></i><div><div class="summary-item-title">' + escapeHtml(title) + '</div><div class="summary-item-desc">' + escapeHtml(desc) + '</div></div></div>';
            }
            return '<div class="summary-item"><i class="fas ' + icon + '" aria-hidden="true"></i><div class="summary-item-desc">' + escapeHtml(str) + '</div></div>';
        }

        complaintsList.innerHTML = complaints.length
            ? complaints.map(function (t) { return renderSummaryItem(t, 'fa-exclamation-circle', true); }).join('')
            : '<p class="summary-list-empty">Veri yok</p>';

        likedList.innerHTML = liked.length
            ? liked.map(function (t) { return renderSummaryItem(t, 'fa-check-circle', false); }).join('')
            : '<p class="summary-list-empty">Veri yok</p>';

        var reviews = [];
        for (var i = 0; i < byAirlineData.length; i++) {
            if (byAirlineData[i].airline_name === airline) {
                reviews = (byAirlineData[i].reviews || []).slice();
                break;
            }
        }

        var ratingCounts = [0, 0, 0, 0, 0];
        reviews.forEach(function (r) {
            var star = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 0));
            ratingCounts[star - 1]++;
        });

        var totalRatings = ratingCounts.reduce(function (acc, v) { return acc + v; }, 0);
        var scoreList = document.getElementById('score-distribution-list');
        if (scoreList) {
            if (!totalRatings) {
                scoreList.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
            } else {
                var rowsHtml = '';
                var starOrder = [5, 4, 3, 2, 1];
                starOrder.forEach(function (star) {
                    var idx = star - 1;
                    var count = ratingCounts[idx] || 0;
                    var pct = totalRatings ? Math.round((count / totalRatings) * 100) : 0;
                    var width = pct;
                    rowsHtml += '' +
                        '<div class="score-distribution-row score-distribution-row--' + star + '">' +
                            '<div class="score-distribution-label">' + star + ' ★</div>' +
                            '<div class="score-distribution-bar-track">' +
                                '<div class="score-distribution-bar-fill" style="width:' + width + '%;"></div>' +
                            '</div>' +
                            '<div class="score-distribution-percent">%' + pct + '</div>' +
                        '</div>';
                });
                scoreList.innerHTML = rowsHtml;
            }
        }

        var now = new Date();
        var monthKeys = [];
        var monthLabels = [];
        for (var i = 11; i >= 0; i--) {
            var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            var y = d.getFullYear();
            var m = d.getMonth();
            monthKeys.push(y + '-' + String(m + 1).padStart(2, '0'));
            monthLabels.push(d.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }));
        }
        var byMonth = {};
        monthKeys.forEach(function (k) { byMonth[k] = 0; });
        reviews.forEach(function (r) {
            var d = r.travel_date;
            if (!d) return;
            var date = new Date(d);
            if (isNaN(date.getTime())) return;
            var y = date.getFullYear();
            var m = date.getMonth() + 1;
            var key = y + '-' + String(m).padStart(2, '0');
            if (byMonth.hasOwnProperty(key)) byMonth[key]++;
        });
        var trendCounts = monthKeys.map(function (k) { return byMonth[k] || 0; });

        if (trendByFlightDateChart) {
            trendByFlightDateChart.destroy();
            trendByFlightDateChart = null;
        }
        var trendCanvas = document.getElementById('trend-by-flight-date-chart');
        if (trendCanvas && typeof Chart !== 'undefined') {
            var ctx = trendCanvas.getContext('2d');
            trendByFlightDateChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [{
                        label: 'Yorum sayısı',
                        data: trendCounts,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Yorum Sayısı' }, ticks: { stepSize: 1 } },
                        x: { title: { display: true, text: 'Ay' } }
                    }
                }
            });
        }
    }

    function renderAnalysisResults(data) {
        var sd = data && data.sentiment_distribution ? data.sentiment_distribution : {};
        var positive = parseInt(sd.positive, 10) || 0;
        var negative = parseInt(sd.negative, 10) || 0;
        var neutral = parseInt(sd.neutral, 10) || 0;
        var total = positive + negative + neutral;

        if (sentimentChartInstance) {
            sentimentChartInstance.destroy();
            sentimentChartInstance = null;
        }
        var canvas = document.getElementById('sentiment-chart');
        if (canvas && typeof Chart !== 'undefined') {
            var ctx = canvas.getContext('2d');
            sentimentChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Pozitif', 'Negatif', 'Nötr'],
                    datasets: [{
                        data: [positive, negative, neutral],
                        backgroundColor: ['#22c55e', '#ef4444', '#94a3b8'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    cutout: '70%'
                }
            });
        }

        var legendEl = document.getElementById('sentiment-legend');
        if (legendEl) {
            var pct = function (n) { return total ? Math.round((n / total) * 100) : 0; };
            legendEl.innerHTML =
                '<span class="legend-item legend-positive"><i class="fas fa-smile"></i> Pozitif: ' + positive + ' (' + pct(positive) + '%)</span>' +
                '<span class="legend-item legend-negative"><i class="fas fa-frown"></i> Negatif: ' + negative + ' (' + pct(negative) + '%)</span>' +
                '<span class="legend-item legend-neutral"><i class="fas fa-meh"></i> Nötr: ' + neutral + ' (' + pct(neutral) + '%)</span>';
        }

        var centerText = document.getElementById('sentiment-center-text');
        if (centerText) {
            var valueEl = centerText.querySelector('.sentiment-center-value');
            var labelEl = centerText.querySelector('.sentiment-center-label');
            if (valueEl) {
                valueEl.textContent = total || 0;
            }
            if (labelEl) {
                labelEl.textContent = 'Toplam';
            }
        }

        var summaryRecsEl = document.getElementById('summary-recommendations-list');
        if (summaryRecsEl) {
            var recItems = data.customer_recommendations || [];
            if (!recItems.length) {
                summaryRecsEl.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
            } else {
                summaryRecsEl.innerHTML = recItems.slice(0, 3).map(function (text) {
                    var str = String(text || '').trim();
                    var label = str;
                    var value = '';
                    var idx = str.indexOf(':');
                    if (idx > 0) {
                        label = str.slice(0, idx).trim();
                        value = str.slice(idx + 1).trim();
                    }
                    return '<div class="summary-recommendation-item"><span class="summary-recommendation-label">' +
                        escapeHtml(label) +
                        '</span><span class="summary-recommendation-value">' +
                        escapeHtml(value || '—') +
                        '</span></div>';
                }).join('');
            }
        }

        var routeList = document.getElementById('route-satisfaction-list');
        var repeatPercentEl = document.getElementById('route-repeat-percent');
        var repeatTextEl = document.getElementById('route-repeat-text');

        if (repeatPercentEl) {
            var sdLocal = data && data.sentiment_distribution ? data.sentiment_distribution : {};
            var pos = parseInt(sdLocal.positive, 10) || 0;
            var neg = parseInt(sdLocal.negative, 10) || 0;
            var neu = parseInt(sdLocal.neutral, 10) || 0;
            var totalSent = pos + neg + neu;
            var pctVal = totalSent ? Math.round((pos / totalSent) * 100) : 0;
            repeatPercentEl.textContent = '%' + pctVal;
            if (repeatTextEl) {
                repeatTextEl.textContent = totalSent
                    ? 'Bu havayolunu tercih edenlerin önemli bir kısmı tekrar tercih etmeyi düşünüyor.'
                    : 'Yeterli veri bulunmuyor.';
            }
        }

        if (routeList) {
            // Seçili havayoluna ait yorumlardan rota bazlı ortalama puanları hesapla
            var airlineNameFromApi = data && data.airline_name;
            var airlineReviews = [];
            for (var i = 0; i < byAirlineData.length; i++) {
                if (byAirlineData[i].airline_name === airlineNameFromApi) {
                    airlineReviews = (byAirlineData[i].reviews || []).slice();
                    break;
                }
            }

            if (!airlineReviews.length) {
                routeList.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
            } else {
                var routeStats = {};
                airlineReviews.forEach(function (r) {
                    var route = (r.route || '').trim() || 'Bilinmeyen rota';
                    var rating = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 0));
                    if (!routeStats[route]) {
                        routeStats[route] = { sum: 0, count: 0 };
                    }
                    routeStats[route].sum += rating;
                    routeStats[route].count += 1;
                });

                var rows = Object.keys(routeStats).map(function (route) {
                    var stat = routeStats[route];
                    var avg = stat.count ? (stat.sum / stat.count) : 0;
                    return {
                        route: route,
                        avg: avg
                    };
                }).filter(function (row) {
                    return row.avg > 0;
                });

                if (!rows.length) {
                    routeList.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
                } else {
                    rows.sort(function (a, b) { return b.avg - a.avg; });
                    var topRows = rows.slice(0, 4);
                    routeList.innerHTML = topRows.map(function (row) {
                        var avgFixed = row.avg.toFixed(1);
                        var cls = 'route-score-neutral';
                        if (row.avg >= 4.5) cls = 'route-score-positive';
                        else if (row.avg < 4.0) cls = 'route-score-negative';
                        var barColor = '#f97316';
                        if (cls === 'route-score-positive') barColor = '#22c55e';
                        if (cls === 'route-score-negative') barColor = '#ef4444';
                        var width = Math.max(10, Math.min(100, Math.round((row.avg / 5) * 100)));
                        return '' +
                            '<div class="route-row">' +
                                '<div class="route-name">' + escapeHtml(row.route) + '</div>' +
                                '<div class="route-row-bar-track"><div class="route-row-bar-fill" style="width:' + width + '%;background:' + barColor + ';"></div></div>' +
                                '<div class="route-score ' + cls + '">' + escapeHtml(avgFixed) + '</div>' +
                            '</div>';
                    }).join('');
                }
            }
        }

        var themesWrap = document.getElementById('title-themes-wrap');
        if (themesWrap) {
            var themes = data.title_themes || [];
            if (themes.length === 0) {
                themesWrap.innerHTML = '<span class="analysis-list-empty">Veri yok</span>';
            } else {
                themesWrap.innerHTML = themes.map(function (t) { return '<span class="analysis-tag">' + escapeHtml(t) + '</span>'; }).join('');
            }
        }

        var wordsWrap = document.getElementById('frequent-words-wrap');
        if (wordsWrap) {
            var words = data.frequent_words || [];
            if (words.length === 0) {
                wordsWrap.innerHTML = '<span class="analysis-list-empty">Veri yok</span>';
            } else {
                wordsWrap.innerHTML = words.map(function (w) { return '<span class="analysis-tag analysis-tag-word">' + escapeHtml(w) + '</span>'; }).join('');
            }
        }
    }

    function switchToUserMode() {
        currentAnalysisMode = 'user';
        if (byAirlineData && byAirlineData.length > 0) {
            showLoading(false);
            showEmpty(false);
            showContent(true);
            if (airlineSelect) {
                airlineSelect.disabled = false;
            }
            populateDropdown();
            currentSelectedAirline = airlineSelect ? (airlineSelect.value || '').trim() || null : null;
            renderSections(currentSelectedAirline);
            bindReviewFilterButtons();
            loadAnalysisResultForAirline(currentSelectedAirline || '');
        } else {
            loadReviews();
        }
    }

    function switchToDatasetMode() {
        currentAnalysisMode = 'dataset';
        showLoading(false);
        showEmpty(false);
        showContent(true);

        airlinePages = {};

        if (airlineSelect) {
            airlineSelect.innerHTML = '<option value="">Veri kümesi henüz eklenmedi</option>';
            airlineSelect.disabled = true;
        }
        if (resultsCountEl) {
            resultsCountEl.textContent = '';
        }
        if (sectionsContainer) {
            sectionsContainer.innerHTML = '';
        }

        var overviewGrid = document.getElementById('airline-overview-grid');
        if (overviewGrid) {
            overviewGrid.innerHTML = '';
        }
        var overviewSection = document.getElementById('airline-overview-section');
        if (overviewSection) {
            overviewSection.style.display = 'block';
        }

        updateGeneralStats(null);

        // Duygu grafiği ve yorum sekmeleri – layout aynı, içerik boş
        var sentimentChartSection = document.getElementById('sentiment-chart-section');
        if (sentimentChartSection) {
            sentimentChartSection.style.display = 'block';
        }
        renderAnalysisResults({});
        updateAnalysisSummarySection('', null);

        // Yorum sekmeleri: veri kümesi modunda gerçek yorum göstermesin
        var listPos = document.getElementById('sentiment-list-positive');
        var listNeu = document.getElementById('sentiment-list-neutral');
        var listNeg = document.getElementById('sentiment-list-negative');
        var infoPos = document.getElementById('sentiment-page-info-positive');
        var infoNeu = document.getElementById('sentiment-page-info-neutral');
        var infoNeg = document.getElementById('sentiment-page-info-negative');
        if (listPos) listPos.innerHTML = '<p class="sentiment-tab-list-empty">Veri yok</p>';
        if (listNeu) listNeu.innerHTML = '<p class="sentiment-tab-list-empty">Veri yok</p>';
        if (listNeg) listNeg.innerHTML = '<p class="sentiment-tab-list-empty">Veri yok</p>';
        if (infoPos) infoPos.textContent = '';
        if (infoNeu) infoNeu.textContent = '';
        if (infoNeg) infoNeg.textContent = '';

        ['positive', 'neutral', 'negative'].forEach(function (key) {
            var prevBtn = document.getElementById('sentiment-page-prev-' + key);
            var nextBtn = document.getElementById('sentiment-page-next-' + key);
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
        });

        // Tüm havayolları için yapay zeka özeti: veri kümesi modunda gösterilmesin
        var allSummarySection = document.getElementById('all-airlines-summary-section');
        var allComplaintsList = document.getElementById('all-summary-complaints-list');
        var allLikedList = document.getElementById('all-summary-liked-list');
        if (allSummarySection) {
            allSummarySection.style.display = 'none';
        }
        if (allComplaintsList) {
            allComplaintsList.innerHTML = '<p class="summary-list-empty">Veri yok</p>';
        }
        if (allLikedList) {
            allLikedList.innerHTML = '<p class="summary-list-empty">Veri yok</p>';
        }

        var routeSection = document.querySelector('.route-satisfaction-section');
        if (routeSection) {
            routeSection.style.display = 'block';
        }

        // Çoklu havayolu karşılaştırması – boş görünüm
        var comparisonSection = document.getElementById('multi-airline-comparison-section');
        var sentimentListEl = document.getElementById('multi-airline-sentiment-list');
        if (comparisonSection) {
            comparisonSection.style.display = 'block';
        }
        if (sentimentListEl) {
            sentimentListEl.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
        }
        var trendCanvas = document.getElementById('multi-airline-volume-trend');
        if (multiAirlineTrendChart) {
            multiAirlineTrendChart.destroy();
            multiAirlineTrendChart = null;
        }
        if (trendCanvas) {
            var trendCtx = trendCanvas.getContext('2d');
            if (trendCtx) {
                trendCtx.clearRect(0, 0, trendCanvas.width, trendCanvas.height);
            }
        }

    }

    function bindAnalysisModeToggle() {
        var container = document.getElementById('analysis-mode-toggle');
        if (!container || bindAnalysisModeToggle.bound) return;
        bindAnalysisModeToggle.bound = true;

        container.addEventListener('click', function (evt) {
            var btn = evt.target.closest('.analysis-mode-pill');
            if (!btn) return;
            var mode = btn.getAttribute('data-mode') || 'user';
            if (mode === currentAnalysisMode) return;

            var pills = container.querySelectorAll('.analysis-mode-pill');
            pills.forEach(function (p) { p.classList.remove('is-active'); p.setAttribute('aria-selected', 'false'); });
            btn.classList.add('is-active');
            btn.setAttribute('aria-selected', 'true');

            if (mode === 'dataset') {
                switchToDatasetMode();
            } else {
                switchToUserMode();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            bindAnalysisModeToggle();
            loadReviews();
        });
    } else {
        bindAnalysisModeToggle();
        loadReviews();
    }
})();
