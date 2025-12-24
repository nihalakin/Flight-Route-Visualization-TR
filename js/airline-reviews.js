// Havayolu Yorum Analizi Modülü
class AirlineReviews {
    constructor() {
        this.reviewsData = [];
        this.airlines = new Set();
        this.currentAirline = '';
        this.filteredReviews = [];
        this.charts = {};
        
        this.initialize();
    }

    initialize() {
        this.loadCSVData();
        this.bindEvents();
    }

    async loadCSVData() {
        try {
            const response = await fetch('assets/data/turkish_airlines_reviews.csv');
            const csvText = await response.text();
            this.parseCSV(csvText);
            this.populateAirlines();
        } catch (error) {
            console.error('CSV yüklenirken hata:', error);
            this.showErrorMessage('Veriler yüklenirken bir hata oluştu.');
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        this.reviewsData = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = this.parseCSVLine(lines[i]);
            
            if (values.length >= headers.length) {
                const review = {
                    id: i,
                    airline: values[1]?.trim(),
                    username: values[2]?.trim(),
                    contributions: parseInt(values[3]) || 0,
                    rating: parseInt(values[4]) || 0,
                    title: values[5]?.trim(),
                    route: values[6]?.trim(),
                    category: values[7]?.trim(),
                    travelDate: values[8]?.trim(),
                    reviewDate: values[9]?.trim(),
                    content: values[10]?.trim(),
                    sentiment: values[11]?.trim()
                };
                
                this.reviewsData.push(review);
                if (review.airline) {
                    this.airlines.add(review.airline);
                }
            }
        }
        
        console.log(`${this.reviewsData.length} yorum yüklendi.`);
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    populateAirlines() {
        const select = document.getElementById('airline-select');
        const airlinesArray = Array.from(this.airlines).sort();
        
        airlinesArray.forEach(airline => {
            const option = document.createElement('option');
            option.value = airline;
            option.textContent = airline;
            select.appendChild(option);
        });
    }

    bindEvents() {
        document.getElementById('analyze-airline').addEventListener('click', () => {
            this.analyzeSelectedAirline();
        });

        document.getElementById('airline-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.analyzeAirline(e.target.value);
            }
        });

