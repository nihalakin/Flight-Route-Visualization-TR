// Navigasyon ve tab yönetimi
class Navigation {
    constructor() {
        this.currentTab = 'anasayfa';
        this.flightSearch = null;
        this.flightOptimizer = null;
        this.initializeNavigation();
    }
    
    initializeNavigation() {
        // Navbar linklerine event listener ekle
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = e.target.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });
        
        // Hamburger menü için
        this.initializeMobileMenu();
        
        // Sayfa yüklendiğinde aktif tab'ı göster
        this.showTab(this.currentTab);
    }

    showTab(tabName) {
        // Tüm tab içeriklerini gizle
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Tüm nav linklerinden aktif sınıfını kaldır
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Hedef tab'ı göster
        const targetTab = document.getElementById(tabName);
        const targetLink = document.querySelector(`[data-tab="${tabName}"]`);
        
        if (targetTab && targetLink) {
            targetTab.classList.add('active');
            targetLink.classList.add('active');
            this.currentTab = tabName;
        }
    }
    
    initializeMobileMenu() {
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        
        if (hamburger) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });
        }
        
        // Mobil menüde linklere tıklandığında menüyü kapat
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                if (hamburger) hamburger.classList.remove('active');
                if (navMenu) navMenu.classList.remove('active');
            });
        });
    }
    
    switchTab(tabName) {
        // Eski aktif tab'ı ve linki kaldır
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Yeni tab'ı ve linki aktif et
        const targetTab = document.getElementById(tabName);
        const targetLink = document.querySelector(`[data-tab="${tabName}"]`);
        
        if (targetTab && targetLink) {
            targetTab.classList.add('active');
            targetLink.classList.add('active');
            this.currentTab = tabName;
            
            // Tab değiştiğinde özel işlemler yap
            this.onTabChange(tabName);
        }
    }
    
    onTabChange(tabName) {
        console.log(`Tab değişti: ${tabName}`);
        
        // Her tab için özel işlemler
        switch(tabName) {
            case 'anasayfa':
                // Ana sayfa özel işlemleri
                break;
            case 'rota-olustur':
                this.initializeFlightSearch();
                break;
            case 'havalimanlari':
                this.initializeAirportsPage();
                break;
            case 'istatistikler':
                this.initializeStatisticsPage();
                break;
        }
    }
    
    async initializeFlightSearch() {
        console.log('Uçuş arama sayfası başlatıldı');
        
        try {
            // FlightSearch sınıfını başlat
            this.flightSearch = new FlightSearch();
            this.flightOptimizer = new FlightOptimizer(window.flightNetwork);
            this.flightSearch.populateAirportSelects();
            
            // Optimizasyon haritasını başlat
            this.initializeOptimizationMap();
            
            // Backend kontrolü yap
            await this.checkBackendConnection();
            
            // Event listener'ları ekle
            this.initializeFlightSearchListeners();
        } catch (error) {
            console.error('Uçuş arama sayfası başlatılırken hata:', error);
        }
    }
    
    initializeFlightSearchListeners() {
    const searchBtn = document.getElementById('search-flights');
    const validateCouponBtn = document.getElementById('validate-coupon');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            this.performFlightSearch();
        });
    }
    
    if (validateCouponBtn) {
        validateCouponBtn.addEventListener('click', () => {
            this.validateCouponCode();
        });
    }
    
    // Enter tuşu desteği
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && this.currentTab === 'rota-olustur') {
            this.performFlightSearch();
        }
    });
}

validateCouponCode() {
    const couponCode = document.getElementById('coupon-code')?.value || '';
    
    if (!couponCode.trim()) {
        this.showCouponMessage('Lütfen bir kupon kodu girin.', true);
        return;
    }
    
    const validation = this.flightSearch.couponManager.validateCoupon(couponCode);
    
    if (validation.valid) {
        this.showCouponMessage(`✅ Kupon geçerli! ${validation.coupon.airline} havayolu için ${validation.coupon.discountAmount} TL indirim.`, false);
    } else {
        this.showCouponMessage(validation.message, true);
    }
}
    
    // Optimizasyon haritasını başlat
    initializeOptimizationMap() {
    try {
        // Container'ı kontrol et
        const mapContainer = document.getElementById('optimization-map');
        if (!mapContainer) {
            console.warn('Optimization map container not found, oluşturuluyor...');
            this.createOptimizationMapContainer();
            return;
        }
        
        // Container boş mu kontrol et
        if (mapContainer.children.length === 0) {
            console.log('Optimization map container boş, yeniden başlatılıyor...');
            // Mevcut instance'ı temizle
            window.optimizationMap = null;
        }
        
        // Haritayı başlat
        window.optimizationMap = new OptimizationMap();
        console.log('Optimization map başlatıldı');
        
        // Başarı kontrolü
        if (window.optimizationMap && typeof window.optimizationMap.setOptimizedRoutes === 'function') {
            console.log('Optimization map fonksiyonları hazır');
            return true;
        } else {
            console.error('Optimization map fonksiyonları hazır değil');
            return false;
        }
        
    } catch (error) {
        console.error('Optimization map başlatma hatası:', error);
        return false;
    }
}
createOptimizationMapContainer() {
    try {
        // Optimization map section'ı bul
        const optimizationSection = document.querySelector('.optimization-map-section');
        if (!optimizationSection) {
            console.error('Optimization map section bulunamadı');
            return false;
        }
        
        // Container oluştur
        const mapContainer = document.createElement('div');
        mapContainer.id = 'optimization-map';
        mapContainer.className = 'optimization-map';
        mapContainer.style.height = '500px';
        mapContainer.style.border = '1px solid #e5e7eb';
        mapContainer.style.borderRadius = '10px';
        mapContainer.style.background = '#f8f9fa';
        
        // Section'a ekle
        optimizationSection.querySelector('.optimization-map-container').appendChild(mapContainer);
        console.log('Optimization map container oluşturuldu');
        return true;
        
    } catch (error) {
        console.error('Optimization map container oluşturma hatası:', error);
        return false;
    }
}

createMissingOptimizationContainers() {
    const containers = [
        { id: 'cheapest-route', title: 'En Ucuz Rota' },
        { id: 'fastest-route', title: 'En Hızlı Rota' },
        { id: 'earliest-route', title: 'En Erken Varış' },
        { id: 'balanced-route', title: 'Dengeli Rota' }
    ];
    
    const optimizationCards = document.querySelector('.optimization-cards');
    if (!optimizationCards) {
        console.error('Optimization cards container bulunamadı');
        return false;
    }
    
    let containersCreated = 0;
    
    containers.forEach(container => {
        if (!document.getElementById(container.id)) {
            const card = document.createElement('div');
            card.className = 'optimization-card';
            card.id = container.id;
            card.innerHTML = `
                <h4>${container.title}</h4>
                <div class="route-placeholder">Sonuçlar burada gösterilecek</div>
            `;
            optimizationCards.appendChild(card);
            containersCreated++;
            console.log(` ${container.id} container oluşturuldu`);
        }
    });
    
    return containersCreated > 0;
}

   // navigation.js - performFlightSearch fonksiyonunu güncelleyin
