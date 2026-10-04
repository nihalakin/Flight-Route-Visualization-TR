/**
 * Ortak Yorum Analizi Fonksiyonları
 * airline-reviews.js ve airline-reviews-dataset.js tarafından paylaşılır
 */

(function (global) {
    'use strict';

    var ReviewsCommon = {
        // Escape HTML entities
        escapeHtml: function (s) {
            if (s == null) return '';
            var t = String(s);
            return t
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        },

        // Set text content of an element
        setText: function (id, value) {
            var el = document.getElementById(id);
            if (el) el.textContent = value;
        },

        // Format date to Turkish locale
        formatDate: function (d) {
            if (!d) return '—';
            var date = new Date(d);
            return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        },

        // Normalize airline name for comparison
        normalizeAirlineName: function (name) {
            return String(name || '')
                .trim()
                .toLocaleLowerCase('tr-TR');
        },

        // Get airline key for grouping
        normalizeAirlineKey: function (name) {
            if (!name) return null;
            var n = String(name).toLowerCase();
            if (n.includes('turkish') || n.includes('thy') || n.includes('türk hava')) return 'turkish';
            if (n.includes('pegasus')) return 'pegasus';
            if (n.includes('ajet')) return 'ajet';
            if (n.includes('sunexpress') || n.includes('sun express')) return 'sunexpress';
            return null;
        },

        // Get sentiment from rating value
        getSentimentFromRatingValue: function (rating) {
            var star = Math.min(5, Math.max(1, parseInt(rating, 10) || 0));
            if (star >= 4) return 'positive';
            if (star <= 2) return 'negative';
            return 'neutral';
        },

        // Generate star rating HTML
        generateStars: function (rating) {
            var r = Math.min(5, Math.max(1, parseInt(rating, 10) || 0));
            var stars = '';
            for (var i = 1; i <= 5; i++) {
                stars += i <= r
                    ? '<i class="fas fa-star star-filled"></i>'
                    : '<i class="far fa-star star-empty"></i>';
            }
            return stars;
        },

        // Get initials from username
        getInitials: function (username) {
            var name = String(username || 'A').trim();
            if (!name) return 'A';
            var parts = name.split(/\s+/).filter(Boolean);
            if (parts.length === 1) {
                return parts[0].charAt(0).toUpperCase();
            }
            var first = parts[0].charAt(0).toUpperCase();
            var last = parts[parts.length - 1].charAt(0).toUpperCase();
            return first + last;
        },

        // Render summary item HTML
        renderSummaryItem: function (text, isNegative) {
            var str = String(text || '').trim();
            if (!str) return '';
            var idx = str.indexOf(':');
            var title = idx > 0 ? str.slice(0, idx).trim() : '';
            var desc = idx > 0 ? str.slice(idx + 1).trim() : str;
            var icon = isNegative ? 'fa-exclamation-circle' : 'fa-check-circle';
            if (title && desc) {
                return '<div class="summary-item"><i class="fas ' + icon + '" aria-hidden="true"></i><div><div class="summary-item-title">' +
                    this.escapeHtml(title) +
                    '</div><div class="summary-item-desc">' +
                    this.escapeHtml(desc) +
                    '</div></div></div>';
            }
            return '<div class="summary-item"><i class="fas ' + icon + '" aria-hidden="true"></i><div class="summary-item-desc">' +
                this.escapeHtml(str) +
                '</div></div>';
        },

        // Render summary list HTML with pagination
        renderSummaryList: function (items, isNegative, emptyMessage) {
            emptyMessage = emptyMessage || 'Veri yok';
            if (!items || !items.length) {
                return '<p class="summary-list-empty">' + emptyMessage + '</p>';
            }
            var self = this;
            return items.map(function (t) { return self.renderSummaryItem(t, isNegative); }).join('');
        },

        // Render paginated summary list
        renderPaginatedSummaryList: function (items, isNegative, itemsPerPage, currentPage, listId, emptyMessage) {
            emptyMessage = emptyMessage || 'Veri yok';
            if (!items || !items.length) {
                return '<p class="summary-list-empty">' + emptyMessage + '</p>';
            }
            
            var total = items.length;
            var totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;
            
            var start = (currentPage - 1) * itemsPerPage;
            var pageItems = items.slice(start, start + itemsPerPage);
            
            var self = this;
            var itemsHtml = pageItems.map(function (t) { return self.renderSummaryItem(t, isNegative); }).join('');
            
            var pagerHtml = '';
            if (totalPages > 1) {
                pagerHtml = 
                    '<div class="summary-pager" data-position="left">' +
                        '<button type="button" class="summary-page-btn" data-list-id="' + listId + '" data-dir="prev"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="fas fa-angle-left"></i></button>' +
                    '</div>' +
                    '<div class="summary-pager" data-position="right">' +
                        '<button type="button" class="summary-page-btn" data-list-id="' + listId + '" data-dir="next"' + (currentPage >= totalPages ? ' disabled' : '') + '><i class="fas fa-angle-right"></i></button>' +
                    '</div>';
            }
            
            return itemsHtml + pagerHtml;
        },

        // Topic Grouping Utilities
        synonymGroups: [
            // Bagaj / Bavul grubu
            ['bavul', 'valiz', 'eşya', 'bagaj', 'çanta', 'suitcase', 'luggage', 'baggage'],
            ['kaybı', 'kaybolma', 'kayboluyor', 'kayıp', 'kayboldu', 'kaybetme'],
            ['hasarı', 'hasar', 'kırılma', 'kırık', 'zarar', 'zarar görmüş', 'parça'],
            // Gecikme / Rötar grubu
            ['gecikme', 'gecikmeli', 'rötar', 'erteleme', 'geç', 'geç kaldı', 'geç kalktı', 'geciken', 'rötarsız'],
            ['gecikti', 'ertelendi', 'süresiz', 'süresiz bekleyiş', 'bekleme', 'bekletme'],
            // Fiyat / Ücret / Maliyet grubu
            ['fiyat', 'ücret', 'maliyet', 'bedel', 'bilet', 'ücretli', 'fiyatlandırma', 'ekstra', 'masraf', 'fazla ücret', 'para', 'ücret talep', 'ek ücret', 'fahiş'],
            ['pahalı', 'ucuz', 'değer', 'ekonomik', 'indirim', 'kampanya'],
            // Müşteri / Yolcu Hizmetleri grubu
            ['müşteri', 'yolcu', 'müşteriler', 'yolcular', 'müşteri hizmetleri', 'destek', 'yardım'],
            ['hizmet', 'servis', 'hizmet kalitesi', 'hizmet anlayışı'],
            ['şikayet', 'şikayetim', 'sorun', 'problem', 'sıkıntı'],
            // Yemek / Catering grubu
            ['yemek', 'catering', 'gıda', 'yiyecek', 'ikram', 'açık büfe', 'yemek servisi', 'içecek'],
            // Personel / Çalışan grubu
            ['personel', 'hostes', 'hostesler', 'görevli', 'çalışan', 'kabin ekibi', 'pilot', 'ekip'],
            ['davranış', 'nezaket', 'saygı', 'ilgi', 'ilgisiz', 'kaba', 'nazik'],
            // Koltuk / Konfor grubu
            ['koltuk', 'koltuklar', 'oturma', 'yer', 'konfor', 'rahatlık', 'sıkışık', 'dar'],
            ['uçak', 'uçaklar', 'uçuş', 'sefer', 'flight', 'aircraft', 'uçuş deneyimi'],
            // Temizlik / Hijyen grubu
            ['temizlik', 'kirli', 'pis', 'hijyen', 'temiz', 'bakımsız'],
            // Check-in / Biniş grubu
            ['check', 'checkin', 'check-in', 'kontrol', 'biniş', 'giriş', 'kapı', 'counter'],
            // Bilgilendirme / İletişim grubu
            ['bilgilendirme', 'bilgi', 'duyuru', 'anons', 'haber verme', 'açıklama', 'bilgilendirmedikleri'],
            ['yanlış bilgi', 'hatalı bilgilendirme', 'yetersiz bilgi', 'bilgi eksikliği'],
            // Sağlık / Müdahale grubu
            ['sağlık', 'hastalık', 'doktor', 'ilkyardım', 'ambulans', 'müdahale', 'sağlık sorunu'],
            // Online / Dijital Hizmetler grubu
            ['online', 'internet', 'web', 'site', 'uygulama', 'app', 'mobil', 'dijital'],
            // Koltuk seçimi / Rezervasyon grubu
            ['rezervasyon', 'koltuk seçimi', 'seat selection', 'koltuk numarası', 'oturma düzeni'],
            // İptal / Değişiklik grubu
            ['iptal', 'iptal edildi', 'değişiklik', 'değiştirme', 'flight change', 'cancel'],
            // Güvenlik grubu
            ['güvenlik', 'güvenli', 'emniyet', 'risk', 'tehlike', 'korku', 'turbulans']
        ],

        normalizeForGrouping: function (text) {
            return String(text || '')
                .toLowerCase()
                .replace(/[^\w\sğüşıöç]/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        },

        getTopicKeywords: function (text) {
            var normalized = this.normalizeForGrouping(text);
            return normalized.split(' ').filter(function(w) {
                return w.length > 2;
            });
        },

        expandWithSynonyms: function (words) {
            var expanded = words.slice();
            var groups = this.synonymGroups;
            for (var i = 0; i < words.length; i++) {
                var w = words[i];
                for (var j = 0; j < groups.length; j++) {
                    var group = groups[j];
                    if (group.indexOf(w) !== -1) {
                        for (var k = 0; k < group.length; k++) {
                            if (expanded.indexOf(group[k]) === -1) {
                                expanded.push(group[k]);
                            }
                        }
                    }
                }
            }
            return expanded;
        },

        areTopicsSimilar: function (text1, text2, threshold) {
            threshold = threshold || 0.25;
            var t1 = this.normalizeForGrouping(text1);
            var t2 = this.normalizeForGrouping(text2);
            if (t1 === t2) return true;
            if (t1.indexOf(t2) !== -1 || t2.indexOf(t1) !== -1) return true;
            
            var words1 = this.getTopicKeywords(text1);
            var words2 = this.getTopicKeywords(text2);
            var expanded1 = this.expandWithSynonyms(words1);
            var expanded2 = this.expandWithSynonyms(words2);
            
            var common = 0;
            for (var i = 0; i < expanded1.length; i++) {
                if (expanded2.indexOf(expanded1[i]) !== -1) common++;
            }
            var similarity = common / Math.max(expanded1.length, expanded2.length);
            return similarity >= threshold;
        },

        mergeDescriptions: function (existingDesc, newDesc) {
            if (!existingDesc) return newDesc;
            if (!newDesc) return existingDesc;
            if (existingDesc.indexOf(newDesc) !== -1) return existingDesc;
            if (newDesc.indexOf(existingDesc) !== -1) return newDesc;
            return existingDesc + '\n' + newDesc;
        },

        groupSimilarTopics: function (list, limit) {
            var groups = [];
            for (var i = 0; i < list.length; i++) {
                var raw = String(list[i] || '').trim();
                if (!raw) continue;
                var idx = raw.indexOf(':');
                var title = idx > 0 ? raw.slice(0, idx).trim() : raw;
                var desc = idx > 0 ? raw.slice(idx + 1).trim() : '';
                var foundGroup = null;
                for (var j = 0; j < groups.length; j++) {
                    if (this.areTopicsSimilar(groups[j].title, title)) {
                        foundGroup = groups[j];
                        break;
                    }
                }
                if (foundGroup) {
                    foundGroup.desc = this.mergeDescriptions(foundGroup.desc, desc);
                } else {
                    groups.push({ title: title, desc: desc, full: raw });
                }
            }
            var result = [];
            for (var k = 0; k < groups.length && result.length < limit; k++) {
                var g = groups[k];
                result.push(g.desc ? g.title + ': ' + g.desc : g.title);
            }
            return result;
        }
    };

    // Export to global scope
    global.ReviewsCommon = ReviewsCommon;

})(window);
