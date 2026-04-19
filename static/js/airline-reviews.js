/**
 * Havayolu Yorumları sayfası.
 * Admin panelinden onaylanan yorumları havayoluna göre gruplar ve listeler.
 */
(function () {
    'use strict';

    var API_BASE = window.location.origin;
    var loadingEl = document.getElementById('loading-state');
    var emptyEl = document.getElementById('empty-state');
    var contentEl = document.getElementById('content-area');
    var sectionsContainer = document.getElementById('airline-sections');

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

        var cardHtml =
            '<div class="review-card">' +
                '<div class="review-card-meta">' +
                    '<span class="review-username">' + escapeHtml(username) + '</span>' +
                    '<span class="review-route"><i class="fas fa-route"></i> ' + escapeHtml(route) + '</span>' +
                    '<span class="review-date"><i class="far fa-calendar-alt"></i> ' + escapeHtml(reviewDate) + '</span>' +
                    '<span class="review-rating">' + stars + ' <span class="rating-num">' + rating + '/5</span></span>' +
                '</div>' +
                (title ? '<h4 class="review-title">' + escapeHtml(title) + '</h4>' : '') +
                (content ? '<div class="review-content">' + escapeHtml(content) + '</div>' : '') +
            '</div>';
        return cardHtml;
    }

    function renderAirlineSection(airlineName, reviews) {
        var cardsHtml = reviews.map(function (r) { return renderReviewCard(r); }).join('');
        var section =
            '<section class="airline-section">' +
                '<h2 class="airline-section-title"><i class="fas fa-plane"></i> ' + escapeHtml(airlineName) + '</h2>' +
                '<p class="airline-section-count">' + reviews.length + ' yorum</p>' +
                '<div class="airline-reviews-list">' + cardsHtml + '</div>' +
            '</section>';
        return section;
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

                var totalReviews = 0;
                var html = '';
                for (var i = 0; i < byAirline.length; i++) {
                    var group = byAirline[i];
                    var name = group.airline_name || 'Diğer';
                    var reviews = group.reviews || [];
                    totalReviews += reviews.length;
                    if (reviews.length > 0) {
                        html += renderAirlineSection(name, reviews);
                    }
                }

                if (html === '') {
                    showEmpty(true);
                    return;
                }

                sectionsContainer.innerHTML = html;
                showContent(true);
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