// navigation.js - performFlightSearch fonksiyonunu detaylı hata ayıklama ile güncelleyin
async performFlightSearch() {
    const searchParams = this.getFlightSearchParams();
    this.clearPreviousResults();
    this.clearCouponMessages();
    // Validasyon
    if (!this.validateFlightSearchParams(searchParams)) {
        return;
    }
    
    console.log('🔍 Arama parametreleri:', searchParams);
    
    // Loading göster
    this.showLoading(true);
    
    try {
        // Uçuşları ara
        console.log('🔄 API çağrısı yapılıyor...');
        const searchResult = await this.flightSearch.searchFlights(searchParams);
        
        console.log('✅ API yanıtı alındı:', searchResult);

                // Kupon hata mesajlarını göster
        if (searchResult.couponStatus) {
            this.showCouponMessage(searchResult.couponStatus, searchResult.flights[0]?.couponError);
        }
        // Eğer business sınıfında uçuş bulunamadıysa
        if (searchResult.cabinClassWarning === 'BUSINESS') {
            console.log('⚠️ BUSINESS sınıfı uyarısı');
            this.showCabinClassWarning(searchResult.message, searchParams);
            this.showLoading(false);
            return;
        }
        
        const flights = searchResult.flights || searchResult;
        
        console.log(`📊 Toplam ${flights.length} uçuş bulundu`);
        
        if (flights.length === 0) {
            console.log('❌ Hiç uçuş bulunamadı');
            this.showNoFlightsMessage(searchParams);
            this.showLoading(false);
            return;
        }
        
        // İlk uçuşu kontrol et
        if (flights.length > 0) {
            console.log('🎫 İlk uçuş örneği:', flights[0]);
        }
        
        // Optimizasyon yap
        console.log('⚡ Optimizasyon başlatılıyor...');
        const optimizationResult = this.flightOptimizer.optimizeFlights(flights, searchParams);
        
        console.log('✅ Optimizasyon tamamlandı:', optimizationResult);
        
        // Eksik container'ları kontrol et ve oluştur
        this.checkOptimizationContainers();
        
        // Optimizasyon haritasını kontrol et ve başlat
        let mapReady = false;
        if (window.optimizationMap && typeof window.optimizationMap.setOptimizedRoutes === 'function') {
            console.log('🗺️ Optimization map zaten hazır');
            mapReady = true;
        } else {
            console.log('🗺️ Optimization map başlatılıyor...');
            mapReady = this.initializeOptimizationMap();
            
            if (!mapReady) {
                // İkinci deneme
                await this.delay(200);
                mapReady = this.initializeOptimizationMap();
            }
        }
        
        // Budanmış grafı al
        const prunedGraph = optimizationResult.prunedGraph;
        
        console.log('📈 Optimize rotalar:', optimizationResult.routes);
        console.log('🌳 Budanmış graf:', prunedGraph);
        
        // Optimize rotaları haritada animasyonla göster
        const optimizedRoutes = this.flightOptimizer.getAllOptimizedRoutes();
        
        console.log('🛣️ Formatlanmış rotalar:', optimizedRoutes);
        
        if (mapReady && window.optimizationMap && typeof window.optimizationMap.setOptimizedRoutes === 'function') {
            console.log('🎬 Optimization map ile rotalar gösteriliyor...');
            await window.optimizationMap.setOptimizedRoutes(optimizedRoutes, searchParams, prunedGraph);
        } else {
            console.warn('⚠️ Optimization map hazır değil, sadece kartlar gösterilecek');
            this.showError('Harita başlatılamadı, ancak rotalar gösteriliyor.');
        }
        
        // Sonuçları göster
        console.log('📋 Sonuçlar ekranda gösteriliyor...');
        this.displayOptimizationResults(optimizationResult, searchParams);
        
        console.log('✅ Tüm işlemler başarıyla tamamlandı');
        
    } catch (error) {
        console.error('❌ Uçuş arama hatası:', error);
        console.error('Hata detayı:', error.stack);
        this.showError('Uçuş arama sırasında hata oluştu: ' + error.message);
    } finally {
        console.log('🏁 İşlem tamamlandı, loading kaldırılıyor');
        this.showLoading(false);
    }
}
showCouponMessage(statusMessage, errorMessage = null) {
    const couponMessageDiv = document.getElementById('coupon-message');
    if (!couponMessageDiv) return;
    
    if (errorMessage) {
        couponMessageDiv.innerHTML = `
            <div class="coupon-error">
                ❌ ${errorMessage}
            </div>
        `;
        couponMessageDiv.className = 'coupon-message error';
    } else if (statusMessage) {
        couponMessageDiv.innerHTML = `
            <div class="coupon-success">
                ${statusMessage}
            </div>
        `;
        couponMessageDiv.className = 'coupon-message success';
    }
}

clearCouponMessages() {
    const couponMessageDiv = document.getElementById('coupon-message');
    if (couponMessageDiv) {
        couponMessageDiv.innerHTML = '';
        couponMessageDiv.className = 'coupon-message';
    }
}
// Yeni fonksiyon: Önceki sonuçları temizle
clearPreviousResults() {
    console.log('🧹 Önceki sonuçlar temizleniyor...');
    
    // Results container'ı temizle
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
    }
    
    // Optimization cards'ı temizle
    const optimizationCards = ['cheapest-route', 'fastest-route', 'earliest-route', 'balanced-route'];
    optimizationCards.forEach(cardId => {
        const card = document.getElementById(cardId);
        if (card) {
            card.innerHTML = `
                <h4>${this.getCardTitle(cardId)}</h4>
                <div class="route-placeholder">Sonuçlar burada gösterilecek</div>
            `;
        }
    });
    
    // Haritayı temizle
    if (window.optimizationMap && typeof window.optimizationMap.clearMap === 'function') {
        window.optimizationMap.clearMap();
    }
}
getCardTitle(cardId) {
    const titles = {
        'cheapest-route': 'En Ucuz Rota',
        'fastest-route': 'En Hızlı Rota', 
        'earliest-route': 'En Erken Varış',
        'balanced-route': 'Dengeli Rota'
    };
    return titles[cardId] || cardId;
}