        // Filtre butonları
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterReviews(e.target.dataset.filter);
            });
        });

        // Sıralama seçeneği
        document.getElementById('sort-select').addEventListener('change', () => {
            this.sortReviews();
        });

        // Sayfa yüklendiğinde ilk havayolunu analiz et
        if (this.reviewsData.length > 0 && this.airlines.size > 0) {
            const firstAirline = Array.from(this.airlines)[0];
            document.getElementById('airline-select').value = firstAirline;
            this.analyzeAirline(firstAirline);
        }
    }

    analyzeSelectedAirline() {
        const select = document.getElementById('airline-select');
        if (select.value) {
            this.analyzeAirline(select.value);
        } else {
            alert('Lütfen bir havayolu seçin.');
        }
    }

    analyzeAirline(airline) {
        this.currentAirline = airline;
        this.filteredReviews = this.reviewsData.filter(review => review.airline === airline);
        
        this.updateStatistics();
        this.createSentimentChart();
        this.analyzeFeatures();
        this.createRatingChart();
        this.createTrendChart();
        this.displayReviews();
    }

    updateStatistics() {
        const total = this.filteredReviews.length;
        const positive = this.filteredReviews.filter(r => r.sentiment === 'Olumlu').length;
        const negative = this.filteredReviews.filter(r => r.sentiment === 'Olumsuz').length;
        const neutral = this.filteredReviews.filter(r => r.sentiment === 'Nötr').length;
        
        const avgRating = this.filteredReviews.reduce((sum, r) => sum + r.rating, 0) / total || 0;
        
        // Genel istatistikleri güncelle
        document.getElementById('total-reviews').textContent = total;
        document.getElementById('positive-reviews').textContent = positive;
        document.getElementById('negative-reviews').textContent = negative;
        document.getElementById('neutral-reviews').textContent = neutral;
        
        document.getElementById('positive-percentage').textContent = total > 0 ? `${((positive/total)*100).toFixed(1)}%` : '0%';
        document.getElementById('negative-percentage').textContent = total > 0 ? `${((negative/total)*100).toFixed(1)}%` : '0%';
        document.getElementById('neutral-percentage').textContent = total > 0 ? `${((neutral/total)*100).toFixed(1)}%` : '0%';
        
        document.getElementById('average-rating').textContent = avgRating.toFixed(1);
        
        // Yıldızları güncelle
        const starsFilled = document.getElementById('stars-filled');
        const percentage = (avgRating / 5) * 100;
        starsFilled.style.width = `${percentage}%`;
    }

    createSentimentChart() {
    const ctx = document.getElementById('sentiment-chart').getContext('2d');
    
    if (this.charts.sentiment) {
        this.charts.sentiment.destroy();
    }
    
    const positiveReviews = this.filteredReviews.filter(r => r.sentiment === 'Olumlu');
    const negativeReviews = this.filteredReviews.filter(r => r.sentiment === 'Olumsuz');
    const neutralReviews = this.filteredReviews.filter(r => r.sentiment === 'Nötr');
    
    // Tarihi düzgün parse et
    const parseDateString = (dateStr) => {
        if (!dateStr) return new Date();
        
        try {
            // "27 Eylül 2022" formatını parse et
            const months = {
                'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04',
                'Mayıs': '05', 'Haziran': '06', 'Temmuz': '07', 'Ağustos': '08',
                'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12'
            };
            
            const parts = dateStr.split(' ');
            if (parts.length >= 3) {
                const day = parts[0].padStart(2, '0');
                const month = months[parts[1]] || '01';
                const year = parts[2];
                return new Date(`${year}-${month}-${day}`);
            }
            
            // Eğer parse edilemezse default değer
            return new Date('2022-01-01');
        } catch (e) {
            return new Date('2022-01-01');
        }
    };
    
    // En yakın tarihli yorumları bul (her kategoriden 3 tane)
    const getRecentReviews = (reviews, count = 3) => {
        return reviews
            .sort((a, b) => {
                const dateA = parseDateString(a.reviewDate);
                const dateB = parseDateString(b.reviewDate);
                return dateB - dateA; // Yeniden eskiye
            })
            .slice(0, count)
            .map(review => ({
                ...review,
                parsedReviewDate: parseDateString(review.reviewDate),
                parsedTravelDate: parseDateString(review.travelDate)
            }));
    };
    
    const recentPositive = getRecentReviews(positiveReviews);
    const recentNegative = getRecentReviews(negativeReviews);
    const recentNeutral = getRecentReviews(neutralReviews);
    
    // Grafik oluştur
    this.charts.sentiment = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Olumlu', 'Olumsuz', 'Nötr'],
            datasets: [{
                data: [positiveReviews.length, negativeReviews.length, neutralReviews.length],
                backgroundColor: [
                    '#10b981',
                    '#ef4444',
                    '#f59e0b'
                ],
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverOffset: 20,
                hoverBorderColor: '#f3f4f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            family: "'Inter', sans-serif"
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        color: '#374151'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    titleFont: {
                        size: 12,
                        family: "'Inter', sans-serif"
                    },
                    bodyFont: {
                        size: 11,
                        family: "'Inter', sans-serif"
                    },
                    padding: 10,
                    cornerRadius: 6,
                    callbacks: {
                        label: function(context) {
                            const label = context.label;
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} yorum (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%',
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 800
            }
        }
    });
    
    // Duygu örneklerini göster
    this.displaySentimentExamples(recentPositive, recentNegative, recentNeutral);
}


