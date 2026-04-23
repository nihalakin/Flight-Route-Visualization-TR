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

    var byAirlineData = [];
    var analysisByAirline = [];

    var analysisSection = document.getElementById('airline-analysis');
    var analysisEmptyEl = document.getElementById('analysis-empty');
    var analysisContentEl = document.getElementById('analysis-content');
    var positiveBarEl = document.getElementById('sentiment-positive-bar');
    var negativeBarEl = document.getElementById('sentiment-negative-bar');
    var neutralBarEl = document.getElementById('sentiment-neutral-bar');
    var positiveCountEl = document.getElementById('sentiment-positive-count');
    var negativeCountEl = document.getElementById('sentiment-negative-count');
    var neutralCountEl = document.getElementById('sentiment-neutral-count');
    var totalLabelEl = document.getElementById('sentiment-total');
    var negativeTopicsEl = document.getElementById('negative-topics');
    var positiveTopicsEl = document.getElementById('positive-topics');

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

    function renderReviewCard(review) {
        var route = review.route || '—';
        var reviewDate = formatDate(review.review_date);
        var title = (review.title || '').trim();
        var content = (review.content || '').trim();
        var username = review.username || 'Anonim';
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
                    '<span class="review-username">' + escapeHtml(username) + '</span>' +
                    '<span class="review-route"><i class="fas fa-route"></i> ' + escapeHtml(route) + '</span>' +
                    '<span class="review-date"><i class="far fa-calendar-alt"></i> ' + escapeHtml(reviewDate) + '</span>' +
                    '<span class="review-rating">' + stars + ' <span class="rating-num">' + rating + '/5</span></span>' +
                '</div>' +
                (title ? '<h4 class="review-title">' + escapeHtml(title) + '</h4>' : '') +
                (content ? '<div class="review-content">' + escapeHtml(content) + '</div>' : '') +
            '</div>'
        );
    }

    function renderAirlineSection(airlineName, reviews) {
        var cardsHtml = reviews.map(function (r) { return renderReviewCard(r); }).join('');
        return (
            '<section class="airline-section" data-airline="' + escapeHtml(airlineName) + '">' +
                '<div class="airline-section-header">' +
                    '<h2 class="airline-section-title"><i class="fas fa-plane"></i> ' + escapeHtml(airlineName) + '</h2>' +
                    '<span class="airline-section-count">' + reviews.length + ' yorum</span>' +
                '</div>' +
                '<div class="airline-reviews-list">' + cardsHtml + '</div>' +
            '</section>'
        );
    }

    function populateDropdown() {
        if (!airlineSelect) return;
        airlineSelect.innerHTML = '<option value="">Tüm havayolları</option>';
        for (var i = 0; i < byAirlineData.length; i++) {
            var name = byAirlineData[i].airline_name || 'Diğer';
            var opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            airlineSelect.appendChild(opt);
        }
    }

    function updateResultsCount(selected) {
        if (!resultsCountEl) return;
        var total = 0;
        var label = '';
        if (!selected) {
            for (var i = 0; i < byAirlineData.length; i++) total += (byAirlineData[i].reviews || []).length;
            label = total === 1 ? '1 yorum' : total + ' yorum';
        } else {
            for (var j = 0; j < byAirlineData.length; j++) {
                if (byAirlineData[j].airline_name === selected) {
                    total = (byAirlineData[j].reviews || []).length;
                    break;
                }
            }
            label = total === 1 ? '1 yorum' : total + ' yorum';
        }
        resultsCountEl.textContent = label;
    }

    function renderSections(selectedAirline) {
        if (!sectionsContainer) return;
        var html = '';
        for (var i = 0; i < byAirlineData.length; i++) {
            var group = byAirlineData[i];
            var name = group.airline_name || 'Diğer';
            var reviews = group.reviews || [];
            if (reviews.length === 0) continue;
            if (selectedAirline && name !== selectedAirline) continue;
            html += renderAirlineSection(name, reviews);
        }
        sectionsContainer.innerHTML = html;
        updateResultsCount(selectedAirline || null);

        // Seçili havayolu için analiz bölümünü güncelle
        updateAnalysisForAirline(selectedAirline || null);
    }

    function findAnalysisForAirline(airlineName) {
        if (!analysisByAirline || !Array.isArray(analysisByAirline)) return null;
        if (!airlineName) return null;
        var trimmed = airlineName.trim().toLowerCase();
        for (var i = 0; i < analysisByAirline.length; i++) {
            var item = analysisByAirline[i];
            if (!item || !item.airline_name) continue;
            if (String(item.airline_name).trim().toLowerCase() === trimmed) {
                return item;
            }
        }
        return null;
    }

    function updateSentimentBars(stats) {
        if (!positiveBarEl || !negativeBarEl || !neutralBarEl) return;

        var total = stats.total_reviews || 0;
        var pos = stats.positive || 0;
        var neg = stats.negative || 0;
        var neu = stats.neutral || 0;

        var posPct = total > 0 ? Math.round((pos / total) * 100) : 0;
        var negPct = total > 0 ? Math.round((neg / total) * 100) : 0;
        var neuPct = total > 0 ? Math.round((neu / total) * 100) : 0;

        positiveBarEl.style.width = posPct + '%';
        negativeBarEl.style.width = negPct + '%';
        neutralBarEl.style.width = neuPct + '%';

        if (positiveCountEl) positiveCountEl.textContent = String(pos);
        if (negativeCountEl) negativeCountEl.textContent = String(neg);
        if (neutralCountEl) neutralCountEl.textContent = String(neu);
        if (totalLabelEl) {
            totalLabelEl.textContent = total > 0 ? ('Toplam ' + total + ' yorum') : 'Toplam 0 yorum';
        }
    }

    function renderTopics(list, containerEl, type) {
        if (!containerEl) return;
        containerEl.innerHTML = '';
        if (!list || !Array.isArray(list) || list.length === 0) {
            var span = document.createElement('span');
            span.className = 'topic-badge';
            span.textContent = 'Henüz tespit edilen konu yok';
            containerEl.appendChild(span);
            return;
        }
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var label;
            var keywordsText = '';

            if (typeof item === 'string') {
                // Eski format: sadece string label
                label = item;
            } else if (item && typeof item === 'object') {
                // Yeni format: { topic, keywords, count }
                label = item.topic || '';
                if (Array.isArray(item.keywords) && item.keywords.length > 0) {
                    keywordsText = ' — ' + item.keywords.join(', ');
                }
            } else {
                continue;
            }

            if (!label) continue;
            var badge = document.createElement('span');
            badge.className = 'topic-badge ' + (type === 'positive' ? 'positive' : 'negative');
            var icon = document.createElement('i');
            if (type === 'positive') {
                icon.className = 'fas fa-heart';
            } else {
                icon.className = 'fas fa-circle-exclamation';
            }
            badge.appendChild(icon);
            var text = document.createElement('span');
            text.textContent = ' ' + label + keywordsText;
            badge.appendChild(text);
            containerEl.appendChild(badge);
        }
    }

    function updateAnalysisForAirline(selectedAirline) {
        if (!analysisSection || !analysisEmptyEl || !analysisContentEl) return;

        if (!selectedAirline) {
            // Tüm havayolları seçiliyken analiz bölümünü gizle
            analysisSection.style.display = 'none';
            return;
        }

        var stats = findAnalysisForAirline(selectedAirline);
        if (!stats) {
            analysisSection.style.display = 'block';
            analysisEmptyEl.style.display = 'flex';
            analysisContentEl.style.display = 'none';
            return;
        }

        analysisSection.style.display = 'block';
        analysisEmptyEl.style.display = 'none';
        analysisContentEl.style.display = 'block';

        updateSentimentBars(stats);
        renderTopics(stats.top_negative_topics || [], negativeTopicsEl, 'negative');
        renderTopics(stats.top_positive_topics || [], positiveTopicsEl, 'positive');
    }

    function onAirlineChange() {
        var value = airlineSelect && airlineSelect.value ? airlineSelect.value.trim() : '';
        renderSections(value || null);
    }

    function loadAnalysis() {
        if (!analysisSection) return;
        fetch(API_BASE + '/api/airline-analysis')
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var byAirline = data && data.by_airline;
                if (!byAirline || !Array.isArray(byAirline)) {
                    analysisSection.style.display = 'none';
                    return;
                }
                analysisByAirline = byAirline;

                // Eğer halihazırda seçili bir havayolu varsa analizini güncelle
                var selected = airlineSelect && airlineSelect.value ? airlineSelect.value.trim() : '';
                if (selected) {
                    updateAnalysisForAirline(selected);
                }
            })
            .catch(function () {
                // Analiz yoksa UI'yı sessizce gizle
                if (analysisSection) analysisSection.style.display = 'none';
            });
    }

    function loadReviews() {
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
                renderSections(null);
                showContent(true);

                if (airlineSelect) {
                    airlineSelect.addEventListener('change', onAirlineChange);
                }

                // Yorumlar yüklendikten sonra analiz verisini getir
                loadAnalysis();
            })
            .catch(function () {
                showEmpty(true);
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadReviews);
    } else {
        loadReviews();
    }
})();