showCabinClassWarning(message, searchParams) {
    const container = document.getElementById('results-container');
    if (!container) {
        console.error('❌ Results container bulunamadı');
        return;
    }
    
    // Önce container'ı temizleyelim
    container.innerHTML = '';
    
    container.innerHTML = `
        <div class="warning-message">
            <div class="warning-icon"><i class="fa-solid fa-triangle-exclamation" style="color: #FFD43B;"></i></div>
            
            <h3>BUSINESS Sınıfında Uçuş Bulunamadı</h3>
            <p>${message}</p>
            <div class="warning-actions">
                <button id="try-economy" class="btn-secondary">Ekonomi Sınıfını Dene</button>
            </div>
        </div>
    `;
    
    console.log('✅ Uyarı mesajı gösterildi, butonlar oluşturuldu');
    

    const tryEconomyBtn = document.getElementById('try-economy');
    const changeFiltersBtn = document.getElementById('change-filters');
    
    if (tryEconomyBtn) {
        // Önceki tüm click event'lerini temizle
        tryEconomyBtn.replaceWith(tryEconomyBtn.cloneNode(true));
        // Yeni butonu seç
        const newTryEconomyBtn = document.getElementById('try-economy');
        
        newTryEconomyBtn.addEventListener('click', (e) => {
            console.log('🔄 ECONOMY sınıfına geçiliyor...');
            e.preventDefault();
            e.stopPropagation();
            
            // Kabin sınıfını ECONOMY olarak değiştir
            const cabinClassSelect = document.getElementById('cabin-class');
            if (cabinClassSelect) {
                cabinClassSelect.value = 'ECONOMY';
                console.log('✅ Kabin sınıfı ECONOMY olarak ayarlandı');
            }
            
            // Arama yap
            this.performFlightSearch();
        });
    }
    
    if (changeFiltersBtn) {
        changeFiltersBtn.addEventListener('click', () => {
            console.log('🔄 Filtreler değiştiriliyor...');
            // Sadece form alanlarını temizle
            const arrivalTimeInput = document.getElementById('arrival-time');
            if (arrivalTimeInput) arrivalTimeInput.value = '';
            
            // Kabin sınıfını ECONOMY'ye çevir (opsiyonel)
            const cabinClassSelect = document.getElementById('cabin-class');
            if (cabinClassSelect) cabinClassSelect.value = 'ECONOMY';
            
            // Kullanıcıya bildir
            this.showSuccess('Filtreler sıfırlandı. Lütfen yeni arama yapın.');
        });
    }
}

// navigation.js - showNoFlightsMessage fonksiyonunu güncelleyin
showNoFlightsMessage(searchParams) {
    const container = document.getElementById('results-container');
    if (!container) return;
    
    // Container'ı temizle
    container.innerHTML = '';
    
    container.innerHTML = `
        <div class="no-flights-message">
            <div class="no-flights-icon"></div>
            <h3>Uçuş Bulunamadı</h3>
            <p>Seçtiğiniz kriterlere uygun uçuş bulunamadı.</p>
            <div class="suggestions">
                <p><strong>Öneriler:</strong></p>
                <ul>
                    <li>Farklı bir tarih deneyin</li>
                    <li>Kabin sınıfını değiştirin</li>
                    <li>Farklı kalkış/varış noktaları deneyin</li>
                </ul>
            </div>
            <div class="action-buttons">
                <button id="new-search" class="btn-primary">
                    Yeni Arama Yap
                </button>
            </div>
        </div>
    `;
    
    // Buton event listener'ları
    document.getElementById('change-cabin-class')?.addEventListener('click', () => {
        const cabinClassSelect = document.getElementById('cabin-class');
        if (cabinClassSelect) {
            // ECONOMY ise BUSINESS yap, BUSINESS ise ECONOMY yap
            cabinClassSelect.value = cabinClassSelect.value === 'ECONOMY' ? 'BUSINESS' : 'ECONOMY';
            this.performFlightSearch();
        }
    });
    
    document.getElementById('new-search')?.addEventListener('click', () => {
        // Formu sıfırla
        const arrivalTimeInput = document.getElementById('arrival-time');
        if (arrivalTimeInput) arrivalTimeInput.value = '';
        
        // Kabin sınıfını varsayılan yap
        const cabinClassSelect = document.getElementById('cabin-class');
        if (cabinClassSelect) cabinClassSelect.value = 'ECONOMY';
        
        // Sonuçları temizle
        this.clearPreviousResults();
    });
}

    // Yardımcı fonksiyon - delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // navigation.js - displayOptimizationResults fonksiyonunu güncelleyin
displayOptimizationResults(optimizationResult, searchParams) {
    try {
        // Normal uçuş sonuçlarını göster
        this.displayFlightResults(optimizationResult.filteredCount > 0 ? 
            [optimizationResult.routes.cheapest] : [], searchParams);
        
        // Optimize rotaları göster - container'ların var olduğundan emin ol
        if (this.checkOptimizationContainers()) {
            this.displayOptimizedRoutes(optimizationResult.routes, searchParams); // searchParams parametresini ekleyin
            console.log('Optimizasyon sonuçları gösterildi');
        } else {
            console.warn('Optimizasyon containerları hala bulunamıyor');
            // Yine de gösterimi deneyelim
            this.displayOptimizedRoutes(optimizationResult.routes, searchParams);
        }
    } catch (error) {
        console.error('Optimizasyon sonuçları gösterilirken hata:', error);
    }
}
    // Optimizasyon container'larını kontrol et
    checkOptimizationContainers() {
    const containers = [
        'cheapest-route',
        'fastest-route', 
        'earliest-route',
        'balanced-route'
    ];
    
    let missingContainers = [];
    
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container bulunamadı: ${containerId}`);
            missingContainers.push(containerId);
        }
    });
    
    // Eksik container'ları oluştur
    if (missingContainers.length > 0) {
        console.log(`Eksik container'lar oluşturuluyor: ${missingContainers.join(', ')}`);
        this.createMissingOptimizationContainers();
    }
    
    // Son kontrol
    const allContainersExist = containers.every(containerId => 
        document.getElementById(containerId)
    );
    
    return allContainersExist;
}

    // navigation.js - displayOptimizedRoutes fonksiyonunu güncelleyin
displayOptimizedRoutes(routes, searchParams = null) {
    try {
        const optimizedRoutes = this.flightOptimizer.getAllOptimizedRoutes();
        
        // Eğer searchParams yoksa, mevcut arama parametrelerini al
        if (!searchParams) {
            searchParams = this.getFlightSearchParams();
        }
        
        console.log('📊 Kabin sınıfı bilgisi gösteriliyor:', searchParams.cabinClass);
        
        // Her bir optimizasyon türü için sonuçları göster
        this.displayOptimizationCard('cheapest-route', optimizedRoutes.cheapest, 'En Ucuz Rota', searchParams);
        this.displayOptimizationCard('fastest-route', optimizedRoutes.fastest, 'En Hızlı Rota', searchParams);
        this.displayOptimizationCard('earliest-route', optimizedRoutes.earliest, 'En Erken Varış', searchParams);
        this.displayOptimizationCard('balanced-route', optimizedRoutes.balanced, 'Dengeli Rota', searchParams);
    } catch (error) {
        console.error('Optimize rotalar gösterilirken hata:', error);
    }
}