displaySentimentExamples(positive, negative, neutral) {
    const container = document.querySelector('.sentiment-examples');
    if (!container) return;
    
    const formatDate = (date) => {
        if (!date) return 'Bilinmiyor';
        
        try {
            if (date instanceof Date && !isNaN(date)) {
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                return `${day}.${month}.${year}`;
            }
            
            const months = {
                'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04',
                'Mayıs': '05', 'Haziran': '06', 'Temmuz': '07', 'Ağustos': '08',
                'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12'
            };
            
            const parts = date.split(' ');
            if (parts.length >= 3) {
                const day = parts[0].padStart(2, '0');
                const monthName = parts[1];
                const month = months[monthName] || '01';
                const year = parts[2];
                return `${day}.${month}.${year}`;
            }
            
            return date;
        } catch (e) {
            return date || 'Bilinmiyor';
        }
    };
    
    const createExampleHTML = (reviews, sentiment) => {
        let html = '';
        
        if (reviews.length > 0) {
            reviews.forEach((review, index) => {
                const reviewDate = formatDate(review.reviewDate);
                const travelDate = formatDate(review.travelDate);
                const initials = review.username ? review.username.charAt(0).toUpperCase() : '?';
                const contentId = `${sentiment}-content-${index}`;
                const content = review.content || 'İçerik yok';
                const isLongContent = content.length > 150;
                
                html += `
                    <div class="sentiment-example-item ${sentiment}">
                        <div class="example-user">
                            <div class="example-user-info">
                                <div class="user-avatar-small">${initials}</div>
                                <div class="user-name">${review.username || 'Anonim'}</div>
                            </div>
                            <div class="example-rating">${review.rating || '0'}/5</div>
                        </div>
                        <div class="example-content ${isLongContent ? 'collapsed' : ''}" id="${contentId}">
                            ${content}
                        </div>
                        ${isLongContent ? `
                            <button class="example-show-more" data-target="${contentId}">
                                <span class="show-more-text">Devamını Gör</span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        ` : ''}
                        <div class="example-meta">
                            <div class="example-date-group">
                                <div class="example-date">
                                    <i class="far fa-calendar-alt"></i>
                                    <span>Yorum: ${reviewDate}</span>
                                </div>
                                <div class="example-travel-date">
                                    <i class="fas fa-plane-departure"></i>
                                    <span>Seyahat: ${travelDate}</span>
                                </div>
                            </div>
                            ${review.route ? `
                            <div class="example-route">
                                <i class="fas fa-route"></i>
                                <span>${review.route}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
        } else {
            html += `<div class="no-examples">${sentiment === 'positive' ? 'Olumlu' : sentiment === 'negative' ? 'Olumsuz' : 'Nötr'} yorum bulunmuyor</div>`;
        }
        
        return html;
    };
    
    let html = `
        <div class="sentiment-example-group">
            <div class="sentiment-example-header positive">
                <i class="fas fa-thumbs-up"></i>
                <span>Olumlu Yorumlar</span>
            </div>
            <div class="sentiment-example-items">
                ${createExampleHTML(positive, 'positive')}
            </div>
        </div>
        
        <div class="sentiment-example-group">
            <div class="sentiment-example-header negative">
                <i class="fas fa-thumbs-down"></i>
                <span>Olumsuz Yorumlar</span>
            </div>
            <div class="sentiment-example-items">
                ${createExampleHTML(negative, 'negative')}
            </div>
        </div>
        
        <div class="sentiment-example-group">
            <div class="sentiment-example-header neutral">
                <i class="fas fa-minus-circle"></i>
                <span>Nötr Yorumlar</span>
            </div>
            <div class="sentiment-example-items">
                ${createExampleHTML(neutral, 'neutral')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Show More butonları için event listener ekle
    container.querySelectorAll('.example-show-more').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            const contentDiv = document.getElementById(target);
            const btnText = e.currentTarget.querySelector('.show-more-text');
            const icon = e.currentTarget.querySelector('i');

            if (contentDiv.classList.contains('collapsed')) {
                contentDiv.classList.remove('collapsed');
                contentDiv.classList.add('expanded', 'expanding');
                btnText.textContent = 'Daha Az Gör';
                e.currentTarget.classList.add('expanded');
            } else {
                contentDiv.classList.remove('expanded', 'expanding');
                contentDiv.classList.add('collapsed');
                btnText.textContent = 'Devamını Gör';
                e.currentTarget.classList.remove('expanded');
            }
        });
    });
}

// Tarih parse etme yardımcı fonksiyonu
parseDate(dateString) {
    // "27 Eylül 2022" formatını parse et
    const months = {
        'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04',
        'Mayıs': '05', 'Haziran': '06', 'Temmuz': '07', 'Ağustos': '08',
        'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12'
    };
    
    const parts = dateString.split(' ');
    if (parts.length >= 3) {
        const day = parts[0].padStart(2, '0');
        const month = months[parts[1]] || '01';
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    
    return '2022-01-01'; // Varsayılan tarih
}


analyzeFeatures() {
    const complaints = {};
    const praises = {};
    const complaintSummaries = {};
    const praiseSummaries = {};

    // Önceden tanımlı kategoriler ve açıklamalar
    const categories = {
        complaints: {
            'rötar': {
                keywords: ['rötar', 'gecikme', 'gecikti', 'erteleme', 'bekleme', 'saat değişti'],
                summary: 'Sık yaşanan rötarlar yolcuları mağdur ediyor.'
            },
            'bagaj': {
                keywords: ['bagaj', 'valiz', 'hasar', 'kırık', 'kayıp', 'çizik', 'parçalanmış', 'zedelendi', 'ulaşmadı'],
                summary: 'Bagaj kaybı ve hasar şikayetleri dikkat çekiyor.'
            },
            'personel': {
                keywords: ['personel', 'görevli', 'kaba', 'küfür', 'hakaret', 'asabi', 'ilgisiz', 'saygısız', 'yardım etmedi'],
                summary: 'Personelin kaba ve ilgisiz tavırları şikayet konusu.'
            },
            'fiyat': {
                keywords: ['fiyat', 'pahalı', 'ücret', 'para', 'fahiş', 'adil değil', 'pahalılık'],
                summary: 'Fiyatların yüksek ve adil olmadığı düşünülüyor.'
            },
            'temizlik': {
                keywords: ['temizlik', 'kirli', 'bakımsız', 'pis', 'tozlu', 'kokmuş', 'leke', 'kir'],
                summary: 'Uçak içi temizlik ve bakım yetersiz bulunuyor.'
            },
            'konfor': {
                keywords: ['konfor', 'rahatsız', 'dar', 'koltuk', 'sıkışık', 'yer darlığı', 'bacak', 'rahatsızlık'],
                summary: 'Koltuk konforu ve alan yetersizliği şikayet ediliyor.'
            },
            'yiyecek': {
                keywords: ['yiyecek', 'içecek', 'yemek', 'su', 'ikram', 'lezzetsiz', 'az'],
                summary: 'Yiyecek ve içecek kalitesi düşük bulunuyor.'
            },
            'iletişim': {
                keywords: ['iletişim', 'bilgi', 'açıklama', 'anons', 'haber', 'bildirim', 'bilgilendirme', 'sessiz'],
                summary: 'Uçuş değişiklikleri hakkında yetersiz bilgilendirme yapılıyor.'
            },
            'check-in': {
                keywords: ['check-in', 'checkin', 'kayıt', 'bilet', 'kontuar', 'kuyruk', 'uzun kuyruk'],
                summary: 'Check-in işlemlerinde yaşanan uzun bekleme süreleri rahatsız edici.'
            },
            'güvenlik': {
                keywords: ['güvenlik', 'turbülans', 'sert iniş', 'kalkış', 'panik', 'korku', 'titreşim'],
                summary: 'Bazı uçuşlarda güvenlik endişeleri oluşuyor.'
            }
        },
        praises: {
            'personel-kalitesi': {
                keywords: ['personel', 'görevli', 'güler yüzlü', 'yardımsever', 'profesyonel', 'nazik', 'dostane'],
                summary: 'Personel güler yüzlü ve yardımsever davranışlarıyla öne çıkıyor.'
            },
            'zamanlama': {
                keywords: ['zamanında', 'punctual', 'vaktinde', 'tam saat', 'erken', 'program'],
                summary: 'Uçuşlar genellikle zamanında gerçekleşiyor.'
            },
            'temizlik-kalitesi': {
                keywords: ['temiz', 'hijyen', 'steril', 'bakımlı', 'yeni', 'modern', 'parlak'],
                summary: 'Uçak içi temizlik ve hijyen standartları yüksek.'
            },
            'konfor-kalitesi': {
                keywords: ['konfor', 'rahat', 'geniş', 'ferah', 'rahatlatıcı', 'şık'],
                summary: 'Koltuk konforu ve genel rahatlık memnun edici.'
            },
            'yiyecek-kalitesi': {
                keywords: ['yiyecek', 'içecek', 'yemek', 'lezzetli', 'taze', 'çeşit', 'kaliteli'],
                summary: 'Yiyecek ve içecek servis kalitesi beğeniliyor.'
            },
            'uçak-kalitesi': {
                keywords: ['uçak', 'filo', 'yeni uçak', 'model', 'teknoloji', 'geniş', 'modern'],
                summary: 'Uçakların yeni ve teknolojik olması takdir görüyor.'
            },
            'check-in-kolaylık': {
                keywords: ['check-in', 'kolay', 'hızlı', 'online', 'pratik', 'problemsiz'],
                summary: 'Check-in işlemleri kolay ve problemsiz gerçekleşiyor.'
            }
        }
    };

    // Tüm yorumları analiz et
    this.filteredReviews.forEach(review => {
        const content = (review.content + ' ' + review.title).toLowerCase();
        
        // OLUMSUZ yorumları analiz et (sentiment bazlı)
        if (review.sentiment === 'Olumsuz') {
            // Şikayet kategorilerini kontrol et
            for (const [category, data] of Object.entries(categories.complaints)) {
                const hasKeyword = data.keywords.some(keyword => content.includes(keyword));
                if (hasKeyword) {
                    complaints[category] = (complaints[category] || 0) + 1;
                    if (!complaintSummaries[category]) {
                        complaintSummaries[category] = data.summary;
                    }
                }
            }
        }
        
        // OLUMLU yorumları analiz et (sentiment bazlı)
        if (review.sentiment === 'Olumlu') {
            // Beğeni kategorilerini kontrol et
            for (const [category, data] of Object.entries(categories.praises)) {
                const hasKeyword = data.keywords.some(keyword => content.includes(keyword));
                if (hasKeyword) {
                    praises[category] = (praises[category] || 0) + 1;
                    if (!praiseSummaries[category]) {
                        praiseSummaries[category] = data.summary;
                    }
                }
            }
        }
    });

    // Beğenilenleri göster
    this.displayDetailedFeatures(praises, 'praises', 'Beğenilenler', praiseSummaries);
    
    // Şikayet edilenleri göster
    this.displayDetailedFeatures(complaints, 'complaints', 'Şikayet Edilenler', complaintSummaries);
    
    // Debug: Konsola yazdır
    console.log('Şikayetler:', complaints);
    console.log('Beğeniler:', praises);
}

displayDetailedFeatures(features, type, title, summaries) {
    const container = document.getElementById(`${type}-list`);
    container.innerHTML = '';

    if (Object.keys(features).length === 0) {
        container.innerHTML = `
            <div class="features-card ${type}">
                <h3><i class="fas fa-${type === 'complaints' ? 'exclamation-triangle' : 'heart'}"></i> ${title}</h3>
                <div class="placeholder-text">
                    Bu kategoride analiz edilecek veri bulunamadı.
                </div>
            </div>
        `;
        return;
    }

    const sortedFeatures = Object.entries(features)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    let html = `
        <div class="features-card ${type}">
            <div class="feature-details">
    `;

    sortedFeatures.forEach(([feature, count], index) => {
        const featureName = this.formatFeatureName(feature);
        const summary = summaries[feature] || '';

        html += `
            <div class="feature-detail-item ${type === 'complaints' ? 'complaint' : 'praise'}">
                <div class="feature-detail-header">
                    <div class="feature-name">${featureName}</div>
                    <div class="feature-metrics" style="display: none;">
                        <!-- Sayılar gizlendi -->
                    </div>
                </div>
        `;

        if (summary) {
            html += `
                <div class="feature-summary-card ${type === 'complaints' ? 'negative' : 'positive'}">
                    <div class="feature-summary-content ${type === 'complaints' ? 'negative' : 'positive'}">
                        <i class="fas fa-${type === 'complaints' ? 'exclamation-circle' : 'check-circle'}"></i>
                        <span>${summary}</span>
                    </div>
                </div>
            `;
        }

        html += '</div>';
    });

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
}



    displayFeatures(features, containerId, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        if (Object.keys(features).length === 0) {
            container.innerHTML = '<div class="placeholder-text">Bu kategoride analiz edilecek veri bulunamadı.</div>';
            return;
        }
        
        // Özellikleri sırala
        const sortedFeatures = Object.entries(features)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // En fazla 5 tane göster
        
        const total = this.filteredReviews.length;
        
        sortedFeatures.forEach(([feature, count]) => {
            const percentage = ((count / total) * 100).toFixed(1);
            const featureName = this.formatFeatureName(feature);
            
            const featureElement = document.createElement('div');
            featureElement.className = `feature-item ${type}`;
            featureElement.innerHTML = `
                <h4>${featureName}</h4>
                <div class="feature-stats">
                    <span class="feature-count">${count} yorumda bahsedildi</span>
                    <span class="feature-percentage">%${percentage}</span>
                </div>
            `;
            
            container.appendChild(featureElement);
        });
    }

    // Özellik isimlerini formatla
formatFeatureName(feature) {
    const names = {
        // Şikayetler
        'rötar': 'Rötar ve Gecikmeler',
        'bagaj': 'Bagaj Sorunları',
        'personel': 'Personel Davranışları',
        'fiyat': 'Fiyat ve Ücret Politikası',
        'temizlik': 'Temizlik ve Bakım',
        'konfor': 'Konfor ve Rahatlık',
        'yiyecek': 'Yiyecek-İçecek Kalitesi',
        'iletişim': 'İletişim ve Bilgilendirme',
        'check-in': 'Check-in İşlemleri',
        'güvenlik': 'Güvenlik Endişeleri',
        
        // Beğeniler
        'personel-kalitesi': 'Personel Kalitesi',
        'zamanlama': 'Zamanlama ve Program',
        'temizlik-kalitesi': 'Temizlik Standartları',
        'konfor-kalitesi': 'Konfor ve Rahatlık',
        'yiyecek-kalitesi': 'Yiyecek-İçecek Kalitesi',
        'uçak-kalitesi': 'Uçak Kalitesi',
        'check-in-kolaylık': 'Check-in Kolaylığı'
    };
    
    return names[feature] || feature.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

    createRatingChart() {
        const ctx = document.getElementById('rating-chart').getContext('2d');
        
        if (this.charts.rating) {
            this.charts.rating.destroy();
        }
        
        // Puan dağılımını hesapla
        const ratingCounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
        this.filteredReviews.forEach(review => {
            if (review.rating >= 1 && review.rating <= 5) {
                ratingCounts[review.rating]++;
            }
        });
        
        this.charts.rating = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['1 Yıldız', '2 Yıldız', '3 Yıldız', '4 Yıldız', '5 Yıldız'],
                datasets: [{
                    label: 'Yorum Sayısı',
                    data: Object.values(ratingCounts),
                    backgroundColor: [
                        '#ef4444',
                        '#f97316',
                        '#f59e0b',
                        '#10b981',
                        '#3b82f6'
                    ],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Yorum Sayısı'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Puan'
                        }
                    }
                }
            }
        });
    }

    createTrendChart() {
        const ctx = document.getElementById('trend-chart').getContext('2d');
        
        if (this.charts.trend) {
            this.charts.trend.destroy();
        }
        
        // Yıllara göre yorum sayısını hesapla
        const yearCounts = {};
        this.filteredReviews.forEach(review => {
            const year = this.extractYear(review.reviewDate);
            if (year) {
                yearCounts[year] = (yearCounts[year] || 0) + 1;
            }
        });
        
        // Yılları sırala
        const sortedYears = Object.keys(yearCounts).sort();
        const counts = sortedYears.map(year => yearCounts[year]);
        
        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedYears,
                datasets: [{
                    label: 'Yorum Sayısı',
                    data: counts,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Yorum Sayısı'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Yıl'
                        }
                    }
                }
            }
        });
    }

    extractYear(dateString) {
        const match = dateString.match(/\b(20\d{2})\b/);
        return match ? match[1] : null;
    }

    filterReviews(sentiment) {
    let filtered = [...this.filteredReviews];
    
    if (sentiment !== 'all') {
        const sentimentMap = {
            'positive': 'Olumlu',
            'negative': 'Olumsuz',
            'neutral': 'Nötr'
        };
        
        const targetSentiment = sentimentMap[sentiment];
        filtered = this.filteredReviews.filter(review => 
            review.sentiment === targetSentiment
        );
    }
    
    this.displayReviews(filtered);
}

    sortReviews() {
        const sortBy = document.getElementById('sort-select').value;
        let sorted = [...this.filteredReviews];
        
        switch (sortBy) {
            case 'date-desc':
                sorted.sort((a, b) => new Date(b.reviewDate) - new Date(a.reviewDate));
                break;
            case 'date-asc':
                sorted.sort((a, b) => new Date(a.reviewDate) - new Date(b.reviewDate));
                break;
            case 'rating-desc':
                sorted.sort((a, b) => b.rating - a.rating);
                break;
            case 'rating-asc':
                sorted.sort((a, b) => a.rating - b.rating);
                break;
        }
        
        this.displayReviews(sorted);
    }

    displayReviews(reviews = null) {
        const reviewsToShow = reviews || this.filteredReviews;
        const container = document.getElementById('reviews-list');
        
        if (reviewsToShow.length === 0) {
            container.innerHTML = `
                <div class="placeholder-message">
                    <h3>Yorum Bulunamadı</h3>
                    <p>Seçili filtrelerde yorum bulunamadı.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        reviewsToShow.forEach(review => {
            const reviewElement = this.createReviewElement(review);
            container.appendChild(reviewElement);
        });
    }

 createReviewElement(review) {
    const div = document.createElement('div');
    div.className = `review-card ${review.sentiment.toLowerCase()}`;
    
    const initials = review.username.charAt(0).toUpperCase();
    const sentimentClass = review.sentiment === 'Olumlu' ? 'positive' : 
                          review.sentiment === 'Olumsuz' ? 'negative' : 'neutral';
    
    const reviewId = `review-content-${review.id}`;
    
    div.innerHTML = `
        <div class="review-header">
            <div class="review-user">
                <div class="user-avatar">${initials}</div>
                <div class="user-info">
                    <h4>${review.username}</h4>
                    <div class="user-contributions">${review.contributions} katkı</div>
                </div>
            </div>
            <div class="review-rating">
                <div class="rating-badge">${review.rating}/5</div>
            </div>
        </div>
        
        <div class="review-title">${review.title}</div>
        
        <div class="review-meta">
            <div class="review-route">
                <i class="fas fa-route"></i>
                <span>${review.route}</span>
            </div>
            <div class="review-date">
                <i class="far fa-calendar"></i>
                <span>${review.reviewDate}</span>
            </div>
            <div class="review-sentiment ${sentimentClass}">
                <i class="fas ${review.sentiment === 'Olumlu' ? 'fa-thumbs-up' : 
                               review.sentiment === 'Olumsuz' ? 'fa-thumbs-down' : 'fa-minus-circle'}"></i>
                <span>${review.sentiment}</span>
            </div>
        </div>
        
        <div class="review-content" id="${reviewId}">
            ${review.content}
        </div>
    `;
    
    return div;
}

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    showErrorMessage(message) {
        alert(message);
    }
}

// Uygulamayı başlat
document.addEventListener('DOMContentLoaded', () => {
    new AirlineReviews();
});