/**

 * Havayolu Yorumları – Onaylı yorumlar, havayolu seçimine göre listelenir.

 */

(function () {
    'use strict';
    var API_BASE = window.location.origin;
    
    // Ortak fonksiyonları kullan
    var Common = window.ReviewsCommon || {};
    var escapeHtml = Common.escapeHtml || function(s) { return s; };
    var setText = Common.setText || function() {};
    var formatDate = Common.formatDate || function(d) { return d; };
    var generateStars = Common.generateStars || function(r) { return ''; };
    var renderSummaryList = Common.renderSummaryList || function(i, n) { return ''; };
    var renderPaginatedSummaryList = Common.renderPaginatedSummaryList || function(i, n, p, c, l) { return ''; };
    var normalizeForGrouping = Common.normalizeForGrouping || function(t) { return t; };
    var areTopicsSimilar = Common.areTopicsSimilar || function(t1, t2) { return false; };
    var mergeDescriptions = Common.mergeDescriptions || function(e, n) { return n; };
    var groupSimilarTopics = Common.groupSimilarTopics || function(l, n) { return l; };

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
    var currentSortBy = 'date_desc'; // 'date_desc', 'date_asc', 'rating_desc', 'rating_asc'
    var airlinePages = {};
    var currentSelectedAirline = null;
    var currentAnalysisMode = 'user'; // 'user' | 'dataset'
    var REVIEWS_PER_PAGE = 5;
    // Summary list pagination variables
    var summaryComplaintsPage = 1;
    var summaryLikedListPage = 1;
    var SUMMARY_ITEMS_PER_PAGE = 5;
    var summaryComplaintsData = null;
    var summaryLikedListData = null;
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
    function getInitialsFromReview(review) {
        var first = (review.first_name || '').trim();
        var last = (review.last_name || '').trim();
        if (first || last) {
            var f = first ? first.charAt(0).toUpperCase() : '';
            var l = last ? last.charAt(0).toUpperCase() : '';
            return (f + l) || 'A';
        }
        var username = (review.user_name || review.username || '').trim();
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
        var stars = generateStars(rating);
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
        // Use unified review card rendering for user mode
        var cardsHtml = reviews.map(function (r) { 
            return currentAnalysisMode === 'user' ? renderAllReviewsCard(r) : renderReviewCard(r); 
        }).join('');
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
        // Dropdown'u her zaman enable et

        airlineSelect.disabled = false;
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
    var cachedGlobalTopics = null; // Global konuları önbellekte tut
    // Dataset modu için değişkenler
    var datasetByAirlineData = [];
    var datasetAirlinePages = {};
    var datasetRecommendationsPage = 1;
    var datasetRecommendationsPerPage = 5;
    var datasetLastRecommendationsData = null;
    var datasetSentimentChartInstance = null;
    var datasetScoreDistributionChart = null;
    var datasetTrendByFlightDateChart = null;
    var datasetScoreTrendChart = null;
    var datasetCurrentSentimentFilter = '';
    var datasetCurrentSearchQuery = '';
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
            var delayAnalysisSection = document.getElementById('delay-analysis-section');
            if (delayAnalysisSection) {
                delayAnalysisSection.style.display = 'none';
            }
            if (window.delayComplaintChart) {
                window.delayComplaintChart.destroy();
                window.delayComplaintChart = null;
            }
            if (window.averageDelayChart) {
                window.averageDelayChart.destroy();
                window.averageDelayChart = null;
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
            var delayAnalysisSectionEmpty = document.getElementById('delay-analysis-section');
            if (delayAnalysisSectionEmpty) {
                delayAnalysisSectionEmpty.style.display = 'none';
            }
            if (window.delayComplaintChart) {
                window.delayComplaintChart.destroy();
                window.delayComplaintChart = null;
            }
            if (window.averageDelayChart) {
                window.averageDelayChart.destroy();
                window.averageDelayChart = null;
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
        if (allSummarySectionReady && globalTopicsLoaded && currentAnalysisMode === 'user' && !currentSelectedAirline) {
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
            // Volume trend chart is now handled by renderTrendChart function
            // bindTrendYearFilter will be called after this block
        }
        
        comparisonSection.style.display = 'block';

        // Bind year filter event listener
        bindTrendYearFilter(cards);

        // Render delay complaint chart
        renderDelayComplaintChart(cards);

        // Render average delay duration chart
        renderAverageDelayDurationChart(cards);

        if (!globalTopicsLoaded) {
            loadGlobalTopicsOverview();
        }
    }

    function renderDelayComplaintChart(cards) {
        var delayAnalysisSection = document.getElementById('delay-analysis-section');
        if (!delayAnalysisSection) return;

        console.log('📊 renderDelayComplaintChart called with cards:', cards.length, 'cards');

        // Calculate delay complaint ratios for each airline
        var delayData = cards.map(function (c) {
            var reviews = c.reviews || [];
            var total = reviews.length;

            // If no reviews in cards, try to get from datasetByAirlineData (for dataset mode)
            if (total === 0 && currentAnalysisMode === 'dataset' && datasetByAirlineData.length > 0) {
                for (var i = 0; i < datasetByAirlineData.length; i++) {
                    var groupName = normalizeAirlineKey(datasetByAirlineData[i].airline_name);
                    var cardName = normalizeAirlineKey(c.name);
                    if (groupName === cardName) {
                        reviews = datasetByAirlineData[i].reviews || [];
                        total = reviews.length;
                        break;
                    }
                }
            }

            if (total === 0) return null;

            // Filter reviews that contain delay/reroute related keywords
            var delayKeywords = ['rötar', 'gecikme', 'gecik', 'ertel', 'beklet', 'sür', 'uzun', 'bekleme', 'saat', 'dakika'];
            var excludeKeywords = ['kaçırdım', 'kaçırdı', 'kaçır', 'check-in', 'check in', 'yanlış terminal', 'yanlış terminale', 'kendi hatam', 'kendi hatası', 'yeniden rezervasyon', 'aktar', 'aktarıldı', 'sonraki uçuş'];
            var delayCount = 0;

            reviews.forEach(function (r) {
                var content = (r.content || '').toLowerCase();
                var title = (r.title || '').toLowerCase();
                var combined = content + ' ' + title;

                var hasDelayKeyword = delayKeywords.some(function (keyword) {
                    return combined.includes(keyword);
                });

                var hasExcludeKeyword = excludeKeywords.some(function (keyword) {
                    return combined.includes(keyword);
                });

                if (hasDelayKeyword && !hasExcludeKeyword) {
                    delayCount++;
                }
            });

            var delayRatio = total > 0 ? (delayCount / total) * 100 : 0;

            return {
                name: c.name,
                delayRatio: delayRatio.toFixed(1),
                delayCount: delayCount,
                total: total
            };
        }).filter(function (d) { return d !== null; });

        console.log('📊 delayData calculated:', delayData.length, 'airlines with delay data');

        if (delayData.length === 0) {
            delayAnalysisSection.style.display = 'none';
            return;
        }

        delayAnalysisSection.style.display = 'block';

        // Destroy existing chart if any
        if (window.delayComplaintChart) {
            window.delayComplaintChart.destroy();
            window.delayComplaintChart = null;
        }

        // Sort by delay ratio (descending)
        delayData.sort(function (a, b) {
            return parseFloat(b.delayRatio) - parseFloat(a.delayRatio);
        });

        // Create horizontal bar chart
        var ctx = document.getElementById('delay-complaint-chart');
        if (!ctx) return;

        window.delayComplaintChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: delayData.map(function (d) { return d.name; }),
                datasets: [{
                    label: 'Rötar/Gecikme Şikayet Oranı (%)',
                    data: delayData.map(function (d) { return parseFloat(d.delayRatio); }),
                    backgroundColor: delayData.map(function (d) {
                        var ratio = parseFloat(d.delayRatio);
                        if (ratio > 30) return '#ef4444';
                        if (ratio > 20) return '#f97316';
                        if (ratio > 10) return '#eab308';
                        return '#22c55e';
                    }),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                var index = context.dataIndex;
                                var data = delayData[index];
                                return data.name + ': ' + data.delayRatio + '% (' + data.delayCount + '/' + data.total + ' yorum)';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Rötar/Gecikme Şikayet Oranı (%)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Havayolu Adı'
                        }
                    }
                }
            }
        });
    }
    
    function renderTrendChart(cards, selectedYear) {
        // Generate month keys and labels based on selected year
        var monthKeys = [];
        var monthLabels = [];
        for (var i = 0; i < 12; i++) {
            var y = parseInt(selectedYear);
            var m = i + 1;
            monthKeys.push(y + '-' + String(m).padStart(2, '0'));
            var monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
            monthLabels.push(monthNames[i]);
        }
        
        var datasets = [];
        var colorMap = {
            turkish: '#ef4444',
            pegasus: '#f97316',
            ajet: '#64748b',
            sunexpress: '#06b6d4'
        };
        
        // Check if we're in dataset mode (cards have time_trends) or user mode (cards have reviews)
        var isDatasetMode = cards.length > 0 && cards[0].time_trends !== undefined;
        
        cards.forEach(function (c, idx) {
            var monthly = {};
            monthKeys.forEach(function (k) { monthly[k] = 0; });
            
            if (isDatasetMode && c.time_trends) {
                // Dataset mode: use time_trends data
                c.time_trends.forEach(function (t) {
                    var period = t.period || '';
                    if (!period) return;
                    if (!monthly.hasOwnProperty(period)) return;
                    var count = parseInt(t.review_count, 10);
                    if (isNaN(count)) {
                        var p = parseInt(t.positive, 10) || 0;
                        var n = parseInt(t.negative, 10) || 0;
                        var u = parseInt(t.neutral, 10) || 0;
                        count = p + n + u;
                    }
                    monthly[period] += count;
                });
            } else if (c.reviews) {
                // User mode: use reviews data with travel_date
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
            }
            
            var dataPoints = monthKeys.map(function (k) { return monthly[k] || 0; });
            var color = isDatasetMode 
                ? (['#ef4444', '#06b6d4', '#22c55e', '#f97316', '#6366f1', '#64748b'][idx % 6])
                : (colorMap[c.key] || '#6366f1');
            datasets.push({
                label: c.name,
                data: dataPoints,
                borderColor: color,
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
    }
    
    var datasetTrendYearFilterListener = null; // Store listener to remove it later

    function bindTrendYearFilter(cards) {
        var yearFilter = document.getElementById('trend-year-filter');
        if (yearFilter) {
            // Remove old listener if exists to prevent duplicates
            if (datasetTrendYearFilterListener) {
                yearFilter.removeEventListener('change', datasetTrendYearFilterListener);
                datasetTrendYearFilterListener = null;
            }
            
            // Set default to current year
            var currentYear = new Date().getFullYear();
            yearFilter.value = String(currentYear);
            
            // Create new listener
            datasetTrendYearFilterListener = function () {
                var selectedYear = this.value;
                renderTrendChart(cards, selectedYear);
            };
            
            yearFilter.addEventListener('change', datasetTrendYearFilterListener);
            
            // Initial render with current year
            renderTrendChart(cards, String(currentYear));
        }
    }
    function restoreCachedGlobalTopics() {
        if (!cachedGlobalTopics || !globalTopicsLoaded) return;
        var allComplaintsList = document.getElementById('all-summary-complaints-list');
        var allLikedList = document.getElementById('all-summary-liked-list');
        
        // Store data for pagination
        summaryComplaintsData = cachedGlobalTopics.complaints;
        summaryLikedListData = cachedGlobalTopics.praises;
        
        // Reset pagination
        summaryComplaintsPage = 1;
        summaryLikedListPage = 1;
        
        if (allComplaintsList) allComplaintsList.innerHTML = renderPaginatedSummaryList.call(Common, cachedGlobalTopics.complaints, true, SUMMARY_ITEMS_PER_PAGE, summaryComplaintsPage, 'all-summary-complaints-list');
        if (allLikedList) allLikedList.innerHTML = renderPaginatedSummaryList.call(Common, cachedGlobalTopics.praises, false, SUMMARY_ITEMS_PER_PAGE, summaryLikedListPage, 'all-summary-liked-list');
        
        // Bind pagination events
        bindSummaryListPaginationEvents();
    }
    function loadGlobalTopicsOverview() {
        var complaintsEl = document.getElementById('global-complaints-list');
        var praisesEl = document.getElementById('global-praises-list');
        var allSummarySection = document.getElementById('all-airlines-summary-section');
        var allComplaintsList = document.getElementById('all-summary-complaints-list');
        var allLikedList = document.getElementById('all-summary-liked-list');
        if (!allSummarySection) return;
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
            // Ortak fonksiyonları kullan (this bağlamını korumak için .call kullan)
            var topComplaints = groupSimilarTopics.call(Common, complaints, complaints.length);
            var topPraises = groupSimilarTopics.call(Common, praises, praises.length);
            // Sonuçları önbellekle
            cachedGlobalTopics = {
                complaints: topComplaints,
                praises: topPraises
            };
            
            // Store data for pagination
            summaryComplaintsData = topComplaints;
            summaryLikedListData = topPraises;
            
            // Reset pagination
            summaryComplaintsPage = 1;
            summaryLikedListPage = 1;
            
            if (allComplaintsList) allComplaintsList.innerHTML = renderPaginatedSummaryList.call(Common, topComplaints, true, SUMMARY_ITEMS_PER_PAGE, summaryComplaintsPage, 'all-summary-complaints-list');
            if (allLikedList) allLikedList.innerHTML = renderPaginatedSummaryList.call(Common, topPraises, false, SUMMARY_ITEMS_PER_PAGE, summaryLikedListPage, 'all-summary-liked-list');
            
            // Bind pagination events
            bindSummaryListPaginationEvents();
            
            // Sadece kullanıcı yorumları modunda ve tüm havayolları seçiliyken gösterilecek
            // Not: onAirlineChange içinde de display ayarlanıyor, burada içerik varsa göster
            if (topComplaints.length || topPraises.length) {
                allSummarySection.style.display = 'block';
            }
            globalTopicsLoaded = true;
        }).catch(function (error) {
            console.error('Global topics yüklenirken hata:', error);
            // Hata durumunda bölümü gizle
            allSummarySection.style.display = 'none';
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
    function normalizeTurkishChars(str) {
        // Convert Turkish characters to their ASCII equivalents
        return str
            .replace(/ç/g, 'c')
            .replace(/ğ/g, 'g')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ş/g, 's')
            .replace(/ü/g, 'u')
            .replace(/Ç/g, 'C')
            .replace(/Ğ/g, 'G')
            .replace(/I/g, 'I')
            .replace(/Ö/g, 'O')
            .replace(/Ş/g, 'S')
            .replace(/Ü/g, 'U');
    }

    function matchesSearch(review, query) {
        if (!query) return true;
        var q = normalizeTurkishChars(String(query).toLowerCase());
        var content = normalizeTurkishChars(String(review.content || '').toLowerCase());
        var title = normalizeTurkishChars(String(review.title || '').toLowerCase());
        return content.indexOf(q) !== -1 || title.indexOf(q) !== -1;
    }
    
    function sortReviews(reviews, sortBy) {
        var sorted = reviews.slice(); // Copy array to avoid modifying original
        switch (sortBy) {
            case 'date_desc':
                sorted.sort(function (a, b) {
                    var dateA = new Date(a.review_date || 0);
                    var dateB = new Date(b.review_date || 0);
                    return dateB - dateA;
                });
                break;
            case 'date_asc':
                sorted.sort(function (a, b) {
                    var dateA = new Date(a.review_date || 0);
                    var dateB = new Date(b.review_date || 0);
                    return dateA - dateB;
                });
                break;
            case 'rating_desc':
                sorted.sort(function (a, b) {
                    var ratingA = parseFloat(a.rating) || 0;
                    var ratingB = parseFloat(b.rating) || 0;
                    return ratingB - ratingA;
                });
                break;
            case 'rating_asc':
                sorted.sort(function (a, b) {
                    var ratingA = parseFloat(a.rating) || 0;
                    var ratingB = parseFloat(b.rating) || 0;
                    return ratingA - ratingB;
                });
                break;
        }
        return sorted;
    }
    function renderSections(selectedAirline) {
        if (!sectionsContainer) return;
        
        // Always use unified design with filters for all cases in user mode
        if (currentAnalysisMode === 'user') {
            var allReviews = [];
            for (var i = 0; i < byAirlineData.length; i++) {
                var reviews = (byAirlineData[i].reviews || []).slice();
                allReviews = allReviews.concat(reviews);
            }
            
            // Filter by selected airline if specified
            var filteredReviews = allReviews;
            if (selectedAirline) {
                filteredReviews = allReviews.filter(function (r) {
                    // Find which airline this review belongs to
                    for (var j = 0; j < byAirlineData.length; j++) {
                        if (byAirlineData[j].airline_name === selectedAirline) {
                            return byAirlineData[j].reviews.includes(r);
                        }
                    }
                    return false;
                });
            }
            
            // Apply other filters
            filteredReviews = filteredReviews.filter(function (r) {
                if (!matchesDateRange(r, currentDateRange)) return false;
                if (!matchesSearch(r, currentSearchQuery)) return false;
                if (currentSentimentFilter) {
                    return getSentimentFromRatingValue(r.rating) === currentSentimentFilter;
                }
                return true;
            });
            
            // Apply sorting
            filteredReviews = sortReviews(filteredReviews, currentSortBy);
            
            var totalCount = filteredReviews.length;
            var totalPages = Math.max(1, Math.ceil(totalCount / REVIEWS_PER_PAGE));
            var sectionId = selectedAirline ? selectedAirline.replace(/\s+/g, '-').toLowerCase() : 'tum-yorumlar';
            var currentPage = airlinePages[sectionId] || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;
            airlinePages[sectionId] = currentPage;
            var start = (currentPage - 1) * REVIEWS_PER_PAGE;
            var pageReviews = filteredReviews.slice(start, start + REVIEWS_PER_PAGE);
            
            // Use unified design with filters
            var sectionTitle = selectedAirline || 'Tüm Yorumlar';
            var html = renderUnifiedSection(sectionTitle, pageReviews, currentPage, totalPages, totalCount, sectionId);
            sectionsContainer.innerHTML = html;
            updateResultsCountDisplay(totalCount);
            renderAirlineOverviewCards();
            
            // Add event listeners for the unified section
            bindUnifiedSectionEventListeners(sectionId);
            return;
        }
    }
    
    function updateUnifiedSectionReviews(sectionId, reviews, page, totalPages, totalCount) {
        // Only update the reviews list and pagination, not the entire section
        page = page || 1;
        totalPages = totalPages || 1;
        totalCount = totalCount || reviews.length;
        var startIndex = totalCount === 0 ? 0 : (page - 1) * REVIEWS_PER_PAGE + 1;
        var endIndex = Math.min(page * REVIEWS_PER_PAGE, totalCount);
        
        var reviewsListId = 'reviews-list-' + sectionId;
        var pageInfoId = 'page-info-' + sectionId;
        var prevBtnId = 'prev-btn-' + sectionId;
        var nextBtnId = 'next-btn-' + sectionId;
        
        var listEl = document.getElementById(reviewsListId);
        var pageInfoEl = document.getElementById(pageInfoId);
        var prevBtn = document.getElementById(prevBtnId);
        var nextBtn = document.getElementById(nextBtnId);
        
        if (listEl) {
            if (reviews.length === 0) {
                listEl.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">Gösterilecek yorum bulunamadı.</p>';
            } else {
                var cardsHtml = reviews.map(function (r) { 
                    return renderAllReviewsCard(r); 
                }).join('');
                listEl.innerHTML = cardsHtml;
            }
        }
        
        if (pageInfoEl) {
            pageInfoEl.textContent = totalCount ? ('Gösterilen ' + startIndex + '–' + endIndex + ' / ' + totalCount + ' yorum') : 'Yorum yok';
        }
        
        if (prevBtn) {
            prevBtn.disabled = page <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = page >= totalPages;
        }
    }

    function updateFilteredReviewsList(sectionId) {
        // Filter and update only the reviews list without re-rendering entire section
        var allReviews = [];
        for (var i = 0; i < byAirlineData.length; i++) {
            var reviews = (byAirlineData[i].reviews || []).slice();
            allReviews = allReviews.concat(reviews);
        }
        
        // Filter by selected airline if specified
        var filteredReviews = allReviews;
        if (currentSelectedAirline) {
            filteredReviews = allReviews.filter(function (r) {
                for (var j = 0; j < byAirlineData.length; j++) {
                    if (byAirlineData[j].airline_name === currentSelectedAirline) {
                        return byAirlineData[j].reviews.includes(r);
                    }
                }
                return false;
            });
        }
        
        // Apply other filters
        filteredReviews = filteredReviews.filter(function (r) {
            if (!matchesDateRange(r, currentDateRange)) return false;
            if (!matchesSearch(r, currentSearchQuery)) return false;
            if (currentSentimentFilter) {
                return getSentimentFromRatingValue(r.rating) === currentSentimentFilter;
            }
            return true;
        });
        
        // Apply sorting
        filteredReviews = sortReviews(filteredReviews, currentSortBy);
        
        var totalCount = filteredReviews.length;
        var totalPages = Math.max(1, Math.ceil(totalCount / REVIEWS_PER_PAGE));
        var currentPage = airlinePages[sectionId] || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        airlinePages[sectionId] = currentPage;
        var start = (currentPage - 1) * REVIEWS_PER_PAGE;
        var pageReviews = filteredReviews.slice(start, start + REVIEWS_PER_PAGE);
        
        // Update only the reviews list, not the entire section
        updateUnifiedSectionReviews(sectionId, pageReviews, currentPage, totalPages, totalCount);
        updateResultsCountDisplay(totalCount);
    }

    function renderUnifiedSection(sectionTitle, reviews, page, totalPages, totalCount, sectionId) {
        page = page || 1;
        totalPages = totalPages || 1;
        totalCount = totalCount || reviews.length;
        var startIndex = totalCount === 0 ? 0 : (page - 1) * REVIEWS_PER_PAGE + 1;
        var endIndex = Math.min(page * REVIEWS_PER_PAGE, totalCount);
        
        // Use unified review card rendering
        var cardsHtml = reviews.map(function (r) { 
            return renderAllReviewsCard(r); 
        }).join('');
        
        // Create unique IDs for this section
        var filterButtonsId = 'filter-buttons-' + sectionId;
        var searchInputId = 'search-input-' + sectionId;
        var sortSelectId = 'sort-select-' + sectionId;
        var reviewsListId = 'reviews-list-' + sectionId;
        var pageInfoId = 'page-info-' + sectionId;
        var prevBtnId = 'prev-btn-' + sectionId;
        var nextBtnId = 'next-btn-' + sectionId;
        
        return (
            '<section class="airline-section" data-airline="' + escapeHtml(sectionTitle) + '">' +
                '<div class="airline-section-header">' +
                    '<h2 class="airline-section-title"><i class="fas fa-comments"></i> ' + escapeHtml(sectionTitle) + '</h2>' +
                    '<span class="airline-section-count">' + totalCount + ' yorum</span>' +
                '</div>' +
                '<div class="airline-section-controls" style="margin-bottom: 1.5rem; display: flex; gap: 2rem; align-items: center; flex-wrap: wrap;">' +
                    '<div class="review-filter-left" style="display: flex; gap: 1rem; align-items: center;">' +
                        '<div class="review-filter-buttons" id="' + filterButtonsId + '">' +
                            '<button type="button" class="review-filter-btn" data-sentiment="">Tümü</button>' +
                            '<button type="button" class="review-filter-btn" data-sentiment="positive">Olumlu</button>' +
                            '<button type="button" class="review-filter-btn" data-sentiment="neutral">Nötr</button>' +
                            '<button type="button" class="review-filter-btn" data-sentiment="negative">Olumsuz</button>' +
                        '</div>' +
                        '<div class="review-search-wrapper">' +
                            '<i class="fas fa-search review-search-icon" aria-hidden="true"></i>' +
                            '<input type="search" id="' + searchInputId + '" class="review-search-input" placeholder="Aramak için kelime girin" aria-label="Yorumlarda kelime ara" style="width: 200px;">' +
                        '</div>' +
                    '</div>' +
                    '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
                        '<label for="' + sortSelectId + '" style="font-size: 0.875rem; font-weight: 500; color: #6b7280;">Sıralama:</label>' +
                        '<select id="' + sortSelectId + '" style="padding: 0.375rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; background: white; color: #374151;">' +
                            '<option value="date_desc" selected>Yeniden Eskiye</option>' +
                            '<option value="date_asc">Eskiden Yeniye</option>' +
                            '<option value="rating_desc">Yüksek Puandan Düşük Puana</option>' +
                            '<option value="rating_asc">Düşük Puandan Yüksek Puana</option>' +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div id="' + reviewsListId + '" class="airline-reviews-list">' + cardsHtml + '</div>' +
                '<div class="airline-section-footer">' +
                    '<span id="' + pageInfoId + '" class="airline-section-page-info">' + (totalCount ? ('Gösterilen ' + startIndex + '–' + endIndex + ' / ' + totalCount + ' yorum') : 'Yorum yok') + '</span>' +
                    (totalPages > 1 ? (
                        '<div class="airline-section-pager">' +
                            '<button type="button" id="' + prevBtnId + '" class="airline-page-btn" data-airline="' + escapeHtml(sectionTitle) + '" data-dir="prev"' + (page <= 1 ? ' disabled' : '') + '>Önceki</button>' +
                            '<button type="button" id="' + nextBtnId + '" class="airline-page-btn" data-airline="' + escapeHtml(sectionTitle) + '" data-dir="next"' + (page >= totalPages ? ' disabled' : '') + '>Sonraki</button>' +
                        '</div>'
                    ) : '') +
                '</div>' +
            '</section>'
        );
    }
    
    function bindUnifiedSectionEventListeners(sectionId) {
        var filterButtons = document.getElementById('filter-buttons-' + sectionId);
        var searchInput = document.getElementById('search-input-' + sectionId);
        var sortSelect = document.getElementById('sort-select-' + sectionId);
        
        // Filter buttons
        if (filterButtons) {
            // Set initial active state
            var allBtns = filterButtons.querySelectorAll('.review-filter-btn');
            allBtns.forEach(function (b) { 
                if (b.getAttribute('data-sentiment') === '') {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            
            filterButtons.addEventListener('click', function (evt) {
                var btn = evt.target.closest('.review-filter-btn');
                if (!btn) return;
                var sentiment = btn.getAttribute('data-sentiment');
                currentSentimentFilter = sentiment;
                airlinePages = {};
                // Only update the reviews list, don't re-render entire section
                updateFilteredReviewsList(sectionId);
            });
        }
        
        // Search input
        if (searchInput) {
            var searchTimeout;
            searchInput.addEventListener('input', function () {
                var value = this.value.trim();
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(function () {
                    currentSearchQuery = value.toLowerCase();
                    airlinePages = {};
                    // Only update the reviews list, don't re-render entire section
                    updateFilteredReviewsList(sectionId);
                }, 200);
            });
        }
        
        // Sort select
        if (sortSelect) {
            // Set initial value
            sortSelect.value = currentSortBy;
            
            sortSelect.addEventListener('change', function () {
                currentSortBy = this.value;
                airlinePages = {}; // Reset pagination when sort changes
                // Only update the reviews list, don't re-render entire section
                updateFilteredReviewsList(sectionId);
            });
        }
        
        // Pagination buttons
        sectionsContainer.addEventListener('click', function (evt) {
            var btn = evt.target.closest('.airline-page-btn');
            if (!btn) return;
            var airline = btn.getAttribute('data-airline');
            var dir = btn.getAttribute('data-dir');
            if (!airline || !dir) return;
            var currentPage = airlinePages[sectionId] || 1;
            if (dir === 'prev') currentPage -= 1;
            if (dir === 'next') currentPage += 1;
            airlinePages[sectionId] = currentPage;
            renderSections(currentSelectedAirline);
        });
    }
    
    function onAirlineChange() {
        console.log('✈️ Havayolu değişti - mod:', currentAnalysisMode);
        var value = airlineSelect && airlineSelect.value ? airlineSelect.value.trim() : '';
        currentSelectedAirline = value || null;
        console.log('🎯 Yeni seçili havayolu:', currentSelectedAirline);
        // Dataset modunda değilse, normal kullanıcı verilerini kullan

        if (currentAnalysisMode !== 'dataset') {
            console.log('📊 Kullanıcı modu - airline pages reset');
            airlinePages = {};
            renderSections(currentSelectedAirline);
            loadAnalysisResultForAirline(value || '');
            // Global özeti kontrol et - Tüm Havayolları seçiliyken göster

            if (!currentSelectedAirline && !globalTopicsLoaded) {
                loadGlobalTopicsOverview();
            }
        } else {
            console.log('🗂️ Dataset modu - dataset airline pages reset');
            datasetAirlinePages = {};
            // Reset sentiment filter and search query when airline changes in dataset mode
            datasetCurrentSentimentFilter = '';
            datasetCurrentSearchQuery = '';
            renderDatasetSections(currentSelectedAirline);
            loadDatasetAnalysisForAirline(value || '');
        }
        // Kullanıcı yorum analizi modunda: sadece Tüm Havayolları seçiliyken global özet görünsün

        var allSummarySection = document.getElementById('all-airlines-summary-section');
        if (allSummarySection) {
            if (currentAnalysisMode === 'user' && !currentSelectedAirline) {
                // Global özet verisi yüklenmişse göster, yüklenmemişse yükle
                if (globalTopicsLoaded && cachedGlobalTopics) {
                    restoreCachedGlobalTopics();
                } else if (!globalTopicsLoaded && !cachedGlobalTopics) {
                    loadGlobalTopicsOverview();
                }
                allSummarySection.style.display = 'block';
            } else {
                allSummarySection.style.display = 'none';
            }
        }
        
        // Tüm Yorumlar bölümünü göster/gizle
        var allReviewsSection = document.getElementById('all-reviews-section');
        if (allReviewsSection) {
            if (currentAnalysisMode === 'dataset') {
                // Dataset modunda göster
                if (!currentSelectedAirline) {
                    if (allReviewsState.reviews.length === 0) {
                        loadAllReviews();
                    } else {
                        allReviewsSection.style.display = 'block';
                    }
                } else {
                    allReviewsSection.style.display = 'none';
                }
            } else {
                // User modunda her zaman gizle (unified section kullanıyoruz)
                allReviewsSection.style.display = 'none';
            }
        }
    }
    function loadReviews() {
        if (currentAnalysisMode !== 'user') {
            return;
        }
        if (!sectionsContainer) return;
        showLoading(true);
        // Dataset modundan kalan sonuç sayısını temizle

        if (resultsCountEl) {
            resultsCountEl.textContent = '';
        }
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
                if (airlineSelect) {
                    airlineSelect.disabled = false;
                }
                currentSelectedAirline = airlineSelect ? (airlineSelect.value || '').trim() || null : null;
                renderSections(currentSelectedAirline);
                showContent(true);
                // Global özeti her zaman yükle - Tüm Havayolları seçiliyse

                if (!currentSelectedAirline) {
                    loadGlobalTopicsOverview();
                }
                // Not: Global özetin gösterilmesi loadGlobalTopicsOverview içinde yapılıyor

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
    var scoreTrendChart = null;
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
        // Sonuç sayısını güncelle - kullanıcı verilerinden

        var totalReviews = 0;
        for (var i = 0; i < byAirlineData.length; i++) {
            if (byAirlineData[i].airline_name === airline) {
                totalReviews = (byAirlineData[i].reviews || []).length;
                break;
            }
        }
        if (resultsCountEl) {
            resultsCountEl.textContent = totalReviews + ' yorum';
        }
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
        // Trend chart'ları destroy et
        if (trendByFlightDateChart) {
            trendByFlightDateChart.destroy();
            trendByFlightDateChart = null;
        }
        if (datasetTrendByFlightDateChart) {
            datasetTrendByFlightDateChart.destroy();
            datasetTrendByFlightDateChart = null;
        }
        if (scoreTrendChart) {
            scoreTrendChart.destroy();
            scoreTrendChart = null;
        }
        if (datasetScoreTrendChart) {
            datasetScoreTrendChart.destroy();
            datasetScoreTrendChart = null;
        }
        var complaintsList = document.getElementById('summary-complaints-list');
        var likedList = document.getElementById('summary-liked-list');
        if (!complaintsList || !likedList) return;
        var rawComplaints = (data && data.most_complained_topics) ? data.most_complained_topics : [];
        var rawLiked = (data && data.most_liked_aspects) ? data.most_liked_aspects : [];
        // Ortak fonksiyonları kullan (this bağlamını korumak için .call kullan)
        var complaints = groupSimilarTopics.call(Common, rawComplaints, 10);
        var liked = groupSimilarTopics.call(Common, rawLiked, 10);
        
        // Store data for pagination
        summaryComplaintsData = complaints;
        summaryLikedListData = liked;
        
        // Reset pagination
        summaryComplaintsPage = 1;
        summaryLikedListPage = 1;
        
        // Render with pagination
        complaintsList.innerHTML = renderPaginatedSummaryList.call(Common, complaints, true, SUMMARY_ITEMS_PER_PAGE, summaryComplaintsPage, 'summary-complaints-list');
        likedList.innerHTML = renderPaginatedSummaryList.call(Common, liked, false, SUMMARY_ITEMS_PER_PAGE, summaryLikedListPage, 'summary-liked-list');
        
        // Bind pagination events
        bindSummaryListPaginationEvents();
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
        // Uçuş tarihine göre yorum trendi - yıl filtresi ile
        bindFlightTrendYearFilter(reviews);
        
        // Son 12 ay puan trendi - yıl filtresi ile
        bindScoreTrendYearFilter(reviews);
    }
    
    // Global variables to store event listeners for year filters
    var flightTrendYearFilterListener = null;
    var scoreTrendYearFilterListener = null;
    
    function renderFlightDateTrendChart(reviews, selectedYear) {
        // Generate month keys and labels for selected year
        var monthKeys = [];
        var monthLabels = [];
        for (var i = 0; i < 12; i++) {
            var m = i + 1;
            monthKeys.push(selectedYear + '-' + String(m).padStart(2, '0'));
            var monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
            monthLabels.push(monthNames[i]);
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
    
    function renderScoreTrendChart(reviews, selectedYear) {
        // Generate month keys and labels for selected year
        var monthKeys = [];
        var monthLabels = [];
        for (var i = 0; i < 12; i++) {
            var m = i + 1;
            monthKeys.push(selectedYear + '-' + String(m).padStart(2, '0'));
            var monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
            monthLabels.push(monthNames[i]);
        }
        
        var monthlyScores = {};
        monthKeys.forEach(function(k) { monthlyScores[k] = { sum: 0, count: 0 }; });
        reviews.forEach(function(r) {
            var d = r.travel_date;
            if (!d) return;
            var date = new Date(d);
            if (isNaN(date.getTime())) return;
            var y = date.getFullYear();
            var m = date.getMonth() + 1;
            var key = y + '-' + String(m).padStart(2, '0');
            if (monthlyScores.hasOwnProperty(key)) {
                var rating = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 0));
                monthlyScores[key].sum += rating;
                monthlyScores[key].count++;
            }
        });
        var avgScores = monthKeys.map(function(k) {
            var data = monthlyScores[k];
            return data.count > 0 ? (data.sum / data.count).toFixed(2) : null;
        });
        
        if (scoreTrendChart) {
            scoreTrendChart.destroy();
            scoreTrendChart = null;
        }
        var scoreTrendCanvas = document.getElementById('score-trend-chart');
        if (scoreTrendCanvas && typeof Chart !== 'undefined') {
            var scoreCtx = scoreTrendCanvas.getContext('2d');
            scoreTrendChart = new Chart(scoreCtx, {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [{
                        label: 'Ortalama Puan',
                        data: avgScores,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        fill: true,
                        tension: 0.3,
                        spanGaps: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: 1,
                            max: 5,
                            title: { display: true, text: 'Ortalama Puan' },
                            ticks: { stepSize: 0.5 }
                        },
                        x: {
                            title: { display: true, text: 'Ay' }
                        }
                    }
                }
            });
        }
    }
    
    function bindFlightTrendYearFilter(reviews) {
        var yearFilter = document.getElementById('flight-trend-year-filter');
        if (yearFilter) {
            // Remove old listener if exists
            if (flightTrendYearFilterListener) {
                yearFilter.removeEventListener('change', flightTrendYearFilterListener);
                flightTrendYearFilterListener = null;
            }
            
            // Set default to current year
            var currentYear = new Date().getFullYear();
            yearFilter.value = String(currentYear);
            
            // Create new listener
            flightTrendYearFilterListener = function () {
                var selectedYear = this.value;
                renderFlightDateTrendChart(reviews, selectedYear);
            };
            
            yearFilter.addEventListener('change', flightTrendYearFilterListener);
            
            // Initial render with current year
            renderFlightDateTrendChart(reviews, String(currentYear));
        }
    }
    
    function bindScoreTrendYearFilter(reviews) {
        var yearFilter = document.getElementById('score-trend-year-filter');
        if (yearFilter) {
            // Remove old listener if exists
            if (scoreTrendYearFilterListener) {
                yearFilter.removeEventListener('change', scoreTrendYearFilterListener);
                scoreTrendYearFilterListener = null;
            }
            
            // Set default to current year
            var currentYear = new Date().getFullYear();
            yearFilter.value = String(currentYear);
            
            // Create new listener
            scoreTrendYearFilterListener = function () {
                var selectedYear = this.value;
                renderScoreTrendChart(reviews, selectedYear);
            };
            
            yearFilter.addEventListener('change', scoreTrendYearFilterListener);
            
            // Initial render with current year
            renderScoreTrendChart(reviews, String(currentYear));
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
        var repeatRingBgEl = document.querySelector('.route-loyalty-ring-bg');
        if (repeatPercentEl) {
            var sdLocal = data && data.sentiment_distribution ? data.sentiment_distribution : {};
            var pos = parseInt(sdLocal.positive, 10) || 0;
            var neg = parseInt(sdLocal.negative, 10) || 0;
            var neu = parseInt(sdLocal.neutral, 10) || 0;
            var totalSent = pos + neg + neu;
            var posPct = totalSent ? (pos / totalSent) : 0;
            var negPct = totalSent ? (neg / totalSent) : 0;
            var netScore = posPct - negPct; // -1 ile +1 arasi
            var loyaltyScore = totalSent ? Math.round((netScore + 1) * 50) : 0; // 0 ile 100 arasi
            repeatPercentEl.textContent = '%' + loyaltyScore;
            var ringColor;
            if (loyaltyScore <= 33) {
                ringColor = '#ef4444'; // Kırmızı - Düşük
            } else if (loyaltyScore <= 66) {
                ringColor = '#eab308'; // Sarı - Orta
            } else {
                ringColor = '#22c55e'; // Yeşil - Yüksek
            }
            repeatPercentEl.style.color = ringColor;
            if (repeatRingBgEl) {
                repeatRingBgEl.style.background = 'conic-gradient(' + ringColor + ' 0 ' + loyaltyScore + '%, #e5e7eb ' + loyaltyScore + '% 100%)';
            }
            if (repeatTextEl) {
                if (!totalSent) {
                    repeatTextEl.textContent = 'Yeterli veri bulunmuyor.';
                } else if (loyaltyScore <= 20) {
                    repeatTextEl.textContent = 'Önemli bir kısmı tekrar tercih etmeyi düşünmüyor.';
                } else if (loyaltyScore <= 40) {
                    repeatTextEl.textContent = 'Bir kısmı tekrar tercih etmeyi düşünmüyor.';
                } else if (loyaltyScore <= 60) {
                    repeatTextEl.textContent = 'Kararsız bir çoğunluk tekrar tercih etmeyi düşünüyor.';
                } else if (loyaltyScore <= 80) {
                    repeatTextEl.textContent = 'Çoğu tekrar tercih etmeyi düşünüyor.';
                } else {
                    repeatTextEl.textContent = 'Önemli bir kısmı tekrar tercih etmeyi düşünüyor.';
                }
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
                        avg: avg,
                        count: stat.count
                    };
                }).filter(function (row) {
                    return row.count > 0;
                });
                if (!rows.length) {
                    routeList.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
                } else {
                    // En çok tercih edilen (yorum sayısı en yüksek) ilk 8 rotayı göster
                    // Eşitlik durumunda en yüksek puanlıyı al
                    rows.sort(function (a, b) {
                        if (b.count !== a.count) return b.count - a.count;
                        return b.avg - a.avg;
                    });
                    var topRows = rows.slice(0, 8);
                    routeList.innerHTML = topRows.map(function (row) {
                        var avgFixed = row.avg.toFixed(1);
                        // 5 farklı renk aralığı: mükemmel, iyi, orta, zayıf, kötü
                        var cls = 'route-score-neutral';
                        var barColor = '#f59e0b'; // turuncu (3.x için)
                        if (row.avg >= 4.5) {
                            cls = 'route-score-excellent'; // 4.5-5.0
                            barColor = '#22c55e'; // yeşil
                        } else if (row.avg >= 4.0) {
                            cls = 'route-score-good'; // 4.0-4.4
                            barColor = '#3b82f6'; // mavi
                        } else if (row.avg >= 3.0) {
                            cls = 'route-score-average'; // 3.0-3.9
                            barColor = '#f59e0b'; // turuncu
                        } else if (row.avg >= 2.0) {
                            cls = 'route-score-weak'; // 2.0-2.9
                            barColor = '#f97316'; // koyu turuncu
                        } else {
                            cls = 'route-score-poor'; // 1.0-1.9
                            barColor = '#ef4444'; // kırmızı
                        }
                        var width = Math.max(10, Math.min(100, Math.round((row.avg / 5) * 100)));
                        var countText = row.count + ' yorum';
                        return '' +
                            '<div class="route-row">' +
                                '<div class="route-name">' + escapeHtml(row.route) + '</div>' +
                                '<div class="route-row-bar-track"><div class="route-row-bar-fill" style="width:' + width + '%;background:' + barColor + ';"></div></div>' +
                                '<div class="route-score-container">' +
                                    '<div class="route-score-inline">' +
                                        '<span class="route-score ' + cls + '">' + escapeHtml(avgFixed) + '</span>' +
                                        '<span class="route-count">' + escapeHtml(countText) + '</span>' +
                                    '</div>' +
                                '</div>' +
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
        console.log('Kullanici moduna geciliyor...');
        currentAnalysisMode = 'user';
        
        // Clear all reviews section and reset state
        var allReviewsSection = document.getElementById('all-reviews-section');
        if (allReviewsSection) {
            allReviewsSection.style.display = 'none';
        }
        var allReviewsList = document.getElementById('all-reviews-list');
        if (allReviewsList) {
            allReviewsList.innerHTML = '';
        }
        // Reset all reviews state
        allReviewsState.reviews = [];
        allReviewsState.currentPage = 1;
        allReviewsState.totalCount = 0;
        allReviewsState.totalPages = 0;
        allReviewsState.sentimentFilter = '';
        allReviewsState.searchQuery = '';
        
        // Reset filter buttons to "Tümü"
        var filterButtons = document.getElementById('all-reviews-filter-buttons');
        if (filterButtons) {
            var allBtns = filterButtons.querySelectorAll('.review-filter-btn');
            allBtns.forEach(function (b) { 
                if (b.getAttribute('data-sentiment') === '') {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
        }
        
        // Reset search input
        var searchInput = document.getElementById('all-reviews-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Reset sort select
        var sortSelect = document.getElementById('all-reviews-sort-select');
        if (sortSelect) {
            sortSelect.value = 'date_desc';
        }
        
        // If all airlines are selected, load and show all reviews
        if (!currentSelectedAirline) {
            loadAllReviews();
        }
        
        // Dataset chart'larını destroy et
        if (datasetSentimentChartInstance) {
            datasetSentimentChartInstance.destroy();
            datasetSentimentChartInstance = null;
        }
        if (datasetTrendByFlightDateChart) {
            datasetTrendByFlightDateChart.destroy();
            datasetTrendByFlightDateChart = null;
        }
        if (datasetScoreDistributionChart) {
            datasetScoreDistributionChart.destroy();
            datasetScoreDistributionChart = null;
        }
        // Dropdown'u tamamen sıfırla ve event listener'ları kaldır

        if (airlineSelect) {
            // Yeni bir dropdown element oluştur (event listener'ları temizlemek için)

            var newSelect = airlineSelect.cloneNode(false);
            airlineSelect.parentNode.replaceChild(newSelect, airlineSelect);
            airlineSelect = newSelect;
            airlineSelect.innerHTML = '<option value="">Yukleniyor...</option>';
            airlineSelect.disabled = true;
            // Dataset event listener'ını kaldır

            airlineSelect.__datasetBound = false;
        }
        // Tüm widget'ları sıfırla

        resetUserWidgets();
        // Kullanıcı verilerini yeniden yükle

        console.log('Kullanici verileri yeniden yukleniyor...');
        loadReviews();
    }
    function resetUserWidgets() {
        console.log('Kullanici widgetlari sifirlaniyor...');
        // Global topics flag'ını reset et

        globalTopicsLoaded = false;
        // Bölümleri gizle

        var generalStatsSection = document.getElementById('general-stats-section');
        var sentimentChartSection = document.getElementById('sentiment-chart-section');
        var summarySection = document.getElementById('analysis-summary-section');
        var routeSection = document.querySelector('.route-satisfaction-section');
        var overviewSection = document.getElementById('airline-overview-section');
        var comparisonSection = document.getElementById('multi-airline-comparison-section');
        var allSummarySection = document.getElementById('all-airlines-summary-section');
        if (generalStatsSection) generalStatsSection.style.display = 'none';
        if (sentimentChartSection) sentimentChartSection.style.display = 'none';
        if (summarySection) summarySection.style.display = 'none';
        if (routeSection) routeSection.style.display = 'none';
        if (overviewSection) overviewSection.style.display = 'none';
        if (comparisonSection) comparisonSection.style.display = 'none';
        if (allSummarySection) allSummarySection.style.display = 'none';
        // İçeriği temizle

        if (sectionsContainer) {
            sectionsContainer.innerHTML = '';
        }
        // Sonuç sayısını temizle

        if (resultsCountEl) {
            resultsCountEl.textContent = '';
        }
        console.log('Kullanici widgetlari sifirlandi');
    }
    function switchToDatasetMode() {
        currentAnalysisMode = 'dataset';
        
        // Clear all reviews section and reset state
        var allReviewsSection = document.getElementById('all-reviews-section');
        if (allReviewsSection) {
            allReviewsSection.style.display = 'none';
        }
        var allReviewsList = document.getElementById('all-reviews-list');
        if (allReviewsList) {
            allReviewsList.innerHTML = '';
        }
        // Reset all reviews state
        allReviewsState.reviews = [];
        allReviewsState.currentPage = 1;
        allReviewsState.totalCount = 0;
        allReviewsState.totalPages = 0;
        allReviewsState.sentimentFilter = '';
        allReviewsState.searchQuery = '';
        
        // Reset filter buttons to "Tümü"
        var filterButtons = document.getElementById('all-reviews-filter-buttons');
        if (filterButtons) {
            var allBtns = filterButtons.querySelectorAll('.review-filter-btn');
            allBtns.forEach(function (b) { 
                if (b.getAttribute('data-sentiment') === '') {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
        }
        
        // Reset search input
        var searchInput = document.getElementById('all-reviews-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Reset sort select
        var sortSelect = document.getElementById('all-reviews-sort-select');
        if (sortSelect) {
            sortSelect.value = 'date_desc';
        }
        
        showLoading(false);
        showEmpty(false);
        showContent(true);
        // Kullanıcı chart'larını destroy et

        if (sentimentChartInstance) {
            sentimentChartInstance.destroy();
            sentimentChartInstance = null;
        }
        if (trendByFlightDateChart) {
            trendByFlightDateChart.destroy();
            trendByFlightDateChart = null;
        }
        if (scoreDistributionChart) {
            scoreDistributionChart.destroy();
            scoreDistributionChart = null;
        }
        if (scoreTrendChart) {
            scoreTrendChart.destroy();
            scoreTrendChart = null;
        }
        if (multiAirlineTrendChart) {
            multiAirlineTrendChart.destroy();
            multiAirlineTrendChart = null;
        }
        airlinePages = {};
        if (airlineSelect) {
            airlineSelect.innerHTML = '<option value="">Yükleniyor...</option>';
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
        // Dataset modunu başlat - dataset sayfasındaki mantığı çağır

        initDatasetMode();
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
    function initDatasetMode() {
        console.log('🚀 Dataset modu başlatılıyor...');
        showLoading(true);
        resetDatasetWidgets();
        
        // Reset sentiment filter and search query when initializing dataset mode
        datasetCurrentSentimentFilter = '';
        datasetCurrentSearchQuery = '';
        
        // Promise.all ile iki API çağrısını paralel yap ve hataları yönet

        console.log('📡 API çağrıları başlatılıyor...');
        Promise.all([
            fetch(API_BASE + '/api/airline-reviews-dataset/reviews-by-airline')
                .then(function (res) {
                    console.log('✅ Reviews API response status:', res.status);
                    return res.ok ? res.json() : { by_airline: [] };
                })
                .catch(function (error) {
                    console.error('❌ Dataset reviews yüklenemedi:', error);
                    return { by_airline: [] };
                }),
            fetch(API_BASE + '/api/airline-reviews-dataset/airlines')
                .then(function (res) {
                    console.log('✅ Airlines API response status:', res.status);
                    return res.ok ? res.json() : [];
                })
                .catch(function (error) {
                    console.error('❌ Dataset havayolları yüklenemedi:', error);
                    return [];
                })
        ]).then(function (results) {
            console.log('📊 API sonuçları:', results);
            var payload = results[0];
            var airlines = results[1];
            showLoading(false);
            console.log('⏹️ Loading kapatıldı');
            // Dataset yorumlarını işle

            var groups = payload && payload.by_airline;
            console.log('📝 Dataset yorum grupları:', groups);
            if (groups && Array.isArray(groups) && groups.length) {
                datasetByAirlineData = groups;
                datasetAirlinePages = {};
                renderDatasetSections(null);
                console.log('📋 Dataset bölümleri render edildi');
            }
            // Havayollarını işle

            if (!airlines || !airlines.length) {
                console.log('⚠️ Havayolları listesi boş');
                populateDatasetAirlineDropdown([]);
                showEmpty(true);
                return;
            }
            console.log('✈️ Havayolları yükleniyor:', airlines);
            populateDatasetAirlineDropdown(airlines);
            showEmpty(false);
            if (airlineSelect && !airlineSelect.__datasetBound) {
                airlineSelect.__datasetBound = true;
                airlineSelect.addEventListener('change', function () {
                    var valChange = airlineSelect.value || '';
                    console.log('🔄 Havayolu değişti:', valChange);
                    loadDatasetAnalysisForAirline(valChange || '');
                });
            }
            // Sayfa açıldığında varsayılan olarak Tüm Havayolları (global) analizini göster
            if (airlineSelect && airlines.length > 0) {
                console.log('🌍 Tüm havayolları için global analiz başlatılıyor');
                airlineSelect.value = '';
                loadDatasetAnalysisForAirline('');
            }
            // Dataset modu başarıyla başlatıldıktan sonra tüm yorumları yükle
            loadAllReviews();
        }).catch(function (error) {
            console.error('💥 Dataset modu başlatılamadı:', error);
            showLoading(false);
            showEmpty(true);
        });
    }
    function resetDatasetWidgets() {
        if (sectionsContainer) {
            sectionsContainer.innerHTML = '';
        }
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
            if (el) el.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
        });
        var sentimentLists = [
            'sentiment-list-positive',
            'sentiment-list-neutral',
            'sentiment-list-negative',
        ];
        sentimentLists.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.innerHTML = '<p class="sentiment-tab-list-empty">Bu kategoride henüz yorum yok.</p>';
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
        var centerText = document.getElementById('sentiment-center-text');
        if (centerText) {
            var valueEl = centerText.querySelector('.sentiment-center-value');
            var labelEl = centerText.querySelector('.sentiment-center-label');
            if (valueEl) valueEl.textContent = '0';
            if (labelEl) labelEl.textContent = 'Toplam';
        }
        setText('route-repeat-percent', '%0');
        var repeatTextEl = document.getElementById('route-repeat-text');
        if (repeatTextEl) {
            repeatTextEl.textContent = 'Yeterli veri bulunmuyor.';
        }
        var repeatRingBgEl = document.querySelector('.route-loyalty-ring-bg');
        if (repeatRingBgEl) {
            repeatRingBgEl.style.background = 'conic-gradient(#22c55e 0 0%, #e5e7eb 0% 100%)';
        }
        // Tüm dataset chart'larını destroy et

        if (datasetSentimentChartInstance) {
            datasetSentimentChartInstance.destroy();
            datasetSentimentChartInstance = null;
        }
        if (datasetTrendByFlightDateChart) {
            datasetTrendByFlightDateChart.destroy();
            datasetTrendByFlightDateChart = null;
        }
        if (datasetScoreDistributionChart) {
            datasetScoreDistributionChart.destroy();
            datasetScoreDistributionChart = null;
        }
        if (datasetScoreTrendChart) {
            datasetScoreTrendChart.destroy();
            datasetScoreTrendChart = null;
        }
    }
    function populateDatasetAirlineDropdown(list) {
        if (!airlineSelect) return;
        airlineSelect.innerHTML = '';
        // İlk seçenek: Tüm Havayolları (global analiz)

        var allOpt = document.createElement('option');
        allOpt.value = '';
        allOpt.textContent = 'Tüm Havayolları';
        airlineSelect.appendChild(allOpt);
        if (!list || !list.length) {
            airlineSelect.disabled = true;
            return;
        }
        airlineSelect.disabled = false;
        list.forEach(function (name) {
            var opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            airlineSelect.appendChild(opt);
        });
    }
    function renderDatasetReviewCard(review) {
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
        var stars = generateStars(rating);
        return (
            '<div class="review-card">' +
                '<div class="review-card-meta">' +
                    '<span class="review-avatar-circle ' + avatarColorClass + '" aria-hidden="true">' + escapeHtml(initials) + '</span>' +
                    '<span class="review-username">' + escapeHtml(username) + '</span>' +
                    (contributions && contributions > 1
                        ? '<span class="review-contributions" title="Bu kullanıcının dataset içindeki yorum sayısı">' +
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
    function renderDatasetAirlineSection(airlineName, reviews, page, totalPages, totalCount) {
        page = page || 1;
        totalPages = totalPages || 1;
        totalCount = totalCount || reviews.length;
        var startIndex = totalCount === 0 ? 0 : (page - 1) * REVIEWS_PER_PAGE + 1;
        var endIndex = Math.min(page * REVIEWS_PER_PAGE, totalCount);
        var cardsHtml = reviews.map(function (r) { return renderDatasetReviewCard(r); }).join('');
        return (
            '<section class="airline-section" data-airline="' + escapeHtml(airlineName) + '">' +
                '<div class="airline-section-header">' +
                    '<h2 class="airline-section-title"><i class="fas fa-plane"></i> ' + escapeHtml(airlineName) + '</h2>' +
                    '<span class="airline-section-count">' + totalCount + ' yorum</span>' +
                '</div>' +
                '<div class="airline-reviews-list">' + cardsHtml + '</div>' +
                '<div class="airline-section-footer">' +
                    '<span class="airline-section-page-info">' +
                        (totalCount ? ('Gösterilen ' + startIndex + '–' + endIndex + ' / ' + totalCount + ' yorum') : 'Yorum yok') +
                    '</span>' +
                    (totalPages > 1
                        ? '<div class="airline-section-pager">' +
                              '<button type="button" class="airline-page-btn" data-airline="' + escapeHtml(airlineName) + '" data-dir="prev"' + (page <= 1 ? ' disabled' : '') + '>Önceki</button>' +
                              '<button type="button" class="airline-page-btn" data-airline="' + escapeHtml(airlineName) + '" data-dir="next"' + (page >= totalPages ? ' disabled' : '') + '>Sonraki</button>' +
                          '</div>'
                        : '') +
                '</div>' +
            '</section>'
        );
    }
    function renderDatasetUnifiedSection(sectionTitle, reviews, page, totalPages, totalCount, sectionId) {
        page = page || 1;
        totalPages = totalPages || 1;
        totalCount = totalCount || reviews.length;
        var startIndex = totalCount === 0 ? 0 : (page - 1) * REVIEWS_PER_PAGE + 1;
        var endIndex = Math.min(page * REVIEWS_PER_PAGE, totalCount);
        
        // Use dataset review card rendering
        var cardsHtml = reviews.map(function (r) { 
            return renderDatasetReviewCard(r); 
        }).join('');
        
        // Create unique IDs for this section
        var filterButtonsId = 'dataset-filter-buttons-' + sectionId;
        var searchInputId = 'dataset-search-input-' + sectionId;
        var sortSelectId = 'dataset-sort-select-' + sectionId;
        var reviewsListId = 'dataset-reviews-list-' + sectionId;
        var pageInfoId = 'dataset-page-info-' + sectionId;
        var prevBtnId = 'dataset-prev-btn-' + sectionId;
        var nextBtnId = 'dataset-next-btn-' + sectionId;
        
        return (
            '<section class="airline-section" data-airline="' + escapeHtml(sectionTitle) + '">' +
                '<div class="airline-section-header">' +
                    '<h2 class="airline-section-title"><i class="fas fa-comments"></i> ' + escapeHtml(sectionTitle) + '</h2>' +
                    '<span class="airline-section-count">' + totalCount + ' yorum</span>' +
                '</div>' +
                '<div class="airline-section-controls" style="margin-bottom: 1.5rem; display: flex; gap: 2rem; align-items: center; flex-wrap: wrap;">' +
                    '<div class="review-filter-left" style="display: flex; gap: 1rem; align-items: center;">' +
                        '<div class="review-filter-buttons" id="' + filterButtonsId + '">' +
                            '<button type="button" class="review-filter-btn" data-sentiment="">Tümü</button>' +
                            '<button type="button" class="review-filter-btn" data-sentiment="positive">Olumlu</button>' +
                            '<button type="button" class="review-filter-btn" data-sentiment="neutral">Nötr</button>' +
                            '<button type="button" class="review-filter-btn" data-sentiment="negative">Olumsuz</button>' +
                        '</div>' +
                        '<div class="review-search-wrapper">' +
                            '<i class="fas fa-search review-search-icon" aria-hidden="true"></i>' +
                            '<input type="search" id="' + searchInputId + '" class="review-search-input" placeholder="Aramak için kelime girin" aria-label="Yorumlarda kelime ara" style="width: 200px;">' +
                        '</div>' +
                    '</div>' +
                    '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
                        '<label for="' + sortSelectId + '" style="font-size: 0.875rem; font-weight: 500; color: #6b7280;">Sıralama:</label>' +
                        '<select id="' + sortSelectId + '" style="padding: 0.375rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; background: white; color: #374151;">' +
                            '<option value="date_desc" selected>Yeniden Eskiye</option>' +
                            '<option value="date_asc">eskiden Yeniye</option>' +
                            '<option value="rating_desc">Yüksek Puandan Düşük Puana</option>' +
                            '<option value="rating_asc">Düşük Puandan Yüksek Puana</option>' +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div id="' + reviewsListId + '" class="airline-reviews-list">' + cardsHtml + '</div>' +
                '<div class="airline-section-footer">' +
                    '<span id="' + pageInfoId + '" class="airline-section-page-info">' + (totalCount ? ('Gösterilen ' + startIndex + '–' + endIndex + ' / ' + totalCount + ' yorum') : 'Yorum yok') + '</span>' +
                    (totalPages > 1 ? (
                        '<div class="airline-section-pager">' +
                            '<button type="button" id="' + prevBtnId + '" class="airline-page-btn" data-section="' + escapeHtml(sectionId) + '" data-dir="prev"' + (page <= 1 ? ' disabled' : '') + '>Önceki</button>' +
                            '<button type="button" id="' + nextBtnId + '" class="airline-page-btn" data-section="' + escapeHtml(sectionId) + '" data-dir="next"' + (page >= totalPages ? ' disabled' : '') + '>Sonraki</button>' +
                        '</div>'
                    ) : '') +
                '</div>' +
            '</section>'
        );
    }
    
    function bindDatasetUnifiedSectionEventListeners(sectionId) {
        var filterButtons = document.getElementById('dataset-filter-buttons-' + sectionId);
        var searchInput = document.getElementById('dataset-search-input-' + sectionId);
        var sortSelect = document.getElementById('dataset-sort-select-' + sectionId);
        
        // Filter buttons
        if (filterButtons) {
            // Set initial active state
            var allBtns = filterButtons.querySelectorAll('.review-filter-btn');
            allBtns.forEach(function (b) { 
                if (b.getAttribute('data-sentiment') === '') {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            
            filterButtons.addEventListener('click', function (evt) {
                var btn = evt.target.closest('.review-filter-btn');
                if (!btn) return;
                var sentiment = btn.getAttribute('data-sentiment');
                datasetCurrentSentimentFilter = sentiment;
                datasetAirlinePages = {};
                renderDatasetSections(currentSelectedAirline);
            });
        }
        
        // Search input
        if (searchInput) {
            var searchTimeout;
            searchInput.addEventListener('input', function () {
                var value = this.value.trim();
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(function () {
                    datasetCurrentSearchQuery = value.toLocaleLowerCase('tr-TR');
                    datasetAirlinePages = {};
                    renderDatasetSections(currentSelectedAirline);
                }, 200);
            });
        }
        
        // Sort select
        if (sortSelect) {
            sortSelect.addEventListener('change', function () {
                // This would require implementing per-section sorting
                // For now, just re-render with current sort
                renderDatasetSections(currentSelectedAirline);
            });
        }
        
        // Pagination buttons
        var prevBtn = document.getElementById('dataset-prev-btn-' + sectionId);
        var nextBtn = document.getElementById('dataset-next-btn-' + sectionId);
        
        function handlePagination(dir) {
            var currentPage = datasetAirlinePages[sectionId] || 1;
            if (dir === 'prev') currentPage -= 1;
            if (dir === 'next') currentPage += 1;
            datasetAirlinePages[sectionId] = currentPage;
            renderDatasetSections(currentSelectedAirline);
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', function () { handlePagination('prev'); });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', function () { handlePagination('next'); });
        }
    }
    
    function renderDatasetSections(selectedAirline) {
        if (!sectionsContainer) return;
        
        // In dataset mode, if all airlines are selected, render unified "Tüm Yorumlar" section
        if (currentAnalysisMode === 'dataset' && !selectedAirline) {
            // Aggregate all reviews from dataset
            var allReviews = [];
            for (var i = 0; i < datasetByAirlineData.length; i++) {
                var reviews = (datasetByAirlineData[i].reviews || []).slice();
                allReviews = allReviews.concat(reviews);
            }
            
            // Apply sentiment filter if set
            if (datasetCurrentSentimentFilter) {
                allReviews = allReviews.filter(function (r) {
                    return getSentimentFromRatingValue(r.rating) === datasetCurrentSentimentFilter;
                });
            }
            
            // Apply search filter if set
            if (datasetCurrentSearchQuery) {
                allReviews = allReviews.filter(function (r) {
                    var content = (r.content || '').toLocaleLowerCase('tr-TR');
                    var title = (r.title || '').toLocaleLowerCase('tr-TR');
                    var route = (r.route || '').toLocaleLowerCase('tr-TR');
                    return content.indexOf(datasetCurrentSearchQuery) !== -1 || 
                           title.indexOf(datasetCurrentSearchQuery) !== -1 || 
                           route.indexOf(datasetCurrentSearchQuery) !== -1;
                });
            }
            
            // Show total reviews count
            var totalReviews = allReviews.length;
            updateResultsCountDisplay(totalReviews);
            
            // Render unified section with all dataset reviews
            if (totalReviews > 0) {
                var totalCount = allReviews.length;
                var totalPages = Math.max(1, Math.ceil(totalCount / REVIEWS_PER_PAGE));
                var sectionId = 'dataset-tum-yorumlar';
                var currentPage = datasetAirlinePages[sectionId] || 1;
                if (currentPage > totalPages) currentPage = totalPages;
                if (currentPage < 1) currentPage = 1;
                datasetAirlinePages[sectionId] = currentPage;
                var start = (currentPage - 1) * REVIEWS_PER_PAGE;
                var pageReviews = allReviews.slice(start, start + REVIEWS_PER_PAGE);
                
                // Use unified design with dataset review cards
                var sectionTitle = 'Tüm Yorumlar';
                var html = renderDatasetUnifiedSection(sectionTitle, pageReviews, currentPage, totalPages, totalCount, sectionId);
                sectionsContainer.innerHTML = html;
                
                // Add event listeners for the unified section
                bindDatasetUnifiedSectionEventListeners(sectionId);
            } else {
                sectionsContainer.innerHTML = '';
            }
            
            renderAirlineOverviewCards();
            return;
        }
        
        // For specific airline in dataset mode, also use unified design with filters
        if (currentAnalysisMode === 'dataset' && selectedAirline) {
            // Get reviews for the specific airline
            var airlineReviews = [];
            for (var i = 0; i < datasetByAirlineData.length; i++) {
                if (datasetByAirlineData[i].airline_name === selectedAirline) {
                    airlineReviews = (datasetByAirlineData[i].reviews || []).slice();
                    break;
                }
            }
            
            // Apply sentiment filter if set
            if (datasetCurrentSentimentFilter) {
                airlineReviews = airlineReviews.filter(function (r) {
                    return getSentimentFromRatingValue(r.rating) === datasetCurrentSentimentFilter;
                });
            }
            
            // Apply search filter if set
            if (datasetCurrentSearchQuery) {
                airlineReviews = airlineReviews.filter(function (r) {
                    var content = (r.content || '').toLocaleLowerCase('tr-TR');
                    var title = (r.title || '').toLocaleLowerCase('tr-TR');
                    var route = (r.route || '').toLocaleLowerCase('tr-TR');
                    return content.indexOf(datasetCurrentSearchQuery) !== -1 || 
                           title.indexOf(datasetCurrentSearchQuery) !== -1 || 
                           route.indexOf(datasetCurrentSearchQuery) !== -1;
                });
            }
            
            // Show total reviews count
            var totalReviews = airlineReviews.length;
            updateResultsCountDisplay(totalReviews);
            
            // Render unified section with airline-specific reviews
            if (totalReviews > 0) {
                var totalCount = airlineReviews.length;
                var totalPages = Math.max(1, Math.ceil(totalCount / REVIEWS_PER_PAGE));
                var sectionId = 'dataset-' + selectedAirline.replace(/\s+/g, '-').toLowerCase();
                var currentPage = datasetAirlinePages[sectionId] || 1;
                if (currentPage > totalPages) currentPage = totalPages;
                if (currentPage < 1) currentPage = 1;
                datasetAirlinePages[sectionId] = currentPage;
                var start = (currentPage - 1) * REVIEWS_PER_PAGE;
                var pageReviews = airlineReviews.slice(start, start + REVIEWS_PER_PAGE);
                
                // Use unified design with dataset review cards
                var sectionTitle = selectedAirline;
                var html = renderDatasetUnifiedSection(sectionTitle, pageReviews, currentPage, totalPages, totalCount, sectionId);
                sectionsContainer.innerHTML = html;
                
                // Add event listeners for the unified section
                bindDatasetUnifiedSectionEventListeners(sectionId);
            } else {
                sectionsContainer.innerHTML = '';
            }
            
            renderAirlineOverviewCards();
            return;
        }
        
        var html = '';
        var totalVisible = 0;
        for (var i = 0; i < datasetByAirlineData.length; i++) {
            var group = datasetByAirlineData[i];
            var name = group.airline_name || 'Diğer';
            var reviews = (group.reviews || []).slice();
            if (!reviews.length) continue;
            if (selectedAirline && name !== selectedAirline) continue;
            var totalCount = reviews.length;
            var totalPages = Math.max(1, Math.ceil(totalCount / REVIEWS_PER_PAGE));
            var currentPage = datasetAirlinePages[name] || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;
            datasetAirlinePages[name] = currentPage;
            var start = (currentPage - 1) * REVIEWS_PER_PAGE;
            var pageReviews = reviews.slice(start, start + REVIEWS_PER_PAGE);
            totalVisible += totalCount;
            html += renderDatasetAirlineSection(name, pageReviews, currentPage, totalPages, totalCount);
        }
        sectionsContainer.innerHTML = html;
        if (!renderDatasetSections.paginationBound) {
            renderDatasetSections.paginationBound = true;
            sectionsContainer.addEventListener('click', function (evt) {
                var btn = evt.target.closest('.airline-page-btn');
                if (!btn) return;
                var airline = btn.getAttribute('data-airline');
                var dir = btn.getAttribute('data-dir');
                if (!airline || !dir) return;
                var currentPage = datasetAirlinePages[airline] || 1;
                if (dir === 'prev') currentPage -= 1;
                if (dir === 'next') currentPage += 1;
                datasetAirlinePages[airline] = currentPage;
                var selected = airlineSelect ? (airlineSelect.value || '').trim() || null : null;
                renderDatasetSections(selected);
            });
        }
    }
    function loadDatasetAnalysisForAirline(airline) {
        console.log('🔍 Dataset analizi başlatılıyor - havayolu:', airline);
        var isGlobal = !airline;
        console.log('🌍 Global mod:', isGlobal);
        showLoading(true);
        resetDatasetWidgets();
        // Önce henüz işlenmemiş dataset kayıtları varsa LLM analizini tetikle

        var analyzeUrl = API_BASE + '/api/airline-reviews-dataset/analyze' + (isGlobal ? '' : ('?airline=' + encodeURIComponent(airline)));
        console.log('📈 Analyze URL:', analyzeUrl);
        fetch(analyzeUrl, { method: 'POST' })
            .then(function (res) {
                console.log('📊 Analyze API response:', res.status, res.statusText);
                return res.ok ? res.json() : null;
            })
            .catch(function (error) {
                console.error('❌ Dataset analiz API hatası:', error);
                return null;
            })
            .then(function () {
                var resultUrl = API_BASE + '/api/airline-reviews-dataset/result' + (isGlobal ? '' : ('?airline=' + encodeURIComponent(airline)));
                console.log('📋 Result URL:', resultUrl);
                return fetch(resultUrl)
                    .then(function (res) {
                        console.log('📊 Result API response:', res.status, res.statusText);
                        return res.ok ? res.json() : null;
                    })
                    .catch(function (error) {
                        console.error('❌ Dataset result API hatası:', error);
                        return null;
                    });
            })
            .then(function (data) {
                console.log('📊 Dataset analysis data received:', data);
                showLoading(false);
                console.log('⏹️ Loading kapatıldı');
                if (!data) {
                    console.log('⚠️ Veri yok - empty state gösteriliyor');
                    showEmpty(true);
                    return;
                }
                if (resultsCountEl) {
                    if (isGlobal) {
                        // For global case in dataset mode, don't show results count
                        resultsCountEl.textContent = '';
                    } else {
                        // For specific airline, show sentiment distribution count
                        var sd = data.sentiment_distribution || {};
                        var total = (parseInt(sd.positive, 10) || 0) +
                            (parseInt(sd.negative, 10) || 0) +
                            (parseInt(sd.neutral, 10) || 0);
                        resultsCountEl.textContent = total + ' yorum (dataset)';
                    }
                    console.log('📈 Sonuç sayısı güncellendi:', resultsCountEl.textContent);
                }
                console.log('🎨 Veri uygulanıyor...');
                applyDatasetAnalysisData(data);
                // Görünür olması gereken bölümleri ayarla

                var overviewSection = document.getElementById('airline-overview-section');
                var comparisonSection = document.getElementById('multi-airline-comparison-section');
                var allSummarySection = document.getElementById('all-airlines-summary-section');
                var generalStatsSection = document.getElementById('general-stats-section');
                var sentimentChartSection = document.getElementById('sentiment-chart-section');
                var singleSummarySection = document.getElementById('analysis-summary-section');
                var routeSection = document.querySelector('.route-satisfaction-section');
                var multiAirlineHeading = document.querySelector('.multi-airline-page-heading');
                var multiAirlineSubtitle = document.querySelector('.multi-airline-page-subtitle');
                if (isGlobal) {
                    // Tüm havayolları seçiliyken: global özet ve çoklu havayolu kartları
                    if (overviewSection) overviewSection.style.display = 'block';
                    if (comparisonSection) comparisonSection.style.display = 'block';
                    if (allSummarySection) allSummarySection.style.display = 'block';
                    if (multiAirlineHeading) multiAirlineHeading.style.display = 'block';
                    if (multiAirlineSubtitle) multiAirlineSubtitle.style.display = 'block';
                    renderDatasetGlobalSummaryLists(data);
                    renderDatasetMultiAirlineBlocks();
                    // Hide airline sections when all airlines selected
                    renderDatasetSections(null);
                    if (generalStatsSection) generalStatsSection.style.display = 'none';
                    if (sentimentChartSection) sentimentChartSection.style.display = 'none';
                    if (singleSummarySection) singleSummarySection.style.display = 'none';
                    if (routeSection) routeSection.style.display = 'none';
                } else {
                    // Belirli havayolu seçiliyken: sadece o havayolu odaklı kartlar
                    if (overviewSection) overviewSection.style.display = 'none';
                    if (comparisonSection) comparisonSection.style.display = 'none';
                    if (allSummarySection) allSummarySection.style.display = 'none';
                    if (multiAirlineHeading) multiAirlineHeading.style.display = 'none';
                    if (multiAirlineSubtitle) multiAirlineSubtitle.style.display = 'none';
                    if (generalStatsSection) generalStatsSection.style.display = 'block';
                    if (sentimentChartSection) sentimentChartSection.style.display = 'block';
                    if (singleSummarySection) singleSummarySection.style.display = 'block';
                    if (routeSection) routeSection.style.display = 'block';
                    renderDatasetScoreAndTrend(airline);
                    // Render the specific airline reviews
                    renderDatasetSections(airline);
                }
            })
            .catch(function (error) {
                showLoading(false);
                showEmpty(true);
            });
    }
    function applyDatasetAnalysisData(data) {
        if (!data) {
            resetDatasetWidgets();
            return;
        }
        renderDatasetGeneralStats(data);
        renderDatasetSummaryLists(data);
        renderDatasetSentimentChart(data);
        renderDatasetRouteSatisfaction(data);
        renderDatasetRecommendationsAndLoyalty(data);
        updateDatasetSentimentTabs(data.airline_name);
    }
    var datasetSentimentTabsBound = false;
    var datasetSentimentPages = {
        positive: 1,
        neutral: 1,
        negative: 1,
    };
    var DATASET_SENTIMENT_REVIEWS_PER_PAGE = 5;
    function updateDatasetSentimentTabs(airline) {
        var listPositive = document.getElementById('sentiment-list-positive');
        var listNeutral = document.getElementById('sentiment-list-neutral');
        var listNegative = document.getElementById('sentiment-list-negative');
        if (!listPositive || !listNeutral || !listNegative) return;
        var reviews = [];
        for (var i = 0; i < datasetByAirlineData.length; i++) {
            if (datasetByAirlineData[i].airline_name === airline) {
                reviews = (datasetByAirlineData[i].reviews || []).slice();
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
            var totalPages = Math.max(1, Math.ceil(total / DATASET_SENTIMENT_REVIEWS_PER_PAGE));
            var page = datasetSentimentPages[sentimentKey] || 1;
            if (page > totalPages) page = totalPages;
            if (page < 1) page = 1;
            datasetSentimentPages[sentimentKey] = page;
            var start = (page - 1) * DATASET_SENTIMENT_REVIEWS_PER_PAGE;
            var currentList = allList.slice(start, start + DATASET_SENTIMENT_REVIEWS_PER_PAGE);
            var html = currentList.map(function (r) {
                var card = renderDatasetReviewCard(r);
                return card.replace('class="review-card"', 'class="review-card sentiment-' + sentimentClass + '"');
            }).join('');
            listEl.innerHTML = html;
            var startIndex = start + 1;
            var endIndex = Math.min(start + DATASET_SENTIMENT_REVIEWS_PER_PAGE, total);
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
        if (!datasetSentimentTabsBound) {
            datasetSentimentTabsBound = true;
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
                    var current = datasetSentimentPages[key] || 1;
                    if (dir === 'prev') current -= 1;
                    if (dir === 'next') current += 1;
                    datasetSentimentPages[key] = current;
                    updateDatasetSentimentTabs(airline);
                });
            }
        }
    }
    function renderDatasetGeneralStats(data) {
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
                html += i <= r
                    ? '<i class="fas fa-star stat-star stat-star-filled"></i>'
                    : '<i class="far fa-star stat-star stat-star-empty"></i>';
            }
            starsEl.innerHTML = html;
        }
    }
    function renderDatasetSummaryLists(data) {
        var complaintsList = document.getElementById('summary-complaints-list');
        var likedList = document.getElementById('summary-liked-list');
        if (!complaintsList || !likedList) return;
        
        var rawComplaints = (data && data.most_complained_topics) ? data.most_complained_topics : [];
        var rawLiked = (data && data.most_liked_aspects) ? data.most_liked_aspects : [];
        
        // Ortak fonksiyonları kullan (this bağlamını korumak için .call kullan)
        var complaints = groupSimilarTopics.call(Common, rawComplaints, 10);
        var liked = groupSimilarTopics.call(Common, rawLiked, 10);
        
        // Store data for pagination
        summaryComplaintsData = complaints;
        summaryLikedListData = liked;
        
        // Reset pagination
        summaryComplaintsPage = 1;
        summaryLikedListPage = 1;
        
        // Render with pagination
        complaintsList.innerHTML = renderPaginatedSummaryList.call(Common, complaints, true, SUMMARY_ITEMS_PER_PAGE, summaryComplaintsPage, 'summary-complaints-list');
        likedList.innerHTML = renderPaginatedSummaryList.call(Common, liked, false, SUMMARY_ITEMS_PER_PAGE, summaryLikedListPage, 'summary-liked-list');
        
        // Bind pagination events
        bindSummaryListPaginationEvents();
    }
    function renderDatasetGlobalSummaryLists(data) {
        var complaintsList = document.getElementById('all-summary-complaints-list');
        var likedList = document.getElementById('all-summary-liked-list');
        if (!complaintsList || !likedList) return;
        
        var complaints = (data && data.most_complained_topics) ? data.most_complained_topics : [];
        var liked = (data && data.most_liked_aspects) ? data.most_liked_aspects : [];
        
        // Store data for pagination
        summaryComplaintsData = complaints;
        summaryLikedListData = liked;
        
        // Reset pagination for global lists
        summaryComplaintsPage = 1;
        summaryLikedListPage = 1;
        
        // Render with pagination
        complaintsList.innerHTML = renderPaginatedSummaryList.call(Common, complaints, true, SUMMARY_ITEMS_PER_PAGE, summaryComplaintsPage, 'all-summary-complaints-list');
        likedList.innerHTML = renderPaginatedSummaryList.call(Common, liked, false, SUMMARY_ITEMS_PER_PAGE, summaryLikedListPage, 'all-summary-liked-list');
        
        // Bind pagination events
        bindSummaryListPaginationEvents();
    }
    function renderDatasetSentimentChart(data) {
        var sd = data && data.sentiment_distribution ? data.sentiment_distribution : {};
        var positive = parseInt(sd.positive, 10) || 0;
        var negative = parseInt(sd.negative, 10) || 0;
        var neutral = parseInt(sd.neutral, 10) || 0;
        var total = positive + negative + neutral;
        // Tüm sentiment chart instance'larını destroy et

        if (datasetSentimentChartInstance) {
            datasetSentimentChartInstance.destroy();
            datasetSentimentChartInstance = null;
        }
        if (sentimentChartInstance) {
            sentimentChartInstance.destroy();
            sentimentChartInstance = null;
        }
        var canvas = document.getElementById('sentiment-chart');
        if (canvas && typeof Chart !== 'undefined') {
            var ctx = canvas.getContext('2d');
            datasetSentimentChartInstance = new Chart(ctx, {
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
                    plugins: { legend: { display: false } },
                    cutout: '70%'
                }
            });
        }
        var legendEl = document.getElementById('sentiment-legend');
        if (legendEl) {
            var pct = total ? function (n) { return Math.round((n / total) * 100); } : function () { return 0; };
            legendEl.innerHTML =
                '<span class="legend-item legend-positive"><i class="fas fa-smile"></i> Pozitif: ' + positive + ' (' + pct(positive) + '%)</span>' +
                '<span class="legend-item legend-negative"><i class="fas fa-frown"></i> Negatif: ' + negative + ' (' + pct(negative) + '%)</span>' +
                '<span class="legend-item legend-neutral"><i class="fas fa-meh"></i> Nötr: ' + neutral + ' (' + pct(neutral) + '%)</span>';
        }
        var centerText = document.getElementById('sentiment-center-text');
        if (centerText) {
            var valueEl = centerText.querySelector('.sentiment-center-value');
            var labelEl = centerText.querySelector('.sentiment-center-label');
            if (valueEl) valueEl.textContent = total || 0;
            if (labelEl) labelEl.textContent = 'Toplam';
        }
    }
    function renderDatasetRouteSatisfaction(data) {
        var routeList = document.getElementById('route-satisfaction-list');
        if (!routeList) return;
        var airlineNameFromApi = data && data.airline_name;
        var selectedAirline = airlineSelect ? (airlineSelect.value || '').trim() : '';
        var airlineReviews = getDatasetReviewsForAirline(airlineNameFromApi) || [];
        if (!airlineReviews.length && selectedAirline) {
            airlineReviews = getDatasetReviewsForAirline(selectedAirline);
        }
        if (!airlineReviews.length) {
            routeList.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
            return;
        }
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
                avg: avg,
                count: stat.count
            };
        }).filter(function (row) {
            return row.count > 0;
        });
        if (!rows.length) {
            routeList.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
            return;
        }
        rows.sort(function (a, b) {
            if (b.count !== a.count) return b.count - a.count;
            return b.avg - a.avg;
        });
        var topRows = rows.slice(0, 8);
        var html = topRows.map(function (row) {
            var avg = row.avg;
            var width = Math.max(10, Math.min(100, Math.round((avg / 5) * 100)));
            // 5 farklı renk aralığı: mükemmel, iyi, orta, zayıf, kötü
            var cls = 'route-score-neutral';
            var barColor = '#f59e0b'; // turuncu (3.x için)
            if (avg >= 4.5) {
                cls = 'route-score-excellent'; // 4.5-5.0
                barColor = '#22c55e'; // yeşil
            } else if (avg >= 4.0) {
                cls = 'route-score-good'; // 4.0-4.4
                barColor = '#3b82f6'; // mavi
            } else if (avg >= 3.0) {
                cls = 'route-score-average'; // 3.0-3.9
                barColor = '#f59e0b'; // turuncu
            } else if (avg >= 2.0) {
                cls = 'route-score-weak'; // 2.0-2.9
                barColor = '#f97316'; // koyu turuncu
            } else {
                cls = 'route-score-poor'; // 1.0-1.9
                barColor = '#ef4444'; // kırmızı
            }
            var countText = row.count + ' yorum';
            return '' +
                '<div class="route-row">' +
                    '<div class="route-name">' + escapeHtml(row.route) + '</div>' +
                    '<div class="route-row-bar-track"><div class="route-row-bar-fill" style="width:' + width + '%;background:' + barColor + ';"></div></div>' +
                    '<div class="route-score-container">' +
                        '<div class="route-score-inline">' +
                            '<span class="route-score ' + cls + '">' + escapeHtml(avg.toFixed(1)) + '</span>' +
                            '<span class="route-count">' + escapeHtml(countText) + '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }).join('');
        routeList.innerHTML = html;
    }
    function renderDatasetRecommendationsAndLoyalty(data) {
        var summaryRecsEl = document.getElementById('summary-recommendations-list');
        datasetLastRecommendationsData = data || null;
        if (summaryRecsEl) {
            var recItems = (data && data.customer_recommendations) || [];
            if (!recItems.length) {
                summaryRecsEl.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
            } else {
                var total = recItems.length;
                var totalPages = Math.max(1, Math.ceil(total / datasetRecommendationsPerPage));
                if (datasetRecommendationsPage > totalPages) datasetRecommendationsPage = totalPages;
                if (datasetRecommendationsPage < 1) datasetRecommendationsPage = 1;
                var start = (datasetRecommendationsPage - 1) * datasetRecommendationsPerPage;
                var pageItems = recItems.slice(start, start + datasetRecommendationsPerPage);
                var itemsHtml = pageItems.map(function (text) {
                    var str = String(text || '').trim();
                    var label = str;
                    var value = '';
                    var idx = str.indexOf(':');
                    if (idx > 0) {
                        label = str.slice(0, idx).trim();
                        value = str.slice(idx + 1).trim();
                    }
                    return '' +
                        '<div class="summary-recommendation-item">' +
                            '<span class="summary-recommendation-label">' + escapeHtml(label) + '</span>' +
                            '<span class="summary-recommendation-value">' + escapeHtml(value || '—') + '</span>' +
                        '</div>';
                }).join('');
                var pagerHtml = '';
                if (totalPages > 1) {
                    pagerHtml =
                        '<div class="summary-recommendation-pager" data-position="left">' +
                            '<button type="button" class="summary-recommendation-page-btn" data-dir="prev"' + (datasetRecommendationsPage <= 1 ? ' disabled' : '') + '><i class="fas fa-angle-left"></i></button>' +
                        '</div>' +
                        '<div class="summary-recommendation-pager" data-position="right">' +
                            '<button type="button" class="summary-recommendation-page-btn" data-dir="next"' + (datasetRecommendationsPage >= totalPages ? ' disabled' : '') + '><i class="fas fa-angle-right"></i></button>' +
                        '</div>';
                }
                summaryRecsEl.innerHTML = itemsHtml + pagerHtml;
                if (!renderDatasetRecommendationsAndLoyalty._pagerBound) {
                    renderDatasetRecommendationsAndLoyalty._pagerBound = true;
                    summaryRecsEl.addEventListener('click', function (evt) {
                        var btn = evt.target.closest('.summary-recommendation-page-btn');
                        if (!btn || !datasetLastRecommendationsData) return;
                        var dir = btn.getAttribute('data-dir');
                        if (!dir) return;
                        if (dir === 'prev') datasetRecommendationsPage -= 1;
                        if (dir === 'next') datasetRecommendationsPage += 1;
                        renderDatasetRecommendationsAndLoyalty(datasetLastRecommendationsData);
                    });
                }
            }
        }
        // Yolcu Sadakati (tekrar tercih etme yüzdesi)

        var repeatPercentEl = document.getElementById('route-repeat-percent');
        var repeatTextEl = document.getElementById('route-repeat-text');
        var repeatRingBgEl = document.querySelector('.route-loyalty-ring-bg');
        if (repeatPercentEl) {
            var sdLocal = (data && data.sentiment_distribution) || {};
            var pos = parseInt(sdLocal.positive, 10) || 0;
            var neg = parseInt(sdLocal.negative, 10) || 0;
            var neu = parseInt(sdLocal.neutral, 10) || 0;
            var totalSent = pos + neg + neu;
            var posPct = totalSent ? (pos / totalSent) : 0;
            var negPct = totalSent ? (neg / totalSent) : 0;
            var netScore = posPct - negPct; // -1 ile +1 arasi
            var loyaltyScore = totalSent ? Math.round((netScore + 1) * 50) : 0; // 0 ile 100 arasi
            repeatPercentEl.textContent = '%' + loyaltyScore;
            var ringColor;
            if (loyaltyScore <= 33) {
                ringColor = '#ef4444'; // Kırmızı - Düşük
            } else if (loyaltyScore <= 66) {
                ringColor = '#eab308'; // Sarı - Orta
            } else {
                ringColor = '#22c55e'; // Yeşil - Yüksek
            }
            repeatPercentEl.style.color = ringColor;
            if (repeatRingBgEl) {
                repeatRingBgEl.style.background = 'conic-gradient(' + ringColor + ' 0 ' + loyaltyScore + '%, #e5e7eb ' + loyaltyScore + '% 100%)';
            }
            if (repeatTextEl) {
                if (!totalSent) {
                    repeatTextEl.textContent = 'Yeterli veri bulunmuyor.';
                } else if (loyaltyScore <= 20) {
                    repeatTextEl.textContent = 'Önemli bir kısmı tekrar tercih etmeyi düşünmüyor.';
                } else if (loyaltyScore <= 40) {
                    repeatTextEl.textContent = 'Bir kısmı tekrar tercih etmeyi düşünmüyor.';
                } else if (loyaltyScore <= 60) {
                    repeatTextEl.textContent = 'Kararsız bir çoğunluk tekrar tercih etmeyi düşünüyor.';
                } else if (loyaltyScore <= 80) {
                    repeatTextEl.textContent = 'Çoğu tekrar tercih etmeyi düşünüyor.';
                } else {
                    repeatTextEl.textContent = 'Önemli bir kısmı tekrar tercih etmeyi düşünüyor.';
                }
            }
        }
    }
    function renderDatasetScoreAndTrend(selectedAirline) {
        var scoreList = document.getElementById('score-distribution-list');
        var trendCanvas = document.getElementById('trend-by-flight-date-chart');
        if (!scoreList || !trendCanvas || !selectedAirline) return;
        // Tüm trend chart instance'larını destroy et

        if (datasetTrendByFlightDateChart) {
            datasetTrendByFlightDateChart.destroy();
            datasetTrendByFlightDateChart = null;
        }
        if (trendByFlightDateChart) {
            trendByFlightDateChart.destroy();
            trendByFlightDateChart = null;
        }
        var reviews = getDatasetReviewsForAirline(selectedAirline);
        // Puan dağılımı

        var ratingCounts = [0, 0, 0, 0, 0];
        reviews.forEach(function (r) {
            var star = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 0));
            ratingCounts[star - 1]++;
        });
        var totalRatings = ratingCounts.reduce(function (acc, v) { return acc + v; }, 0);
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
        // Uçuş tarihine göre yorum trendi - yıl filtresi ile (dataset mode)
        bindDatasetFlightTrendYearFilter(reviews);
        
        // Son 12 ay puan trendi - yıl filtresi ile (dataset mode)
        bindDatasetScoreTrendYearFilter(reviews);
    }
    
    // Global variables for dataset mode listeners
    var datasetFlightTrendYearFilterListener = null;
    var datasetScoreTrendYearFilterListener = null;
    
    function renderDatasetFlightDateTrendChart(reviews, selectedYear) {
        // Generate month keys and labels for selected year
        var monthKeys = [];
        var monthLabels = [];
        for (var i = 0; i < 12; i++) {
            var m = i + 1;
            monthKeys.push(selectedYear + '-' + String(m).padStart(2, '0'));
            var monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
            monthLabels.push(monthNames[i]);
        }
        
        var byMonth = {};
        monthKeys.forEach(function (k) { byMonth[k] = 0; });
        reviews.forEach(function (r) {
            var d = r.review_date;
            if (!d) return;
            var date = new Date(d);
            if (isNaN(date.getTime())) return;
            var y = date.getFullYear();
            var m = date.getMonth() + 1;
            var key = y + '-' + String(m).padStart(2, '0');
            if (byMonth.hasOwnProperty(key)) byMonth[key]++;
        });
        var trendCounts = monthKeys.map(function (k) { return byMonth[k] || 0; });
        
        var trendCanvas = document.getElementById('trend-by-flight-date-chart');
        if (datasetTrendByFlightDateChart) {
            datasetTrendByFlightDateChart.destroy();
            datasetTrendByFlightDateChart = null;
        }
        if (trendCanvas && typeof Chart !== 'undefined') {
            var ctx = trendCanvas.getContext('2d');
            datasetTrendByFlightDateChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [{
                        label: 'Yorum sayısı',
                        data: trendCounts,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        fill: true,
                        tension: 0.3,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Yorum Sayısı' },
                            ticks: { stepSize: 1 },
                        },
                        x: {
                            title: { display: true, text: 'Ay' },
                        },
                    },
                },
            });
        }
    }
    
    function renderDatasetScoreTrendChart(reviews, selectedYear) {
        // Generate month keys and labels for selected year
        var monthKeys = [];
        var monthLabels = [];
        for (var i = 0; i < 12; i++) {
            var m = i + 1;
            monthKeys.push(selectedYear + '-' + String(m).padStart(2, '0'));
            var monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
            monthLabels.push(monthNames[i]);
        }
        
        var monthlyScores = {};
        monthKeys.forEach(function(k) { monthlyScores[k] = { sum: 0, count: 0 }; });
        reviews.forEach(function(r) {
            var d = r.review_date;
            if (!d) return;
            var date = new Date(d);
            if (isNaN(date.getTime())) return;
            var y = date.getFullYear();
            var m = date.getMonth() + 1;
            var key = y + '-' + String(m).padStart(2, '0');
            if (monthlyScores.hasOwnProperty(key)) {
                var rating = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 0));
                monthlyScores[key].sum += rating;
                monthlyScores[key].count++;
            }
        });
        var avgScores = monthKeys.map(function(k) {
            var data = monthlyScores[k];
            return data.count > 0 ? (data.sum / data.count).toFixed(2) : null;
        });
        
        var scoreTrendCanvas = document.getElementById('score-trend-chart');
        if (datasetScoreTrendChart) {
            datasetScoreTrendChart.destroy();
            datasetScoreTrendChart = null;
        }
        if (scoreTrendCanvas && typeof Chart !== 'undefined') {
            var scoreCtx = scoreTrendCanvas.getContext('2d');
            datasetScoreTrendChart = new Chart(scoreCtx, {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [{
                        label: 'Ortalama Puan',
                        data: avgScores,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        fill: true,
                        tension: 0.3,
                        spanGaps: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: 1,
                            max: 5,
                            title: { display: true, text: 'Ortalama Puan' },
                            ticks: { stepSize: 0.5 }
                        },
                        x: {
                            title: { display: true, text: 'Ay' }
                        }
                    }
                }
            });
        }
    }
    
    function bindDatasetFlightTrendYearFilter(reviews) {
        var yearFilter = document.getElementById('flight-trend-year-filter');
        if (yearFilter) {
            // Remove old listener if exists
            if (datasetFlightTrendYearFilterListener) {
                yearFilter.removeEventListener('change', datasetFlightTrendYearFilterListener);
                datasetFlightTrendYearFilterListener = null;
            }
            
            // Set default to current year
            var currentYear = new Date().getFullYear();
            yearFilter.value = String(currentYear);
            
            // Create new listener
            datasetFlightTrendYearFilterListener = function () {
                var selectedYear = this.value;
                renderDatasetFlightDateTrendChart(reviews, selectedYear);
            };
            
            yearFilter.addEventListener('change', datasetFlightTrendYearFilterListener);
            
            // Initial render with current year
            renderDatasetFlightDateTrendChart(reviews, String(currentYear));
        }
    }
    
    function bindDatasetScoreTrendYearFilter(reviews) {
        var yearFilter = document.getElementById('score-trend-year-filter');
        if (yearFilter) {
            // Remove old listener if exists
            if (datasetScoreTrendYearFilterListener) {
                yearFilter.removeEventListener('change', datasetScoreTrendYearFilterListener);
                datasetScoreTrendYearFilterListener = null;
            }
            
            // Set default to current year
            var currentYear = new Date().getFullYear();
            yearFilter.value = String(currentYear);
            
            // Create new listener
            datasetScoreTrendYearFilterListener = function () {
                var selectedYear = this.value;
                renderDatasetScoreTrendChart(reviews, selectedYear);
            };
            
            yearFilter.addEventListener('change', datasetScoreTrendYearFilterListener);
            
            // Initial render with current year
            renderDatasetScoreTrendChart(reviews, String(currentYear));
        }
    }
    function renderDatasetMultiAirlineBlocks() {
        var overviewSection = document.getElementById('airline-overview-section');
        var grid = document.getElementById('airline-overview-grid');
        var comparisonSection = document.getElementById('multi-airline-comparison-section');
        var sentimentListEl = document.getElementById('multi-airline-sentiment-list');
        if (!overviewSection || !grid || !comparisonSection || !sentimentListEl) return;
        // Multi-airline trend chart'ı destroy et

        if (multiAirlineTrendChart) {
            multiAirlineTrendChart.destroy();
            multiAirlineTrendChart = null;
        }
        fetch(API_BASE + '/api/airline-reviews-dataset/overview')
            .then(function (res) { return res.ok ? res.json() : []; })
            .catch(function () { return []; })
            .then(function (items) {
                console.log('🔍 Dataset overview items received:', items);
                console.log('🔍 First item structure:', items[0]);
                console.log('🔍 datasetByAirlineData length:', datasetByAirlineData.length);
                
                if (!items || !items.length) {
                    overviewSection.style.display = 'none';
                    comparisonSection.style.display = 'none';
                    grid.innerHTML = '';
                    sentimentListEl.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
                    if (multiAirlineTrendChart) {
                        multiAirlineTrendChart.destroy();
                        multiAirlineTrendChart = null;
                    }
                    return;
                }
                // Kartlar için veri hazırla

                var cards = items.map(function (it) {
                    var sd = it.sentiment_distribution || {};
                    var pos = parseInt(sd.positive, 10) || 0;
                    var neg = parseInt(sd.negative, 10) || 0;
                    var neu = parseInt(sd.neutral, 10) || 0;
                    var total = pos + neg + neu;
                    
                    // Calculate average rating from available data
                    var avgRating = 0;
                    console.log('🔍 Processing item:', it.airline_name, 'with data:', it);
                    
                    if (it.rating_analysis && it.rating_analysis.average_rating != null) {
                        avgRating = parseFloat(it.rating_analysis.average_rating) || 0;
                        console.log('📊 Using rating_analysis.average_rating:', avgRating);
                    } else if (it.average_rating != null) {
                        avgRating = parseFloat(it.average_rating) || 0;
                        console.log('📊 Using average_rating:', avgRating);
                    } else if (it.rating_distribution) {
                        // Calculate from rating distribution
                        var rd = it.rating_distribution;
                        console.log('📊 Using rating_distribution:', rd);
                        var ratingSum = 0;
                        var ratingCount = 0;
                        for (var rating = 1; rating <= 5; rating++) {
                            var count = parseInt(rd[rating.toString()] || 0, 10);
                            ratingSum += rating * count;
                            ratingCount += count;
                        }
                        avgRating = ratingCount > 0 ? (ratingSum / ratingCount) : 0;
                        console.log('📊 Calculated from distribution:', ratingSum, '/', ratingCount, '=', avgRating);
                    } else if (it.sentiment_distribution) {
                        // Estimate rating from sentiment distribution as fallback
                        var sd = it.sentiment_distribution;
                        console.log('📊 Using sentiment_distribution to estimate rating:', sd);
                        var pos = parseInt(sd.positive, 10) || 0;
                        var neu = parseInt(sd.neutral, 10) || 0;
                        var neg = parseInt(sd.negative, 10) || 0;
                        var total = pos + neu + neg;
                        
                        if (total > 0) {
                            // Estimate: positive ~ 4-5 stars, neutral ~ 3 stars, negative ~ 1-2 stars
                            var posWeight = 4.5; // Average of 4-5
                            var neuWeight = 3.0; // Average of 3
                            var negWeight = 1.5; // Average of 1-2
                            
                            avgRating = ((pos * posWeight) + (neu * neuWeight) + (neg * negWeight)) / total;
                            console.log('📊 Estimated from sentiment:', pos, 'x', posWeight, '+', neu, 'x', neuWeight, '+', neg, 'x', negWeight, '=', avgRating);
                        }
                    } else {
                        console.log('📊 No rating data found, using 0');
                    }
                    
                    console.log('📊 Final avgRating for', it.airline_name, ':', avgRating);

                    // Get reviews for this airline from datasetByAirlineData
                    var airlineReviews = [];
                    console.log('🔍 Looking for reviews for:', it.airline_name, 'in datasetByAirlineData length:', datasetByAirlineData.length);
                    for (var j = 0; j < datasetByAirlineData.length; j++) {
                        var groupName = normalizeAirlineKey(datasetByAirlineData[j].airline_name);
                        var itemName = normalizeAirlineKey(it.airline_name);
                        console.log('🔍 Comparing:', groupName, 'with', itemName);
                        if (groupName === itemName) {
                            airlineReviews = datasetByAirlineData[j].reviews || [];
                            console.log('🔍 Found reviews for', it.airline_name, ':', airlineReviews.length, 'reviews');
                            break;
                        }
                    }

                    return {
                        name: it.airline_name || 'Diğer',
                        pos: pos,
                        neg: neg,
                        neu: neu,
                        total: total,
                        avgRating: avgRating,
                        time_trends: it.time_trends || [],
                        reviews: airlineReviews
                    };
                }).filter(function (c) { return c.total > 0; });
                if (!cards.length) {
                    overviewSection.style.display = 'none';
                    comparisonSection.style.display = 'none';
                    grid.innerHTML = '';
                    sentimentListEl.innerHTML = '<p class="analysis-list-empty">Veri yok</p>';
                    return;
                }
                // Özet kartlar

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
                                    '<div class="airline-overview-avatar">' + escapeHtml(initials || 'A') + '</div>' +
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
                overviewSection.style.display = 'block';
                // Çoklu havayolu sentiment listesi

                sentimentListEl.innerHTML = cards.map(function (c) {
                    var total = c.total || 1;
                    var posPct = Math.round((c.pos / total) * 100);
                    var neuPct = Math.round((c.neu / total) * 100);
                    var negPct = Math.max(0, 100 - posPct - neuPct);
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
                // Volume trend chart is now handled by renderTrendChart function via bindTrendYearFilter
                bindTrendYearFilter(cards);

                // Render delay complaint chart using datasetByAirlineData directly
                renderDelayComplaintChartFromDataset();

                // Render average delay duration chart
                renderAverageDelayDurationChartFromDataset();

                comparisonSection.style.display = 'block';
            });
    }

    function renderDelayComplaintChartFromDataset() {
        var delayAnalysisSection = document.getElementById('delay-analysis-section');
        if (!delayAnalysisSection) return;

        console.log('📊 renderDelayComplaintChartFromDataset called');
        console.log('📊 datasetByAirlineData length:', datasetByAirlineData.length);

        if (!datasetByAirlineData || datasetByAirlineData.length === 0) {
            delayAnalysisSection.style.display = 'none';
            return;
        }

        // Calculate delay complaint ratios for each airline
        var delayData = datasetByAirlineData.map(function (group) {
            var reviews = group.reviews || [];
            var total = reviews.length;
            if (total === 0) return null;

            // Filter reviews that contain delay/reroute related keywords
            var delayKeywords = ['rötar', 'gecikme', 'gecik', 'ertel', 'beklet', 'sür', 'uzun', 'bekleme', 'saat', 'dakika'];
            var excludeKeywords = ['kaçırdım', 'kaçırdı', 'kaçır', 'check-in', 'check in', 'yanlış terminal', 'yanlış terminale', 'kendi hatam', 'kendi hatası', 'yeniden rezervasyon', 'aktar', 'aktarıldı', 'sonraki uçuş'];
            var delayCount = 0;

            reviews.forEach(function (r) {
                var content = (r.content || '').toLowerCase();
                var title = (r.title || '').toLowerCase();
                var combined = content + ' ' + title;

                var hasDelayKeyword = delayKeywords.some(function (keyword) {
                    return combined.includes(keyword);
                });

                var hasExcludeKeyword = excludeKeywords.some(function (keyword) {
                    return combined.includes(keyword);
                });

                if (hasDelayKeyword && !hasExcludeKeyword) {
                    delayCount++;
                }
            });

            var delayRatio = total > 0 ? (delayCount / total) * 100 : 0;

            return {
                name: group.airline_name || 'Diğer',
                delayRatio: delayRatio.toFixed(1),
                delayCount: delayCount,
                total: total
            };
        }).filter(function (d) { return d !== null; });

        console.log('📊 delayData calculated:', delayData.length, 'airlines with delay data');

        if (delayData.length === 0) {
            delayAnalysisSection.style.display = 'none';
            return;
        }

        delayAnalysisSection.style.display = 'block';

        // Destroy existing chart if any
        if (window.delayComplaintChart) {
            window.delayComplaintChart.destroy();
            window.delayComplaintChart = null;
        }

        // Sort by delay ratio (descending)
        delayData.sort(function (a, b) {
            return parseFloat(b.delayRatio) - parseFloat(a.delayRatio);
        });

        // Create horizontal bar chart
        var ctx = document.getElementById('delay-complaint-chart');
        if (!ctx) return;

        window.delayComplaintChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: delayData.map(function (d) { return d.name; }),
                datasets: [{
                    label: 'Rötar/Gecikme Şikayet Oranı (%)',
                    data: delayData.map(function (d) { return parseFloat(d.delayRatio); }),
                    backgroundColor: delayData.map(function (d) {
                        var ratio = parseFloat(d.delayRatio);
                        if (ratio > 30) return '#ef4444';
                        if (ratio > 20) return '#f97316';
                        if (ratio > 10) return '#eab308';
                        return '#22c55e';
                    }),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                var index = context.dataIndex;
                                var data = delayData[index];
                                return data.name + ': ' + data.delayRatio + '% (' + data.delayCount + '/' + data.total + ' yorum)';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Rötar/Gecikme Şikayet Oranı (%)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Havayolu Adı'
                        }
                    }
                }
            }
        });
    }

    function renderAverageDelayDurationChartFromDataset() {
        var delayAnalysisSection = document.getElementById('delay-analysis-section');
        if (!delayAnalysisSection) return;

        console.log('📊 renderAverageDelayDurationChartFromDataset called');
        console.log('📊 datasetByAirlineData length:', datasetByAirlineData.length);

        if (!datasetByAirlineData || datasetByAirlineData.length === 0) {
            delayAnalysisSection.style.display = 'none';
            return;
        }

        // Calculate average delay duration for each airline
        var averageDelayData = datasetByAirlineData.map(function (group) {
            var reviews = group.reviews || [];
            if (reviews.length === 0) return null;

            // Keywords for delay/reroute
            var delayKeywords = ['rötar', 'gecikme', 'gecik', 'ertel', 'beklet', 'sür', 'uzun', 'bekleme'];
            // Keywords to exclude (passenger fault situations)
            var excludeKeywords = ['kaçırdım', 'kaçırdı', 'kaçır', 'check-in', 'check in', 'yanlış terminal', 'yanlış terminale', 'kendi hatam', 'kendi hatası', 'yeniden rezervasyon', 'aktar', 'aktarıldı', 'sonraki uçuş'];

            var delayDurations = [];
            var delayReviewCount = 0;

            reviews.forEach(function (r) {
                var content = (r.content || '').toLowerCase();
                var title = (r.title || '').toLowerCase();
                var combined = content + ' ' + title;

                var hasDelayKeyword = delayKeywords.some(function (keyword) {
                    return combined.includes(keyword);
                });

                var hasExcludeKeyword = excludeKeywords.some(function (keyword) {
                    return combined.includes(keyword);
                });

                if (hasDelayKeyword && !hasExcludeKeyword) {
                    delayReviewCount++;

                    // Extract duration from text
                    var duration = extractDelayDuration(combined);
                    if (duration > 0) {
                        delayDurations.push(duration);
                    }
                }
            });

            if (delayDurations.length === 0) return null;

            // Calculate average
            var sum = delayDurations.reduce(function (a, b) { return a + b; }, 0);
            var average = sum / delayDurations.length;

            return {
                name: group.airline_name || 'Diğer',
                averageDelay: average.toFixed(1),
                delayReviewCount: delayReviewCount,
                delayDurationsCount: delayDurations.length
            };
        }).filter(function (d) { return d !== null; });

        console.log('📊 averageDelayData calculated:', averageDelayData.length, 'airlines with average delay data');

        if (averageDelayData.length === 0) {
            delayAnalysisSection.style.display = 'none';
            return;
        }

        delayAnalysisSection.style.display = 'block';

        // Destroy existing chart if any
        if (window.averageDelayChart) {
            window.averageDelayChart.destroy();
            window.averageDelayChart = null;
        }

        // Sort by average delay (descending)
        averageDelayData.sort(function (a, b) {
            return parseFloat(b.averageDelay) - parseFloat(a.averageDelay);
        });

        // Create bar chart (vertical)
        var ctx = document.getElementById('average-delay-chart');
        if (!ctx) return;

        window.averageDelayChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: averageDelayData.map(function (d) { return d.name; }),
                datasets: [{
                    label: 'Ortalama Rötar Süresi (Dakika)',
                    data: averageDelayData.map(function (d) { return parseFloat(d.averageDelay); }),
                    backgroundColor: averageDelayData.map(function (d) {
                        var avg = parseFloat(d.averageDelay);
                        if (avg > 120) return '#ef4444';
                        if (avg > 60) return '#f97316';
                        if (avg > 30) return '#eab308';
                        return '#22c55e';
                    }),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                var index = context.dataIndex;
                                var data = averageDelayData[index];
                                return data.name + ': ' + data.averageDelay + ' dakika (' + data.delayDurationsCount + ' süre belirtilmiş yorum)';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Havayolları'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Ortalama Rötar Süresi (Dakika)'
                        }
                    }
                }
            }
        });
    }

    function extractDelayDuration(text) {
        // Extract duration in minutes from text
        // Patterns: "X dakika", "X saat", "X saat Y dakika", "X dk", "X sa"

        var duration = 0;

        // Check for hours
        var hourPattern = /(\d+)\s*(saat|sa)\b/gi;
        var hourMatches = text.match(hourPattern);
        if (hourMatches) {
            hourMatches.forEach(function (match) {
                var num = parseInt(match.match(/\d+/)[0], 10);
                duration += num * 60; // Convert hours to minutes
            });
        }

        // Check for minutes
        var minutePattern = /(\d+)\s*(dakika|dk|dak)\b/gi;
        var minuteMatches = text.match(minutePattern);
        if (minuteMatches) {
            minuteMatches.forEach(function (match) {
                var num = parseInt(match.match(/\d+/)[0], 10);
                duration += num;
            });
        }

        return duration;
    }

    function renderAverageDelayDurationChart(cards) {
        var delayAnalysisSection = document.getElementById('delay-analysis-section');
        if (!delayAnalysisSection) return;

        console.log('📊 renderAverageDelayDurationChart called with cards:', cards.length, 'cards');

        // Calculate average delay duration for each airline
        var averageDelayData = cards.map(function (c) {
            var reviews = c.reviews || [];
            if (reviews.length === 0) return null;

            // Keywords for delay/reroute
            var delayKeywords = ['rötar', 'gecikme', 'gecik', 'ertel', 'beklet', 'sür', 'uzun', 'bekleme'];
            // Keywords to exclude (passenger fault situations)
            var excludeKeywords = ['kaçırdım', 'kaçırdı', 'kaçır', 'check-in', 'check in', 'yanlış terminal', 'yanlış terminale', 'kendi hatam', 'kendi hatası', 'yeniden rezervasyon', 'aktar', 'aktarıldı', 'sonraki uçuş'];

            var delayDurations = [];
            var delayReviewCount = 0;

            reviews.forEach(function (r) {
                var content = (r.content || '').toLowerCase();
                var title = (r.title || '').toLowerCase();
                var combined = content + ' ' + title;

                var hasDelayKeyword = delayKeywords.some(function (keyword) {
                    return combined.includes(keyword);
                });

                var hasExcludeKeyword = excludeKeywords.some(function (keyword) {
                    return combined.includes(keyword);
                });

                if (hasDelayKeyword && !hasExcludeKeyword) {
                    delayReviewCount++;

                    // Extract duration from text
                    var duration = extractDelayDuration(combined);
                    if (duration > 0) {
                        delayDurations.push(duration);
                    }
                }
            });

            if (delayDurations.length === 0) return null;

            // Calculate average
            var sum = delayDurations.reduce(function (a, b) { return a + b; }, 0);
            var average = sum / delayDurations.length;

            return {
                name: c.name,
                averageDelay: average.toFixed(1),
                delayReviewCount: delayReviewCount,
                delayDurationsCount: delayDurations.length
            };
        }).filter(function (d) { return d !== null; });

        console.log('📊 averageDelayData calculated:', averageDelayData.length, 'airlines with average delay data');

        if (averageDelayData.length === 0) {
            delayAnalysisSection.style.display = 'none';
            return;
        }

        delayAnalysisSection.style.display = 'block';

        // Destroy existing chart if any
        if (window.averageDelayChart) {
            window.averageDelayChart.destroy();
            window.averageDelayChart = null;
        }

        // Sort by average delay (descending)
        averageDelayData.sort(function (a, b) {
            return parseFloat(b.averageDelay) - parseFloat(a.averageDelay);
        });

        // Create bar chart (vertical)
        var ctx = document.getElementById('average-delay-chart');
        if (!ctx) return;

        window.averageDelayChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: averageDelayData.map(function (d) { return d.name; }),
                datasets: [{
                    label: 'Ortalama Rötar Süresi (Dakika)',
                    data: averageDelayData.map(function (d) { return parseFloat(d.averageDelay); }),
                    backgroundColor: averageDelayData.map(function (d) {
                        var avg = parseFloat(d.averageDelay);
                        if (avg > 120) return '#ef4444';
                        if (avg > 60) return '#f97316';
                        if (avg > 30) return '#eab308';
                        return '#22c55e';
                    }),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                var index = context.dataIndex;
                                var data = averageDelayData[index];
                                return data.name + ': ' + data.averageDelay + ' dakika (' + data.delayDurationsCount + ' süre belirtilmiş yorum)';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Havayolları'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Ortalama Rötar Süresi (Dakika)'
                        }
                    }
                }
            }
        });
    }
    function getDatasetReviewsForAirline(airlineName) {
        if (!airlineName || !datasetByAirlineData.length) return [];
        var target = normalizeAirlineKey(airlineName);
        for (var i = 0; i < datasetByAirlineData.length; i++) {
            var groupName = normalizeAirlineKey(datasetByAirlineData[i].airline_name);
            if (groupName === target) {
                return (datasetByAirlineData[i].reviews || []).slice();
            }
        }
        return [];
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
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            bindAnalysisModeToggle();
            loadReviews();
        });
    } else {
        bindAnalysisModeToggle();
        loadReviews();
    }

    // Tüm Yorumlar Fonksiyonalitesi
    var allReviewsState = {
        reviews: [],
        currentPage: 1,
        perPage: 5, // Fixed page size - updated to 5
        sortBy: 'date_desc',
        totalCount: 0,
        totalPages: 0,
        sentimentFilter: '',
        searchQuery: ''
    };

    function initAllReviews() {
        var sortSelect = document.getElementById('all-reviews-sort-select');
        var prevBtn = document.getElementById('all-reviews-prev-btn');
        var nextBtn = document.getElementById('all-reviews-next-btn');
        var filterButtons = document.getElementById('all-reviews-filter-buttons');
        var searchInput = document.getElementById('all-reviews-search-input');

        if (sortSelect) {
            sortSelect.addEventListener('change', function() {
                allReviewsState.sortBy = this.value;
                allReviewsState.currentPage = 1;
                renderAllReviews();
            });
        }

        // Filter buttons for all reviews
        if (filterButtons) {
            // Set initial active state
            var allBtns = filterButtons.querySelectorAll('.review-filter-btn');
            allBtns.forEach(function (b) { 
                if (b.getAttribute('data-sentiment') === '') {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            
            filterButtons.addEventListener('click', function (evt) {
                var btn = evt.target.closest('.review-filter-btn');
                if (!btn) return;
                var sentiment = btn.getAttribute('data-sentiment');
                allReviewsState.sentimentFilter = sentiment;
                allReviewsState.currentPage = 1;
                
                // Update active state
                var allBtns = filterButtons.querySelectorAll('.review-filter-btn');
                allBtns.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                
                renderAllReviews();
            });
        }

        // Search for all reviews
        if (searchInput) {
            var searchTimeout;
            searchInput.addEventListener('input', function () {
                var value = this.value.trim();
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(function () {
                    allReviewsState.searchQuery = value.toLowerCase();
                    allReviewsState.currentPage = 1;
                    renderAllReviews();
                }, 200);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                if (allReviewsState.currentPage > 1) {
                    allReviewsState.currentPage--;
                    renderAllReviews();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                if (allReviewsState.currentPage < allReviewsState.totalPages) {
                    allReviewsState.currentPage++;
                    renderAllReviews();
                }
            });
        }
    }

    function loadAllReviews() {
        var apiUrl = currentAnalysisMode === 'dataset' 
            ? '/api/airline-dataset-reviews/all'
            : '/api/reviews/all';
            
        fetch(apiUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(function(data) {
                allReviewsState.reviews = data.reviews || [];
                allReviewsState.totalCount = allReviewsState.reviews.length;
                allReviewsState.currentPage = 1;
                
                // Show the section if we have reviews
                var section = document.getElementById('all-reviews-section');
                if (section && allReviewsState.reviews.length > 0) {
                    section.style.display = 'block';
                    renderAllReviews();
                }
            })
            .catch(function(error) {
                console.error('Error loading all reviews:', error);
            });
    }

    function sortReviews(reviews, sortBy) {
        var sorted = reviews.slice();
        switch(sortBy) {
            case 'date_desc':
                sorted.sort(function(a, b) {
                    var dateA = new Date(a.review_date || '1970-01-01');
                    var dateB = new Date(b.review_date || '1970-01-01');
                    return dateB - dateA;
                });
                break;
            case 'date_asc':
                sorted.sort(function(a, b) {
                    var dateA = new Date(a.review_date || '1970-01-01');
                    var dateB = new Date(b.review_date || '1970-01-01');
                    return dateA - dateB;
                });
                break;
            case 'rating_desc':
                sorted.sort(function(a, b) {
                    return (b.rating || 0) - (a.rating || 0);
                });
                break;
            case 'rating_asc':
                sorted.sort(function(a, b) {
                    return (a.rating || 0) - (b.rating || 0);
                });
                break;
        }
        return sorted;
    }

    function renderAllReviewsCard(review) {
        var route = review.route || '—';
        var reviewDate = formatDate(review.review_date);
        var title = (review.title || '').trim();
        var content = (review.content || '').trim();
        var username = review.user_name || review.username || 'Anonim';
        var contributions = review.user_total_reviews || null;
        var initials = getInitialsFromReview(review);
        var initialsCode = (initials.charCodeAt(0) || 0) + (initials.charCodeAt(1) || 0);
        var avatarColorClass = 'avatar-color-' + (initialsCode % 6);
        var rating = Math.min(5, Math.max(1, parseInt(review.rating, 10) || 0));
        var stars = generateStars(rating);
        
        // Remove airline name from route if it exists (for unified display)
        var cleanRoute = route;
        if (currentAnalysisMode === 'dataset' && review.airline_name) {
            // For dataset reviews, remove airline name prefix if present
            cleanRoute = route.replace(new RegExp('^' + escapeRegExp(review.airline_name) + '\\s*[-–—]?\\s*', 'i'), '').trim() || route;
        }
        
        return (
            '<div class="review-card">' +
                '<div class="review-card-meta">' +
                    '<span class="review-avatar-circle ' + avatarColorClass + '" aria-hidden="true">' + escapeHtml(initials) + '</span>' +
                    '<span class="review-username">' + escapeHtml(username) + '</span>' +
                    (contributions && contributions > 1
                        ? '<span class="review-contributions" title="Bu kullanıcının yorum sayısı">' +
                          escapeHtml(String(contributions)) +
                          ' katkı' +
                          '</span>'
                        : '') +
                    '<span class="review-route"><i class="fas fa-route"></i> ' + escapeHtml(cleanRoute) + '</span>' +
                    '<span class="review-date"><i class="far fa-calendar-alt"></i> ' + escapeHtml(reviewDate) + '</span>' +
                    '<span class="review-rating">' + stars + ' <span class="rating-num">' + rating + '/5</span></span>' +
                '</div>' +
                (title ? '<h4 class="review-title">' + escapeHtml(title) + '</h4>' : '') +
                (content ? '<div class="review-content">' + escapeHtml(content) + '</div>' : '') +
            '</div>'
        );
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function renderAllReviews() {
        // Apply filters
        var filteredReviews = allReviewsState.reviews.filter(function(review) {
            // Sentiment filter
            if (allReviewsState.sentimentFilter) {
                var sentiment = getSentimentFromRatingValue(review.rating);
                if (sentiment !== allReviewsState.sentimentFilter) {
                    return false;
                }
            }
            
            // Search filter
            if (allReviewsState.searchQuery) {
                var content = String(review.content || '').toLowerCase();
                var title = String(review.title || '').toLowerCase();
                var query = allReviewsState.searchQuery.toLowerCase();
                if (content.indexOf(query) === -1 && title.indexOf(query) === -1) {
                    return false;
                }
            }
            
            return true;
        });
        
        var sortedReviews = sortReviews(filteredReviews, allReviewsState.sortBy);
        allReviewsState.totalPages = Math.ceil(sortedReviews.length / allReviewsState.perPage);
        
        var startIndex = (allReviewsState.currentPage - 1) * allReviewsState.perPage;
        var endIndex = Math.min(startIndex + allReviewsState.perPage, sortedReviews.length);
        var pageReviews = sortedReviews.slice(startIndex, endIndex);

        // Render reviews using unified function (no airline distinction)
        var listElement = document.getElementById('all-reviews-list');
        if (listElement) {
            if (pageReviews.length === 0) {
                listElement.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">Gösterilecek yorum bulunamadı.</p>';
            } else {
                var cardsHtml = pageReviews.map(function(review) {
                    return renderAllReviewsCard(review);
                }).join('');
                listElement.innerHTML = cardsHtml;
            }
        }

        // Update pagination
        updateAllReviewsPagination(startIndex + 1, endIndex, filteredReviews.length);
    }

    function updateAllReviewsPagination(startIndex, endIndex, filteredCount) {
        var pageInfoElement = document.getElementById('all-reviews-page-info');
        var prevBtn = document.getElementById('all-reviews-prev-btn');
        var nextBtn = document.getElementById('all-reviews-next-btn');

        if (pageInfoElement) {
            if (filteredCount === 0) {
                pageInfoElement.textContent = 'Yorum yok';
            } else {
                pageInfoElement.textContent = 'Gösterilen ' + startIndex + '–' + endIndex + ' / ' + filteredCount + ' yorum';
            }
        }

        if (prevBtn) {
            prevBtn.disabled = allReviewsState.currentPage <= 1;
        }

        if (nextBtn) {
            nextBtn.disabled = allReviewsState.currentPage >= allReviewsState.totalPages;
        }
    }

    // Initialize all reviews functionality
    initAllReviews();
    
    // Load all reviews when page loads - only if all airlines selected
    if (!currentSelectedAirline) {
        loadAllReviews();
    }

    function bindSummaryListPaginationEvents() {
        // Remove existing listeners to avoid duplicates
        document.removeEventListener('click', handleSummaryListPagination);
        
        // Add new listener
        document.addEventListener('click', handleSummaryListPagination);
    }
    
    function handleSummaryListPagination(evt) {
        var btn = evt.target.closest('.summary-page-btn');
        if (!btn) return;
        
        var listId = btn.getAttribute('data-list-id');
        var dir = btn.getAttribute('data-dir');
        if (!listId || !dir) return;
        
        // Determine which data to use and which page variable to update
        var isComplaintList = listId.includes('complaints');
        var pageVar = isComplaintList ? summaryComplaintsPage : summaryLikedListPage;
        var dataVar = isComplaintList ? summaryComplaintsData : summaryLikedListData;
        var isNegative = isComplaintList;
        
        if (!dataVar || !dataVar.length) return;
        
        var totalPages = Math.max(1, Math.ceil(dataVar.length / SUMMARY_ITEMS_PER_PAGE));
        
        if (dir === 'prev') {
            pageVar = Math.max(1, pageVar - 1);
        } else if (dir === 'next') {
            pageVar = Math.min(totalPages, pageVar + 1);
        }
        
        // Update the appropriate page variable
        if (isComplaintList) {
            summaryComplaintsPage = pageVar;
        } else {
            summaryLikedListPage = pageVar;
        }
        
        // Re-render the list
        var listEl = document.getElementById(listId);
        if (listEl) {
            listEl.innerHTML = renderPaginatedSummaryList.call(Common, dataVar, isNegative, SUMMARY_ITEMS_PER_PAGE, pageVar, listId);
        }
    }

})();