// navigation.js - displayOptimizationCard fonksiyonunu güncelleyin
displayOptimizationCard(containerId, route, title, searchParams = null) {
    try {
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.error(`Container bulunamadı: ${containerId}`);
            return;
        }
        
        if (!route || !route.summary) {
            container.innerHTML = `
                <h4>${title}</h4>
                <div class="route-placeholder">Uygun rota bulunamadı</div>
            `;
            return;
        }

        // Kupon bilgilerini al
        const hasCoupon = route.couponApplied || false;
        const originalPrice = route.originalPrice || route.summary.price;
        const couponDiscount = route.discountAmount || 0;
        const finalPrice = route.summary.price;

        // Fiyat gösterimi için
        let priceHTML = '';
        if (hasCoupon) {
            priceHTML = `
                <div class="route-price coupon-applied">
                    <div class="price-comparison">
                        <span class="original-price">${originalPrice.toFixed(2)} ${route.summary.currency}</span>
                        <span class="discounted-price">${finalPrice.toFixed(2)} ${route.summary.currency}</span>
                    </div>
                    <span class="coupon-badge">${couponDiscount.toFixed(2)} TL indirim</span>
                </div>
            `;
        } else {
            priceHTML = `
                <div class="route-price">
                    <span class="final-price">${finalPrice.toFixed(2)} ${route.summary.currency}</span>
                </div>
            `;
        }

        // Havayolu bilgisi
        let airlineHTML = '';
        if (route.couponAirline) {
            airlineHTML = `
                <div class="coupon-airline-info">
                    <strong>Kupon Havayolu:</strong> ${route.couponAirline}
                </div>
            `;
        }

        // Kupon uyarısı
        let couponWarningHTML = '';
        if (route.couponWarning) {
            couponWarningHTML = `
                <div class="coupon-warning">
                    ⚠️ ${route.couponWarning}
                </div>
            `;
        }

        const arrivalTime = route.summary.arrivalTime.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Rota path'ini formatla - hem IATA hem şehir ismi
        let formattedPath = 'Rota bulunamadı';
        if (route.path && route.path.length > 0) {
            formattedPath = route.path.map(airportCode => {
                const airport = window.flightNetwork.getAirportByIata(airportCode);
                return airport ? `${airportCode} (${airport.city})` : airportCode;
            }).join(' → ');
        }
        
        // Kabin sınıfı bilgisini al
        let cabinClassInfo = '';
        if (searchParams && searchParams.cabinClass) {
            const cabinClassDisplay = searchParams.cabinClass === 'ECONOMY' ? 'Ekonomi' : 'Business';
            const cabinClassIcon = searchParams.cabinClass === 'ECONOMY' ? '🪑' : '🛋️';
            cabinClassInfo = `
                <div class="stat">
                    <span class="stat-label">Kabin:</span>
                    <span class="stat-value">${cabinClassIcon} ${cabinClassDisplay}</span>
                </div>
            `;
        }

        // Segment detaylarını oluştur
        let segmentsHTML = '';
        if (route.segments && route.segments.length > 0) {
            segmentsHTML = `
                <div class="flight-segments">
                    <strong class="segments-title">Uçuş Detayları:</strong>
            `;
            
            route.segments.forEach((segment, index) => {
                const departureTime = new Date(segment.departure.time).toLocaleString('tr-TR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const arrivalTime = new Date(segment.arrival.time).toLocaleString('tr-TR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                // Kalkış ve varış şehir bilgilerini al
                const departureAirport = window.flightNetwork.getAirportByIata(segment.departure.airport);
                const arrivalAirport = window.flightNetwork.getAirportByIata(segment.arrival.airport);
                const departureCity = departureAirport ? departureAirport.city : segment.departure.airport;
                const arrivalCity = arrivalAirport ? arrivalAirport.city : segment.arrival.airport;

                // Segment havayolu kontrolü (kupon havayoluyla eşleşiyor mu?)
                const isCouponAirline = route.couponAirline && 
                    route.couponAirline.toLowerCase().includes(segment.airline?.toLowerCase() || segment.carrier?.toLowerCase());

                segmentsHTML += `
                    <div class="segment ${isCouponAirline ? 'coupon-airline-segment' : ''}">
                        <div class="segment-info">
                            <div class="segment-header">
                                <span class="segment-airline">${segment.airline || segment.carrier || 'Bilinmiyor'}</span>
                                ${isCouponAirline ? '<span class="coupon-airline-tag">🎫 Kupon</span>' : ''}
                                <span class="segment-flight">${segment.flightNumber || 'Bilinmiyor'}</span>
                            </div>
                            <div class="segment-route">
                                <span class="route-airport">${segment.departure.airport}</span>
                                <span class="route-city">${departureCity}</span>
                                <span class="route-arrow">→</span>
                                <span class="route-airport">${segment.arrival.airport}</span>
                                <span class="route-city">${arrivalCity}</span>
                            </div>
                            <div class="segment-times">
                                <div class="time-group">
                                    <span class="time-label">Kalkış:</span>
                                    <span class="time-value">${departureTime}</span>
                                    ${segment.departure.terminal ? `<span class="terminal">Terminal: ${segment.departure.terminal}</span>` : ''}
                                </div>
                                <div class="time-group">
                                    <span class="time-label">Varış:</span>
                                    <span class="time-value">${arrivalTime}</span>
                                    ${segment.arrival.terminal ? `<span class="terminal">Terminal: ${segment.arrival.terminal}</span>` : ''}
                                </div>
                            </div>
                            ${segment.aircraft ? `<div class="aircraft-info">Uçak: ${segment.aircraft}</div>` : ''}
                        </div>
                        <div class="segment-duration">
                            ${this.formatDuration(segment.duration)}
                        </div>
                    </div>
                `;
            });
            
            segmentsHTML += `</div>`;
        }

        container.innerHTML = `
            <div class="optimization-card-header">
                <div class="header-left">
                    <h4>${title}</h4>
                    ${hasCoupon ? '<span class="coupon-indicator">🎫 Kuponlu</span>' : ''}
                </div>
                ${searchParams && searchParams.cabinClass ? `
                    <div class="cabin-class-badge ${searchParams.cabinClass.toLowerCase()}">
                        ${searchParams.cabinClass === 'ECONOMY' ? '🪑 Ekonomi' : '🛋️ Business'}
                    </div>
                ` : ''}
            </div>
            <div class="optimized-route">
                ${couponWarningHTML}
                ${airlineHTML}
                
                <div class="route-summary">
                    ${priceHTML}
                    <div class="route-duration">${Math.floor(route.summary.duration/60)}s ${route.summary.duration%60}d</div>
                </div>
                
                <div class="route-path">
                    <strong>Rota:</strong> ${formattedPath}
                </div>
                
                <div class="route-stats">
                    <div class="stat">
                        <span class="stat-label">Aktarma:</span>
                        <span class="stat-value">${route.summary.transferCount}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Varış:</span>
                        <span class="stat-value">${arrivalTime}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Tip:</span>
                        <span class="stat-value">${route.summary.isDirect ? '✈️ Direkt' : '🔄 Aktarmalı'}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Uçuşlar:</span>
                        <span class="stat-value">${route.segments ? route.segments.length : 0}</span>
                    </div>
                    ${cabinClassInfo}
                </div>
                
                ${segmentsHTML}
            </div>
        `;
    } catch (error) {
        console.error(`Optimizasyon kartı gösterilirken hata (${containerId}):`, error);
    }
} 
// Yardımcı fonksiyon - süreyi formatla
formatDuration(durationStr) {
    if (!durationStr) return 'Bilinmiyor';
    
    try {
        // ISO 8601 formatını parse et (PT2H30M gibi)
        const matches = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        const hours = parseInt(matches[1] || 0);
        const minutes = parseInt(matches[2] || 0);
        
        if (hours > 0 && minutes > 0) {
            return `${hours}sa ${minutes}dak`;
        } else if (hours > 0) {
            return `${hours}sa`;
        } else {
            return `${minutes}dak`;
        }
    } catch (error) {
        // Eğer zaten sayısal değer ise (dakika cinsinden)
        if (!isNaN(durationStr)) {
            const hours = Math.floor(durationStr / 60);
            const minutes = durationStr % 60;
            
            if (hours > 0 && minutes > 0) {
                return `${hours}sa ${minutes}dak`;
            } else if (hours > 0) {
                return `${hours}sa`;
            } else {
                return `${minutes}dak`;
            }
        }
        
        return durationStr;
    }
}
    
    getFlightSearchParams() {
    return {
        origin: document.getElementById('origin')?.value || '',
        destination: document.getElementById('destination')?.value || '',
        departureDate: document.getElementById('departure-date')?.value || '',
        arrivalTime: document.getElementById('arrival-time')?.value || '',
        adults: parseInt(document.getElementById('adults')?.value) || 1,
        cabinClass: document.getElementById('cabin-class')?.value || 'ECONOMY',
        couponCode: document.getElementById('coupon-code')?.value || '', // Yeni
        optimizationType: document.getElementById('optimization-type')?.value || 'cheapest',
        maxResults: 20
    };
}

    validateFlightSearchParams(params) {
        if (!params.origin || !params.destination) {
            this.showError('Lütfen kalkış ve varış noktalarını seçin.');
            return false;
        }
        
        if (params.origin === params.destination) {
            this.showError('Kalkış ve varış noktaları aynı olamaz.');
            return false;
        }
        
        if (!params.departureDate) {
            this.showError('Lütfen kalkış tarihini seçin.');
            return false;
        }
        
        // Tarih kontrolü
        const today = new Date().toISOString().split('T')[0];
        if (params.departureDate < today) {
            this.showError('Geçmiş bir tarih seçemezsiniz.');
            return false;
        }
        
        return true;
    }
    
    displayFlightResults(flights, searchParams) {
        const container = document.getElementById('results-container');
        
        if (!container) {
            console.error('Results container bulunamadı');
            return;
        }
        
        if (!flights || flights.length === 0) {
            container.innerHTML = `
                <div class="placeholder-message">
                    <h3>Uçuş Bulunamadı</h3>
                    <p>Seçtiğiniz kriterlere uygun uçuş bulunamadı.</p>
                    <p>Lütfen farklı tarih veya rotalar deneyin.</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="search-info">
                <h3>Arama Sonuçları</h3>
                <p><strong>Rota:</strong> ${searchParams.origin} → ${searchParams.destination}</p>
                <p><strong>Tarih:</strong> ${searchParams.departureDate}</p>
                <p><strong>Bulunan Uçuş:</strong> ${flights.length} adet</p>
            </div>
            
            <div class="flight-results">
        `;
        
        flights.forEach((flight, index) => {
            const itinerary = flight.itineraries?.[0]; // İlk itinerary'yi kullan
            if (!itinerary) return;
            
            const isDirect = itinerary.isDirect;
            
            html += `
                <div class="flight-card">
                    <div class="flight-header">
                        <div class="flight-route">
                            ${searchParams.origin} → ${searchParams.destination}
                            <span class="flight-type">${isDirect ? 'Direkt' : 'Aktarmalı'}</span>
                        </div>
                        <div class="flight-price">
                            ${flight.price} ${flight.currency}
                        </div>
                    </div>
                    
                    <div class="flight-details">
                        <div class="flight-detail">
                            <span class="detail-label">Uçuş Süresi</span>
                            <span class="detail-value">${this.flightSearch.formatDuration(itinerary.duration)}</span>
                        </div>
                        <div class="flight-detail">
                            <span class="detail-label">Aktarma</span>
                            <span class="detail-value">${itinerary.transferCount}</span>
                        </div>
                        <div class="flight-detail">
                            <span class="detail-label">Uçuş Tipi</span>
                            <span class="detail-value">${isDirect ? 'Direkt' : 'Aktarmalı'}</span>
                        </div>
                        <div class="flight-detail">
                            <span class="detail-label">Havayolu</span>
                            <span class="detail-value">${itinerary.segments?.[0]?.airline || 'Bilinmiyor'}</span>
                        </div>
                    </div>
                    
                    <div class="flight-segments">
                        <strong>Uçuş Detayları:</strong>
                        ${itinerary.segments ? itinerary.segments.map(segment => `
                            <div class="segment">
                                <div class="segment-info">
                                    <span class="segment-airline">${segment.airline || 'Bilinmiyor'}</span>
                                    <span class="segment-route">${segment.departure.airport} → ${segment.arrival.airport}</span>
                                </div>
                                <div class="segment-time">
                                    ${this.formatDateTime(segment.departure.time)}
                                </div>
                            </div>
                        `).join('') : 'Detay bulunamadı'}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        
    
        /* Dosya indirme linki
        html += `
            <div class="download-section">
                <p>📥 Uçuş verilerini JSON formatında indirin:</p>
                <a href="#" id="download-results" class="download-btn" style="display: none;">
                    💾 Sonuçları İndir
                </a>
            </div>
        `;
        
        container.innerHTML = html;

        // Download linkini aktif et
        if (this.flightSearch && typeof this.flightSearch.saveResultsToFile === 'function') {
            this.flightSearch.saveResultsToFile();
        }*/
    }

    formatDateTime(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('tr-TR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Geçersiz tarih';
        }
    }
    
    showLoading(show) {
        const loadingSection = document.getElementById('loading-section');
        const resultsContainer = document.getElementById('results-container');
        
        if (loadingSection) {
            loadingSection.style.display = show ? 'block' : 'none';
        }
        
        if (resultsContainer) {
            resultsContainer.style.display = show ? 'none' : 'block';
        }
    }
    
    showError(message) {
        alert(` ${message}`);
    }

    showSuccess(message) {
        console.log(` ${message}`);
    }
    
    initializeAirportsPage() {
        // Havalimanları sayfası için özel başlatma işlemleri
        console.log('Havalimanları sayfası başlatıldı');
        this.loadAirportsList();
        
        // Arama ve filtreleme event listener'ları
        const searchInput = document.getElementById('airport-search');
        const regionFilter = document.getElementById('region-filter');
        const typeFilter = document.getElementById('type-filter');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterAirports(e.target.value);
            });
        }
        
        if (regionFilter) {
            regionFilter.addEventListener('change', (e) => {
                this.filterAirportsByRegion(e.target.value);
            });
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.filterAirportsByType(e.target.value);
            });
        }
    }
    
    initializeStatisticsPage() {
        // İstatistikler sayfası için özel başlatma işlemleri
        console.log('İstatistikler sayfası başlatıldı');
        this.loadStatistics();
    }
    
    // navigation.js dosyasında loadAirportsList fonksiyonunu güncelleyin

loadAirportsList() {
    const airportsList = document.getElementById('airports-list');
    
    if (!airportsList) return;

    // Gerçek havalimanı verilerini kullan
    const airports = window.flightNetwork ? window.flightNetwork.airportData : [];
    
    // Bölge ve tür bilgilerini eklemek için yardımcı fonksiyon
    const getRegion = (airport) => {
        // Havalimanı şehrine göre bölge belirleme
        const regionMap = {
            'İstanbul': 'marmara',
            'Ankara': 'icanadolu',
            'İzmir': 'ege',
            'Antalya': 'akdeniz',
            'Trabzon': 'karadeniz',
            'Erzurum': 'dogu',
            'Diyarbakır': 'guneydogu'
            // Diğer şehirleri buraya ekleyin
        };
        return regionMap[airport.city] || 'marmara'; // Varsayılan olarak marmara
    };
    
    const getType = (airport) => {
        // Havalimanı adına göre tür belirleme
        if (airport.name.includes('Askeri') || airport.name.includes('Hava Üssü')) {
            return 'askeri';
        } else if (airport.name.includes('Havalimanı')) {
            return 'sivil';
        } else {
            return 'karma';
        }
    };

    if (airports.length === 0) {
        // Fallback: örnek veriler
        const sampleAirports = [
            { name: "İstanbul Havalimanı", city: "İstanbul", iata: "IST", type: "Sivil", region: "marmara" },
            { name: "Ankara Esenboğa Havalimanı", city: "Ankara", iata: "ESB", type: "Sivil", region: "icanadolu" },
            { name: "Antalya Havalimanı", city: "Antalya", iata: "AYT", type: "Karma", region: "akdeniz" },
            { name: "İzmir Adnan Menderes Havalimanı", city: "İzmir", iata: "ADB", type: "Sivil", region: "ege" }
        ];
        
        airportsList.innerHTML = sampleAirports.map(airport => `
            <div class="airport-card detailed" data-region="${airport.region}" data-type="${airport.type.toLowerCase()}">
                <div class="airport-header">
                    <h4>${airport.name}</h4>
                    <span class="airport-code">${airport.iata}</span>
                </div>
                <div class="airport-info">
                    <p><strong>Şehir:</strong> ${airport.city}</p>
                    <p><strong>Tür:</strong> ${airport.type}</p>
                    <p><strong>Bölge:</strong> ${this.getRegionName(airport.region)}</p>
                    <p><strong>Bağlantı Sayısı:</strong> ${window.flightNetwork.flightCounts[airport.iata] || 0}</p>
                </div>

            </div>
        `).join('');
    } else {
        // Gerçek verileri kullan
        airportsList.innerHTML = airports.map(airport => {
            const region = getRegion(airport);
            const type = getType(airport);
            
            return `
                <div class="airport-card detailed" data-region="${region}" data-type="${type}">
                    <div class="airport-header">
                        <h4>${airport.name}</h4>
                        <span class="airport-code">${airport.iata}</span>
                    </div>
                    <div class="airport-info">
                        <p><strong>Şehir:</strong> ${airport.city}</p>
                        <p><strong>Tür:</strong> ${type}</p>
                        <p><strong>Bölge:</strong> ${this.getRegionName(region)}</p>
                        <p><strong>Bağlantı Sayısı:</strong> ${window.flightNetwork.flightCounts[airport.iata] || 0}</p>
                    </div>

                </div>
            `;
        }).join('');
    }
}

    viewAirportDetails(airportCode) {
        let airport;
        
        if (window.flightNetwork) {
            airport = window.flightNetwork.airportData.find(a => a.iata === airportCode);
        }
        
        if (airport) {
            const details = `
                🏢 <strong>${airport.name}</strong><br>
                📍 <strong>Şehir:</strong> ${airport.city}<br>
                🆔 <strong>IATA:</strong> ${airport.iata}<br>
                🏷️ <strong>ICAO:</strong> ${airport.icao}<br>
                🏛️ <strong>Tür:</strong> ${airport.type}<br>
                📅 <strong>Açılış:</strong> ${airport.year || 'Bilinmiyor'}<br>
                🔗 <strong>Bağlantı Sayısı:</strong> ${window.flightNetwork.flightCounts[airport.iata] || 0}
            `;
            alert(details);
        } else {
            alert(`Havalimanı bilgileri bulunamadı: ${airportCode}`);
        }
    }
    
    getRegionName(region) {
        const regions = {
            'marmara': 'Marmara',
            'ege': 'Ege',
            'akdeniz': 'Akdeniz',
            'icanadolu': 'İç Anadolu',
            'karadeniz': 'Karadeniz',
            'dogu': 'Doğu Anadolu',
            'guneydogu': 'Güneydoğu Anadolu'
        };
        return regions[region] || region;
    }
    
    // navigation.js'deki filter fonksiyonlarını güncelleyin
filterAirports(searchTerm) {
    const airports = document.querySelectorAll('.airport-card.detailed');
    const term = cleanText(searchTerm);
    
    let hasResults = false;
    
    airports.forEach(card => {
        const airportName = cleanText(card.querySelector('.airport-header h4')?.textContent || '');
        const airportCity = cleanText(card.querySelector('.airport-info p:nth-child(1)')?.textContent || '');
        const airportCode = cleanText(card.querySelector('.airport-code')?.textContent || '');
        
        const matches = airportName.includes(term) || 
                       airportCity.includes(term) || 
                       airportCode.includes(term);
        
        if (matches) {
            card.style.display = 'block';
            hasResults = true;
            // Vurgulama efekti
            card.style.animation = 'highlightPulse 0.6s ease';
        } else {
            card.style.display = 'none';
        }
    });
    
    this.showNoResultsMessage(!hasResults);
}

// navigation.js dosyasında filterAirportsByRegion ve filterAirportsByType fonksiyonlarını güncelleyin

filterAirportsByRegion(region) {
    const airports = document.querySelectorAll('.airport-card.detailed');
    let hasResults = false;
    
    airports.forEach(card => {
        if (!region) {
            card.style.display = 'block';
            hasResults = true;
            return;
        }
        
        // Havalimanı bilgilerini al
        const airportInfo = card.querySelector('.airport-info');
        if (!airportInfo) return;
        
        // Bölge bilgisini ara - daha geniş bir arama yapalım
        const infoText = cleanText(airportInfo.textContent);
        const airportName = cleanText(card.querySelector('.airport-header h4')?.textContent || '');
        const airportCity = cleanText(card.querySelector('.airport-info p:nth-child(1)')?.textContent || '');
        
        // Bölge eşleştirme
const regionMap = {
    marmara: [
        'marmara', 'istanbul', 'edirne', 'tekirdağ', 'kırklareli', 'balıkesir', 'çanakkale',
        'bursa', 'yalova', 'kocaeli', 'sakarya', 'bilecik'
    ],
    ege: [
        'ege', 'izmir', 'manisa', 'aydın', 'denizli', 'muğla', 'uşak', 'kütahya',
        'afyonkarahisar', 'afyon'
    ],
    akdeniz: [
        'akdeniz', 'antalya', 'mersin', 'içel', 'adana', 'hatay', 'osmaniye',
        'kahramanmaraş', 'gaziantep', 'kilis', 'burdur', 'ısparta'
    ],
    icanadolu: [
        'iç anadolu', 'ankara', 'konya', 'kayseri', 'sivas', 'eskişehir', 'çankırı',
        'aksaray', 'karaman', 'kırıkkale', 'kırşehir', 'nevşehir', 'niğde', 'yozgat'
    ],
    karadeniz: [
        'karadeniz', 'trabzon', 'samsun', 'ordu', 'giresun', 'rize', 'artvin', 'zonguldak',
        'sinop', 'kastamonu', 'bolu', 'düzce', 'bartın', 'karabük', 'amasya',
        'gümüşhane', 'bayburt', 'tokat', 'çorum'
    ],
    doguanadolu: [
        'doğu anadolu', 'erzurum', 'erzincan', 'ağrı', 'kars', 'ığdır', 'ardahan', 'van',
        'muş', 'bitlis', 'hakkari', 'elazığ', 'malatya', 'tunceli', 'bingöl'
    ],
    guneydogu: [
        'güneydoğu anadolu', 'diyarbakır', 'şanlıurfa', 'mardin', 'batman',
        'siirt', 'şırnak', 'adıyaman', 'gaziantep', 'kilis'
    ]
};

        const targetRegions = regionMap[region] || [];
        const matches = targetRegions.some(regionName => 
            infoText.includes(regionName) || 
            airportName.includes(regionName) || 
            airportCity.includes(regionName)
        );
        
        if (matches) {
            card.style.display = 'block';
            hasResults = true;
            // Vurgulama efekti
            card.style.animation = 'highlightPulse 0.6s ease';
        } else {
            card.style.display = 'none';
        }
    });
    
    this.showNoResultsMessage(!hasResults);
}

filterAirportsByType(type) {
    const airports = document.querySelectorAll('.airport-card.detailed');
    let hasResults = false;
    
    airports.forEach(card => {
        if (!type) {
            card.style.display = 'block';
            hasResults = true;
            return;
        }
        
        // Havalimanı bilgilerini al
        const airportInfo = card.querySelector('.airport-info');
        if (!airportInfo) return;
        
        // Tür bilgisini ara
        const infoText = cleanText(airportInfo.textContent);
        const typeMap = {
            'sivil': ['sivil', 'civil', 'public'],
            'askeri': ['askeri', 'military', 'askerî'],
            'karma': ['karma', 'mixed', 'civil-military']
        };
        
        const targetTypes = typeMap[type] || [];
        const matches = targetTypes.some(typeName => 
            infoText.includes(typeName)
        );
        
        if (matches) {
            card.style.display = 'block';
            hasResults = true;
            // Vurgulama efekti
            card.style.animation = 'highlightPulse 0.6s ease';
        } else {
            card.style.display = 'none';
        }
    });
    
    this.showNoResultsMessage(!hasResults);
}



showNoResultsMessage(show) {
    let message = document.getElementById('no-results-message');
    
    if (show && !message) {
        message = document.createElement('div');
        message.id = 'no-results-message';
        message.className = 'no-results';
        message.innerHTML = `
            <h3>Sonuç Bulunamadı</h3>
            <p>Arama kriterlerinize uygun havalimanı bulunamadı.</p>
            <p>Lütfen farklı filtreler deneyin.</p>
        `;
        document.querySelector('.airports-list').appendChild(message);
    } else if (!show && message) {
        message.remove();
    }
}


    
    filterAirportsByType(type) {
        const airports = document.querySelectorAll('.airport-card.detailed');
        
        airports.forEach(card => {
            if (!type) {
                card.style.display = 'block';
                return;
            }
            
            const typeText = card.querySelector('.airport-info')?.textContent || '';
            card.style.display = typeText.toLowerCase().includes(type.toLowerCase()) ? 'block' : 'none';
        });
    }
   

    loadStatistics() {
    const generalStats = document.getElementById('general-stats');
    const topStats = document.getElementById('top-stats');
    const regionalStats = document.getElementById('regional-stats');
    
    if (!generalStats || !topStats || !regionalStats) return;

    if (window.flightNetwork) {
        const stats = window.flightNetwork.calculateNetworkStats();
        
        // Bölgesel dağılımı hesapla
        const regionalDistribution = this.calculateRegionalDistribution();
        
        generalStats.innerHTML = `
            <p><strong>Toplam Havalimanı:</strong> ${stats.totalAirports}</p>
            <p><strong>Toplam Bağlantı:</strong> ${stats.totalConnections}</p>
            <p><strong>Ortalama Bağlantı:</strong> ${stats.averageConnections}</p>
            <p><strong>Toplam Ağ Uzunluğu:</strong> ${Math.round(stats.totalDistance)} km</p>
        `;
        
        topStats.innerHTML = `
            <p><strong>En Bağlantılı:</strong> ${stats.mostConnected.city} (${stats.mostConnected.iata}) - ${window.flightNetwork.flightCounts[stats.mostConnected.iata]} bağlantı</p>
            <p><strong>En Az Bağlantılı:</strong> ${stats.leastConnected.city} (${stats.leastConnected.iata}) - ${window.flightNetwork.flightCounts[stats.leastConnected.iata]} bağlantı</p>
            <p><strong>En Yoğun:</strong> İstanbul (IST)</p>
            <p><strong>En Uzak:</strong> Hakkari (YKO)</p>
        `;
        
        // Gerçek bölgesel dağılımı göster
        regionalStats.innerHTML = `
            <p><strong>Marmara:</strong> ${regionalDistribution.marmara} havalimanı</p>
            <p><strong>Ege:</strong> ${regionalDistribution.ege} havalimanı</p>
            <p><strong>Akdeniz:</strong> ${regionalDistribution.akdeniz} havalimanı</p>
            <p><strong>İç Anadolu:</strong> ${regionalDistribution.icanadolu} havalimanı</p>
            <p><strong>Karadeniz:</strong> ${regionalDistribution.karadeniz} havalimanı</p>
            <p><strong>Doğu Anadolu:</strong> ${regionalDistribution.dogu} havalimanı</p>
            <p><strong>Güneydoğu Anadolu:</strong> ${regionalDistribution.guneydogu} havalimanı</p>
            <p><strong>Toplam:</strong> ${regionalDistribution.total} havalimanı</p>
        `;
    } else {
        // Fallback istatistikler
        generalStats.innerHTML = `
            <p><strong>Toplam Havalimanı:</strong> 52</p>
            <p><strong>Toplam Bağlantı:</strong> 287</p>
            <p><strong>Ortalama Bağlantı:</strong> 6.4</p>
            <p><strong>En Uzun Uçuş:</strong> 1,650 km</p>
        `;
        
        topStats.innerHTML = `
            <p><strong>En Bağlantılı:</strong> İstanbul (IST) - 32 bağlantı</p>
            <p><strong>En Yeni:</strong> Çukurova (COV) - 2024</p>
            <p><strong>En Yoğun:</strong> İstanbul (IST)</p>
            <p><strong>En Uzak:</strong> Hakkari (YKO)</p>
        `;
        
        // Gerçek dağılımı göster
        const realDistribution = this.calculateRealRegionalDistribution();
        regionalStats.innerHTML = `
            <p><strong>Marmara:</strong> ${realDistribution.marmara} havalimanı</p>
            <p><strong>Ege:</strong> ${realDistribution.ege} havalimanı</p>
            <p><strong>Akdeniz:</strong> ${realDistribution.akdeniz} havalimanı</p>
            <p><strong>İç Anadolu:</strong> ${realDistribution.icanadolu} havalimanı</p>
            <p><strong>Karadeniz:</strong> ${realDistribution.karadeniz} havalimanı</p>
            <p><strong>Doğu Anadolu:</strong> ${realDistribution.dogu} havalimanı</p>
            <p><strong>Güneydoğu Anadolu:</strong> ${realDistribution.guneydogu} havalimanı</p>
            <p><strong>Toplam:</strong> ${realDistribution.total} havalimanı</p>
        `;
    }
}

calculateRegionalDistribution() {
    if (!window.flightNetwork) {
        return this.calculateRealRegionalDistribution();
    }

    const airports = window.flightNetwork.airportData;
    const distribution = {
        marmara: 0,
        ege: 0,
        akdeniz: 0,
        icanadolu: 0,
        karadeniz: 0,
        dogu: 0,
        guneydogu: 0,
        total: 0
    };

    airports.forEach(airport => {
        const region = this.getAirportRegion(airport);
        if (distribution.hasOwnProperty(region)) {
            distribution[region]++;
            distribution.total++;
        }
    });

    return distribution;
}

// Havalimanının bölgesini belirle
getAirportRegion(airport) {
    const city = airport.city.toLowerCase();
    
    // Marmara Bölgesi
    const marmaraCities = ['istanbul', 'edirne', 'tekirdağ', 'kırklareli', 'balıkesir', 'çanakkale', 'bursa', 'yalova', 'kocaeli', 'sakarya', 'bilecik'];
    if (marmaraCities.some(c => city.includes(c))) return 'marmara';
    
    // Ege Bölgesi
    const egeCities = ['izmir', 'manisa', 'aydın', 'denizli', 'muğla', 'uşak', 'kütahya', 'afyon'];
    if (egeCities.some(c => city.includes(c))) return 'ege';
    
    // Akdeniz Bölgesi
    const akdenizCities = ['antalya', 'mersin', 'adana', 'hatay', 'osmaniye', 'kahramanmaraş', 'gaziantep', 'kilis', 'burdur', 'ısparta'];
    if (akdenizCities.some(c => city.includes(c))) return 'akdeniz';
    
    // İç Anadolu Bölgesi
    const icanadoluCities = ['ankara', 'konya', 'kayseri', 'sivas', 'eskişehir', 'çankırı', 'aksaray', 'karaman', 'kırıkkale', 'kırşehir', 'nevşehir', 'niğde', 'yozgat'];
    if (icanadoluCities.some(c => city.includes(c))) return 'icanadolu';
    
    // Karadeniz Bölgesi
    const karadenizCities = ['trabzon', 'samsun', 'ordu', 'giresun', 'rize', 'artvin', 'zonguldak', 'sinop', 'kastamonu', 'bolu', 'düzce', 'bartın', 'karabük', 'amasya', 'gümüşhane', 'bayburt', 'tokat'];
    if (karadenizCities.some(c => city.includes(c))) return 'karadeniz';
    
    // Doğu Anadolu Bölgesi
    const doguCities = ['erzurum', 'erzincan', 'ağrı', 'kars', 'ığdır', 'ardahan', 'van', 'muş', 'bitlis', 'hakkari', 'elazığ', 'malatya', 'tunceli', 'bingöl'];
    if (doguCities.some(c => city.includes(c))) return 'dogu';
    
    // Güneydoğu Anadolu Bölgesi
    const guneydoguCities = ['diyarbakır', 'şanlıurfa', 'mardin', 'batman', 'siirt', 'şırnak', 'adıyaman'];
    if (guneydoguCities.some(c => city.includes(c))) return 'guneydogu';
    
    return 'marmara'; // Varsayılan
}


// Gerçek havalimanı dağılımını hesapla (hardcoded)
calculateRealRegionalDistribution() {
    // 51 havalimanının gerçek dağılımı
    return {
        marmara: 8,   // İstanbul(2), Bursa, Tekirdağ, Çanakkale, Balıkesir, Sakarya, Kocaeli
        ege: 6,       // İzmir, Denizli, Muğla(2), Kütahya, Uşak
        akdeniz: 7,   // Antalya, Alanya, Mersin, Hatay, Isparta, Kahramanmaraş, Adana
        icanadolu: 8, // Ankara, Eskişehir, Konya, Kayseri, Nevşehir, Sivas, Kırıkkale, Aksaray
        karadeniz: 7, // Samsun, Trabzon, Zonguldak, Sinop, Ordu, Tokat, Amasya
        dogu: 8,      // Erzurum, Erzincan, Ağrı, Kars, Iğdır, Van, Muş, Bingöl, Elazığ
        guneydogu: 7, // Diyarbakır, Şanlıurfa, Mardin, Batman, Siirt, Şırnak, Adıyaman
        total: 51
    };
}

    async checkBackendConnection() {
        try {
            const isBackendHealthy = await this.flightSearch.checkBackendHealth();
            
            const container = document.getElementById('results-container');
            if (container && !isBackendHealthy) {
                container.innerHTML = `
                    <div class="backend-warning">
                        <h3>Backend Bağlantı Hatası</h3>
                        <p><strong>Backend servisine ulaşılamıyor.</strong></p>
                        <div class="backend-info">
                            <p>Backend'i başlatmak için:</p>
                            <ol>
                                <li>Terminal'de backend klasörüne gidin: <code>cd backend</code></li>
                                <li>Gereksimleri yükleyin: <code>pip install -r requirements.txt</code></li>
                                <li>.env dosyasını oluşturun ve API anahtarlarınızı ekleyin</li>
                                <li>Backend'i başlatın: <code>python app.py</code></li>
                            </ol>
                            <p>Backend başlatıldıktan sonra sayfayı yenileyin.</p>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Backend bağlantı kontrolü hatası:', error);
        }
    }
}

// Navigasyonu başlat
let navigation;

document.addEventListener('DOMContentLoaded', function() {
    navigation = new Navigation();
});