// İstatistikler Sayfası
class Statistics {
    constructor() {
        this.data = {
            airTraffic: [],
            cargoTraffic: [],
            passengerTraffic: [],
            freightTraffic: []
        };
        
        this.charts = {
            flight: null,
            passenger: null,
            cargo: null,
            freight: null,
            compareFlight: null,
            comparePassenger: null,
            compareCargo: null,
            compareFreight: null,
            yearlyChange: null
        };
        
        this.currentComparisonCharts = [];
        this.isInitialized = false;
        this.initializeStatistics();
    }
    
    async initializeStatistics() {
        try {
            // Eğer zaten başlatılmışsa, önceki chart'ları temizle
            if (this.isInitialized) {
                this.destroyAllCharts();
            }
            
            // Verileri yükle
            await this.loadAllData();
            
            // Mod geçişlerini başlat
            this.initializeModeSwitching();
            
            // Tabları başlat
            this.initializeTabs();
            
            // Yıl dropdown'larını doldur
            this.populateYearDropdowns();
            
            // Tüm yılları göster modunu başlat
            this.showAllYears();
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('İstatistikler başlatılırken hata:', error);
            this.showError('Veriler yüklenirken hata oluştu.');
        }
    }
    
    destroyAllCharts() {
        // Tüm chart'ları temizle
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                try {
                    this.charts[key].destroy();
                    this.charts[key] = null;
                } catch (error) {
                    console.warn(`Chart temizlenirken hata (${key}):`, error);
                }
            }
        });
        
        // Ek olarak oluşturulan tüm chart'ları temizle
        this.currentComparisonCharts.forEach(chart => {
            if (chart) {
                try {
                    chart.destroy();
                } catch (error) {
                    console.warn('Karşılaştırma chart\'ı temizlenirken hata:', error);
                }
            }
        });
        this.currentComparisonCharts = [];
        
        // Canvas elementlerini de temizle
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            const context = canvas.getContext('2d');
            if (context) {
                context.clearRect(0, 0, canvas.width, canvas.height);
            }
        });
    }
    
    destroyComparisonCharts() {
        // Karşılaştırma chart'larını temizle
        ['compareFlight', 'comparePassenger', 'compareCargo', 'compareFreight', 'yearlyChange'].forEach(key => {
            if (this.charts[key]) {
                try {
                    this.charts[key].destroy();
                    this.charts[key] = null;
                } catch (error) {
                    console.warn(`Karşılaştırma chart'ı temizlenirken hata (${key}):`, error);
                }
            }
        });
        
        // Ek olarak oluşturulan tüm karşılaştırma chart'larını temizle
        this.currentComparisonCharts.forEach(chart => {
            if (chart) {
                try {
                    chart.destroy();
                } catch (error) {
                    console.warn('Karşılaştırma chart\'ı temizlenirken hata:', error);
                }
            }
        });
        this.currentComparisonCharts = [];
    }
    
    async loadAllData() {
        try {
            // Tüm CSV dosyalarını paralel olarak yükle
            const [airData, cargoData, passengerData, freightData] = await Promise.all([
                this.loadCSVData('air_traffic.csv'),
                this.loadCSVData('cargo_traffic.csv'),
                this.loadCSVData('passenger_traffic.csv'),
                this.loadCSVData('freight_traffic.csv')
            ]);
            
            this.data.airTraffic = airData;
            this.data.cargoTraffic = cargoData;
            this.data.passengerTraffic = passengerData;
            this.data.freightTraffic = freightData;
            
            console.log('Tüm veriler başarıyla yüklendi:', {
                airTraffic: airData.length,
                cargoTraffic: cargoData.length,
                passengerTraffic: passengerData.length,
                freightTraffic: freightData.length
            });
            
        } catch (error) {
            console.error('Veri yükleme hatası:', error);
            throw error;
        }
    }
    
    async loadCSVData(filename) {
        try {
            const response = await fetch(`assets/data/annual_statistics/${filename}`);
            if (!response.ok) {
                throw new Error(`Dosya bulunamadı: ${filename}`);
            }
            
            const csvText = await response.text();
            return this.parseCSV(csvText);
            
        } catch (error) {
            console.error(`CSV yükleme hatası (${filename}):`, error);
            
            // Fallback: test verileri
            return this.generateSampleData();
        }
    }
    
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = this.parseCSVLine(line);
            const row = {};
            
            headers.forEach((header, index) => {
                let value = values[index];
                
                // Sayısal değerleri parse et
                if (value && !isNaN(value.replace(',', '.'))) {
                    value = parseFloat(value.replace(',', '.'));
                }
                
                row[header] = value;
            });
            
            data.push(row);
        }
        
        // Yıla göre sırala
        return data.sort((a, b) => a.yil - b.yil);
    }
    
    parseCSVLine(line) {
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        
        values.push(currentValue);
        return values;
    }
    
    generateSampleData() {
        // Test amaçlı örnek veriler
        const years = [];
        const startYear = 2002;
        const endYear = 2027;
        
        for (let year = startYear; year <= endYear; year++) {
            years.push(year);
        }
        
        // Örnek veri oluştur
        return years.map(year => ({
            yil: year,
            // Uçuş trafiği
            tüm_uçak_overflight_dahil: Math.round(300000 + Math.random() * 2000000),
            uçak_trafiği: Math.round(200000 + Math.random() * 1500000),
            iç_hat: Math.round(100000 + Math.random() * 800000),
            dış_hat: Math.round(100000 + Math.random() * 800000),
            overflight_uçak_trafiği: Math.round(50000 + Math.random() * 500000),
            // Kargo trafiği
            kargo_trafiği_ton: Math.round(200000 + Math.random() * 2000000),
            iç_hat_kargo_ton: Math.round(50000 + Math.random() * 500000),
            dış_hat_kargo_ton: Math.round(150000 + Math.random() * 1500000),
            // Yolcu trafiği
            yolcu_trafiği_transit_dahil: Math.round(30000000 + Math.random() * 250000000),
            yolcu_trafiği: Math.round(30000000 + Math.random() * 220000000),
            iç_hat: Math.round(8000000 + Math.random() * 100000000),
            dış_hat: Math.round(20000000 + Math.random() * 150000000),
            direkt_transit: Math.round(50000 + Math.random() * 500000),
            // Yük trafiği
            yük_trafiği_ton: Math.round(800000 + Math.random() * 5000000),
            iç_hat_ton: Math.round(150000 + Math.random() * 1000000),
            dış_hat_ton: Math.round(650000 + Math.random() * 4000000)
        }));
    }
    
    initializeModeSwitching() {
        const allYearsBtn = document.getElementById('show-all-years');
        const compareBtn = document.getElementById('compare-years');
        const allYearsMode = document.getElementById('all-years-mode');
        const compareMode = document.getElementById('compare-mode');
        const runComparisonBtn = document.getElementById('run-comparison');
        
        // Mod geçişleri
        allYearsBtn.addEventListener('click', () => {
            allYearsBtn.classList.add('active');
            compareBtn.classList.remove('active');
            allYearsMode.classList.add('active');
            compareMode.classList.remove('active');
            
            // Grafikleri yeniden oluştur
            setTimeout(() => {
                this.createCharts();
            }, 100);
        });
        
        compareBtn.addEventListener('click', () => {
            compareBtn.classList.add('active');
            allYearsBtn.classList.remove('active');
            compareMode.classList.add('active');
            allYearsMode.classList.remove('active');
            
            // Karşılaştırma grafiklerini temizle
            this.destroyComparisonCharts();
            
            // Advanced options'ı başlat (karşılaştırma moduna geçtiğinde)
            this.initializeAdvancedOptions();
        });
        
        // Karşılaştırma butonu
        if (runComparisonBtn) {
            // Önceki event listener'ları temizlemek için clone tekniği kullan
            runComparisonBtn.replaceWith(runComparisonBtn.cloneNode(true));
            const newRunComparisonBtn = document.getElementById('run-comparison');

            newRunComparisonBtn.addEventListener('click', () => {
                console.log('➡️ Karşılaştırma butonuna tıklandı');
                this.runComparison();
            });
        } else {
            console.warn('run-comparison butonu bulunamadı, event listener eklenemedi');
        }
        
        // Sayfa yüklendiğinde advanced options'ı başlat (eğer karşılaştırma modundaysa)
        if (compareBtn.classList.contains('active')) {
            this.initializeAdvancedOptions();
        }
    }
    
    initializeTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tabs-content .tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                
                // Aktif butonu güncelle
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Aktif içeriği göster
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `tab-${tabId}`) {
                        content.classList.add('active');
                    }
                });
                
                // Tab değiştiğinde verileri yükle
                this.loadTabData(tabId);
            });
        });
        
        // İlk tab'ı yükle
        this.loadTabData('uçuş');
    }
    
    populateYearDropdowns() {
        const years = this.data.airTraffic.map(item => item.yil);
        const yearSelect1 = document.getElementById('compare-year1');
        const yearSelect2 = document.getElementById('compare-year2');
        
        if (!yearSelect1 || !yearSelect2) return;
        
        // Dropdown'ları temizle
        yearSelect1.innerHTML = '';
        yearSelect2.innerHTML = '';
        
        // Yılları ekle
        years.forEach(year => {
            const option1 = document.createElement('option');
            option1.value = year;
            option1.textContent = year;
            
            const option2 = document.createElement('option');
            option2.value = year;
            option2.textContent = year;
            
            yearSelect1.appendChild(option1.cloneNode(true));
            yearSelect2.appendChild(option2.cloneNode(true));
        });
        
        // Varsayılan değerleri ayarla (son ve sondan bir önceki yıl)
        if (years.length >= 2) {
            yearSelect1.value = years[years.length - 2];
            yearSelect2.value = years[years.length - 1];
        }
    }
    
    showAllYears() {
        // Tarihi analizleri göster
        this.showHistoricalAnalysis();
        
        // Geliştirilmiş analizleri ekle
        this.enhanceAllYearsMode();
        
        // Grafikleri oluştur
        this.createCharts();
        
        // Tüm tab verilerini yükle
        this.loadAllTabData();
        
        // Animasyonları tetikle
        setTimeout(() => {
            this.animateElements();
        }, 500);
    }
    
    showHistoricalAnalysis() {
        const recordsContainer = document.getElementById('historical-records');
        const pointsContainer = document.getElementById('important-points');
        
        if (!recordsContainer || !pointsContainer) return;
        
        // En yüksek ve en düşük değerleri bul
        const records = this.calculateHistoricalRecords();
        const importantPoints = this.calculateImportantPoints();
        
        // Rekorları göster
        recordsContainer.innerHTML = records.map(record => `
            <div class="record-item ${record.type}">
                <div class="record-title">${record.title}</div>
                <div class="record-value">${this.formatNumber(record.value)} ${record.unit}</div>
                <div class="record-year">${record.year} yılı</div>
            </div>
        `).join('');
        
        // Önemli noktaları göster
        pointsContainer.innerHTML = importantPoints.map(point => `
            <div class="point-item">
                <div class="point-title">${point.title}</div>
                <div class="point-description">${point.description}</div>
                <div class="point-years">${point.years}</div>
            </div>
        `).join('');
    }
    
    calculateHistoricalRecords() {
        const records = [];
        
        // Uçuş trafiği rekorları
        const maxFlights = this.findMaxValue(this.data.airTraffic, 'uçak_trafiği');
        const minFlights = this.findMinValue(this.data.airTraffic, 'uçak_trafiği');
        
        records.push({
            title: 'En Yüksek Uçuş Trafiği',
            value: maxFlights.value,
            year: maxFlights.year,
            unit: 'uçuş',
            type: 'high'
        });
        
        records.push({
            title: 'En Düşük Uçuş Trafiği',
            value: minFlights.value,
            year: minFlights.year,
            unit: 'uçuş',
            type: 'low'
        });
        
        // Yolcu trafiği rekorları
        const maxPassengers = this.findMaxValue(this.data.passengerTraffic, 'yolcu_trafiği');
        const minPassengers = this.findMinValue(this.data.passengerTraffic, 'yolcu_trafiği');
        
        records.push({
            title: 'En Yüksek Yolcu Trafiği',
            value: maxPassengers.value,
            year: maxPassengers.year,
            unit: 'yolcu',
            type: 'high'
        });
        
        // Kargo trafiği rekorları
        const maxCargo = this.findMaxValue(this.data.cargoTraffic, 'kargo_trafiği_ton');
        records.push({
            title: 'En Yüksek Kargo Trafiği',
            value: maxCargo.value,
            year: maxCargo.year,
            unit: 'ton',
            type: 'high'
        });
        
        // Yük trafiği rekorları
        const maxFreight = this.findMaxValue(this.data.freightTraffic, 'yük_trafiği_ton');
        records.push({
            title: 'En Yüksek Yük Trafiği',
            value: maxFreight.value,
            year: maxFreight.year,
            unit: 'ton',
            type: 'high'
        });
        
        return records;
    }
    
    calculateImportantPoints() {
        const points = [];
        
        // En büyük artışlar
        const flightGrowth = this.calculateMaxGrowth(this.data.airTraffic, 'uçak_trafiği');
        const passengerGrowth = this.calculateMaxGrowth(this.data.passengerTraffic, 'yolcu_trafiği');
        const cargoGrowth = this.calculateMaxGrowth(this.data.cargoTraffic, 'kargo_trafiği_ton');
        
        points.push({
            title: 'En Büyük Uçuş Artışı',
            description: `%${flightGrowth.percentage.toFixed(1)} artış`,
            years: `${flightGrowth.fromYear} → ${flightGrowth.toYear}`
        });
        
        points.push({
            title: 'En Büyük Yolcu Artışı',
            description: `%${passengerGrowth.percentage.toFixed(1)} artış`,
            years: `${passengerGrowth.fromYear} → ${passengerGrowth.toYear}`
        });
        
        // COVID-19 etkisi (2020 yılı düşüşü)
        const covidYear = this.data.airTraffic.find(d => d.yil === 2020);
        if (covidYear) {
            const prevYear = this.data.airTraffic.find(d => d.yil === 2019);
            if (prevYear) {
                const decrease = ((prevYear.uçak_trafiği - covidYear.uçak_trafiği) / prevYear.uçak_trafiği * 100).toFixed(1);
                points.push({
                    title: 'COVID-19 Etkisi',
                    description: `Uçuş trafiğinde %${decrease} düşüş`,
                    years: '2019 → 2020'
                });
            }
        }
        
        // Son 5 yıl trendi
        const recentYears = this.data.airTraffic.slice(-5);
        const firstYear = recentYears[0];
        const lastYear = recentYears[recentYears.length - 1];
        const trend = ((lastYear.uçak_trafiği - firstYear.uçak_trafiği) / firstYear.uçak_trafiği * 100).toFixed(1);
        
        points.push({
            title: 'Son 5 Yıl Trendi',
            description: `Uçuş trafiğinde %${trend} ${trend > 0 ? 'artış' : 'düşüş'}`,
            years: `${firstYear.yil} → ${lastYear.yil}`
        });
        
        return points;
    }
    
    findMaxValue(data, field) {
        let max = { value: -Infinity, year: null };
        
        data.forEach(item => {
            if (item[field] > max.value) {
                max.value = item[field];
                max.year = item.yil;
            }
        });
        
        return max;
    }
    
    findMinValue(data, field) {
        let min = { value: Infinity, year: null };
        
        data.forEach(item => {
            if (item[field] < min.value) {
                min.value = item[field];
                min.year = item.yil;
            }
        });
        
        return min;
    }
    
    calculateMaxGrowth(data, field) {
        let maxGrowth = { percentage: 0, fromYear: null, toYear: null };
        
        for (let i = 1; i < data.length; i++) {
            const current = data[i][field];
            const previous = data[i-1][field];
            
            if (previous > 0) {
                const growth = ((current - previous) / previous) * 100;
                
                if (growth > maxGrowth.percentage) {
                    maxGrowth.percentage = growth;
                    maxGrowth.fromYear = data[i-1].yil;
                    maxGrowth.toYear = data[i].yil;
                }
            }
        }
        
        return maxGrowth;
    }
    
    createCharts() {
        // Mevcut chart'ları temizle
        this.destroyMainCharts();
        
        // Yeni chart'lar oluştur
        setTimeout(() => {
            this.charts.flight = this.createChart('flight-traffic-chart', 'Uçuş Trafiği', this.data.airTraffic, 'uçak_trafiği', '#3b82f6');
            this.charts.passenger = this.createChart('passenger-traffic-chart', 'Yolcu Trafiği', this.data.passengerTraffic, 'yolcu_trafiği', '#10b981');
            this.charts.cargo = this.createChart('cargo-traffic-chart', 'Kargo Trafiği (ton)', this.data.cargoTraffic, 'kargo_trafiği_ton', '#f59e0b');
            this.charts.freight = this.createChart('freight-traffic-chart', 'Yük Trafiği (ton)', this.data.freightTraffic, 'yük_trafiği_ton', '#8b5cf6');
        }, 100);
    }
    
    destroyMainCharts() {
        // Ana chart'ları temizle
        ['flight', 'passenger', 'cargo', 'freight'].forEach(key => {
            if (this.charts[key]) {
                try {
                    this.charts[key].destroy();
                    this.charts[key] = null;
                } catch (error) {
                    console.warn(`Ana chart temizlenirken hata (${key}):`, error);
                }
            }
        });
    }
    
    createChart(canvasId, label, data, dataField, color) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.warn(`Canvas bulunamadı: ${canvasId}`);
            return null;
        }
        
        // Canvas'ı temizle
        const context = ctx.getContext('2d');
        if (context) {
            context.clearRect(0, 0, ctx.width, ctx.height);
        }
        
        const years = data.map(item => item.yil);
        const values = data.map(item => item[dataField]);
        
        // En yüksek değeri bul
        const maxValue = Math.max(...values);
        const maxIndex = values.indexOf(maxValue);
        
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: years,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: years.map((year, index) => 
                        index === maxIndex ? '#ef4444' : color
                    ),
                    borderColor: years.map((year, index) => 
                        index === maxIndex ? '#dc2626' : color
                    ),
                    borderWidth: 1
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
                            label: (context) => {
                                return `${label}: ${this.formatNumber(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatNumber(value)
                        }
                    }
                }
            }
        });
    }
    
    loadAllTabData() {
        ['uçuş', 'kargo', 'yolcu', 'yük'].forEach(tab => {
            this.loadTabData(tab);
        });
    }
    
    loadTabData(tabId) {
        switch(tabId) {
            case 'uçuş':
                this.loadFlightData();
                break;
            case 'kargo':
                this.loadCargoData();
                break;
            case 'yolcu':
                this.loadPassengerData();
                break;
            case 'yük':
                this.loadFreightData();
                break;
        }
    }
    
    loadFlightData() {
        const tableBody = document.querySelector('#flight-data-table tbody');
        if (!tableBody) return;
        
        const data = this.data.airTraffic;
        const maxFlight = Math.max(...data.map(d => d.uçak_trafiği));
        
        tableBody.innerHTML = data.map(item => {
            const isMax = item.uçak_trafiği === maxFlight;
            return `
                <tr class="${isMax ? 'highlight' : ''}">
                    <td>${item.yil}</td>
                    <td>${this.formatNumber(item.tüm_uçak_overflight_dahil)}</td>
                    <td>${this.formatNumber(item.uçak_trafiği)}</td>
                    <td>${this.formatNumber(item.iç_hat)}</td>
                    <td>${this.formatNumber(item.dış_hat)}</td>
                    <td>${this.formatNumber(item.overflight_uçak_trafiği)}</td>
                </tr>
            `;
        }).join('');
    }
    
    loadCargoData() {
        const tableBody = document.querySelector('#cargo-data-table tbody');
        if (!tableBody) return;
        
        const data = this.data.cargoTraffic;
        const maxCargo = Math.max(...data.map(d => d.kargo_trafiği_ton));
        
        tableBody.innerHTML = data.map(item => {
            const isMax = item.kargo_trafiği_ton === maxCargo;
            return `
                <tr class="${isMax ? 'highlight' : ''}">
                    <td>${item.yil}</td>
                    <td>${this.formatNumber(item.kargo_trafiği_ton)}</td>
                    <td>${this.formatNumber(item.iç_hat_kargo_ton)}</td>
                    <td>${this.formatNumber(item.dış_hat_kargo_ton)}</td>
                </tr>
            `;
        }).join('');
    }
    
    loadPassengerData() {
        const tableBody = document.querySelector('#passenger-data-table tbody');
        if (!tableBody) return;
        
        const data = this.data.passengerTraffic;
        const maxPassenger = Math.max(...data.map(d => d.yolcu_trafiği));
        
        tableBody.innerHTML = data.map(item => {
            const isMax = item.yolcu_trafiği === maxPassenger;
            return `
                <tr class="${isMax ? 'highlight' : ''}">
                    <td>${item.yil}</td>
                    <td>${this.formatNumber(item.yolcu_trafiği_transit_dahil)}</td>
                    <td>${this.formatNumber(item.yolcu_trafiği)}</td>
                    <td>${this.formatNumber(item.iç_hat)}</td>
                    <td>${this.formatNumber(item.dış_hat)}</td>
                    <td>${this.formatNumber(item.direkt_transit || 0)}</td>
                </tr>
            `;
        }).join('');
    }
    
    loadFreightData() {
        const tableBody = document.querySelector('#freight-data-table tbody');
        if (!tableBody) return;
        
        const data = this.data.freightTraffic;
        const maxFreight = Math.max(...data.map(d => d.yük_trafiği_ton));
        
        tableBody.innerHTML = data.map(item => {
            const isMax = item.yük_trafiği_ton === maxFreight;
            return `
                <tr class="${isMax ? 'highlight' : ''}">
                    <td>${item.yil}</td>
                    <td>${this.formatNumber(item.yük_trafiği_ton)}</td>
                    <td>${this.formatNumber(item.iç_hat_ton)}</td>
                    <td>${this.formatNumber(item.dış_hat_ton)}</td>
                </tr>
            `;
        }).join('');
    }
    
    getYearData(year) {
        return {
            air: this.data.airTraffic.find(d => d.yil === year),
            cargo: this.data.cargoTraffic.find(d => d.yil === year),
            passenger: this.data.passengerTraffic.find(d => d.yil === year),
            freight: this.data.freightTraffic.find(d => d.yil === year)
        };
    }
    
    createComparisonCharts(year1, year2, data1, data2) {
        // Karşılaştırma chart'larını temizle
        this.destroyComparisonCharts();
        
        // Yeni chart'lar oluştur
        setTimeout(() => {
            this.charts.compareFlight = this.createComparisonChart(
                'compare-flight-chart',
                'Uçuş Trafiği Karşılaştırması',
                [year1, year2],
                [
                    data1.air?.uçak_trafiği || 0,
                    data2.air?.uçak_trafiği || 0
                ],
                ['#3b82f6', '#ef4444']
            );
            
            this.charts.comparePassenger = this.createComparisonChart(
                'compare-passenger-chart',
                'Yolcu Trafiği Karşılaştırması',
                [year1, year2],
                [
                    data1.passenger?.yolcu_trafiği || 0,
                    data2.passenger?.yolcu_trafiği || 0
                ],
                ['#10b981', '#3b82f6']
            );
            
            this.charts.compareCargo = this.createComparisonChart(
                'compare-cargo-chart',
                'Kargo Trafiği Karşılaştırması (ton)',
                [year1, year2],
                [
                    data1.cargo?.kargo_trafiği_ton || 0,
                    data2.cargo?.kargo_trafiği_ton || 0
                ],
                ['#f59e0b', '#8b5cf6']
            );
            
            this.charts.compareFreight = this.createComparisonChart(
                'compare-freight-chart',
                'Yük Trafiği Karşılaştırması (ton)',
                [year1, year2],
                [
                    data1.freight?.yük_trafiği_ton || 0,
                    data2.freight?.yük_trafiği_ton || 0
                ],
                ['#8b5cf6', '#ec4899']
            );
        }, 100);
    }
    
    createComparisonChart(canvasId, label, years, values, colors) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.warn(`Karşılaştırma canvas bulunamadı: ${canvasId}`);
            return null;
        }
        
        // Canvas'ı temizle
        const context = ctx.getContext('2d');
        if (context) {
            context.clearRect(0, 0, ctx.width, ctx.height);
        }
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: years,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors.map(c => this.darkenColor(c, 20)),
                    borderWidth: 2
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
                            label: (context) => {
                                return `${label}: ${this.formatNumber(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatNumber(value)
                        }
                    }
                }
            }
        });
        
        // Chart'ı kaydet
        this.currentComparisonCharts.push(chart);
        return chart;
    }
    
    createComparisonTable(year1, year2, data1, data2) {
        const tableBody = document.querySelector('#comparison-table tbody');
        if (!tableBody) return;
        
        const comparisons = [
            {
                metric: 'Uçuş Trafiği',
                value1: data1.air?.uçak_trafiği || 0,
                value2: data2.air?.uçak_trafiği || 0,
                unit: 'uçuş'
            },
            {
                metric: 'İç Hat Uçuş',
                value1: data1.air?.iç_hat || 0,
                value2: data2.air?.iç_hat || 0,
                unit: 'uçuş'
            },
            {
                metric: 'Dış Hat Uçuş',
                value1: data1.air?.dış_hat || 0,
                value2: data2.air?.dış_hat || 0,
                unit: 'uçuş'
            },
            {
                metric: 'Yolcu Trafiği',
                value1: data1.passenger?.yolcu_trafiği || 0,
                value2: data2.passenger?.yolcu_trafiği || 0,
                unit: 'yolcu'
            },
            {
                metric: 'İç Hat Yolcu',
                value1: data1.passenger?.iç_hat || 0,
                value2: data2.passenger?.iç_hat || 0,
                unit: 'yolcu'
            },
            {
                metric: 'Dış Hat Yolcu',
                value1: data1.passenger?.dış_hat || 0,
                value2: data2.passenger?.dış_hat || 0,
                unit: 'yolcu'
            },
            {
                metric: 'Kargo Trafiği',
                value1: data1.cargo?.kargo_trafiği_ton || 0,
                value2: data2.cargo?.kargo_trafiği_ton || 0,
                unit: 'ton'
            },
            {
                metric: 'Yük Trafiği',
                value1: data1.freight?.yük_trafiği_ton || 0,
                value2: data2.freight?.yük_trafiği_ton || 0,
                unit: 'ton'
            }
        ];
        
        tableBody.innerHTML = comparisons.map(comp => {
            const diff = comp.value2 - comp.value1;
            const percentage = comp.value1 > 0 ? (diff / comp.value1 * 100) : 0;
            const isPositive = diff > 0;
            
            return `
                <tr>
                    <td><strong>${comp.metric}</strong> (${comp.unit})</td>
                    <td>${this.formatNumber(comp.value1)}</td>
                    <td>${this.formatNumber(comp.value2)}</td>
                    <td class="${isPositive ? 'positive-change' : 'negative-change'}">
                        ${isPositive ? '+' : ''}${this.formatNumber(diff)}
                    </td>
                    <td class="${isPositive ? 'positive-change' : 'negative-change'}">
                        ${isPositive ? '+' : ''}${percentage.toFixed(1)}%
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    formatNumber(num) {
        if (num === undefined || num === null) return '0';
        
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        } else {
            return Math.round(num).toLocaleString('tr-TR');
        }
    }
    
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        
        return '#' + (
            0x1000000 +
            (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)
        ).toString(16).slice(1);
    }
    
    showError(message) {
        console.warn('showError:', message);
        // Basit bir alert ile de göster (debug için)
        alert(message);

        // Geçici bir hata mesajı göster
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle" style="color: #ef4444; margin-right: 10px;"></i>
                <span>${message}</span>
            </div>
        `;
        
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 15px 25px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
            border-left: 4px solid #ef4444;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(errorDiv);
        
        // 3 saniye sonra kaldır
        setTimeout(() => {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 300);
        }, 3000);
    }

    async runComparison() {
        console.log('✅ runComparison çalıştı');

        const yearSelect1 = document.getElementById('compare-year1');
        const yearSelect2 = document.getElementById('compare-year2');

        if (!yearSelect1 || !yearSelect2) {
            this.showError('Yıl seçim alanları bulunamadı (compare-year1 / compare-year2).');
            return;
        }

        const year1 = parseInt(yearSelect1.value);
        const year2 = parseInt(yearSelect2.value);
        const advancedOptions = this.getAdvancedOptions();

        console.log('Seçilen yıllar:', year1, year2);
        console.log('Advanced options:', advancedOptions);

        if (!year1 || !year2) {
            this.showError('Lütfen iki yıl seçin.');
            return;
        }

        if (year1 === year2) {
            this.showError('Farklı yıllar seçmelisiniz.');
            return;
        }

        // Karşılaştırma sonuçları bölümünü kontrol et
        const resultsContainer = document.getElementById('comparison-results');
        if (!resultsContainer) {
            this.showError('Karşılaştırma sonuçları bölümü bulunamadı (comparison-results).');
            return;
        }

        // Butonu loading durumuna getir
        const compareBtn = document.getElementById('run-comparison');
        if (!compareBtn) {
            this.showError('Karşılaştırma butonu bulunamadı (run-comparison).');
            return;
        }

        const originalText = compareBtn.innerHTML;
        compareBtn.classList.add('loading');
        compareBtn.innerHTML = `<i class="fas fa-spinner"></i> Karşılaştırma Yapılıyor...`;
        compareBtn.disabled = true;

        try {
            // Önceki analiz bölümlerini temizle
            this.clearPreviousAnalyses();
            
            // Karşılaştırma sonuçlarını görünür yap
            resultsContainer.classList.add('active');
            resultsContainer.style.display = 'block';

            // Başlıkları güncelle
            this.updateComparisonHeaders(year1, year2);

            // Verileri al
            const data1 = this.getYearData(year1);
            const data2 = this.getYearData(year2);

            // Temel grafikleri oluştur
            this.createComparisonCharts(year1, year2, data1, data2);

            // Detaylı karşılaştırma tablosunu oluştur
            this.createComparisonTable(year1, year2, data1, data2);

            // Trend analizlerini göster
            if (advancedOptions.showTrendAnalysis) {
                this.showTrendAnalysis(year1, year2, data1, data2);
            }

            // Yoğunluk analizini göster
            if (advancedOptions.showDensityAnalysis) {
                this.showDensityAnalysis(year1, year2, data1, data2);
            }

            // Büyüme oranlarını göster
            if (advancedOptions.showGrowthRates) {
                this.showGrowthRates(year1, year2, data1, data2);
            }

            // Yıllık değişim grafiğini göster
            if (advancedOptions.showYearlyChange) {
                this.showYearlyChangeChart(year1, year2);
            }

            // Özet kartları göster
            this.showComparisonSummary(year1, year2, data1, data2);

        } catch (error) {
            console.error('Karşılaştırma yapılırken hata:', error);
            this.showError('Karşılaştırma sırasında hata oluştu: ' + error.message);
        } finally {
            // Butonu eski haline getir
            compareBtn.classList.remove('loading');
            compareBtn.innerHTML = originalText;
            compareBtn.disabled = false;
        }
    }

    clearPreviousAnalyses() {
        // Önceki dinamik olarak eklenen analiz bölümlerini kaldır
        const sectionsToRemove = [
            '.trend-analysis-section',
            '.density-analysis-section',
            '.growth-analysis-section',
            '.yearly-change-chart',
            '.comparison-summary'
        ];
        
        sectionsToRemove.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
        });
        
        // Yıllık değişim grafiğini temizle
        if (this.charts.yearlyChange) {
            try {
                this.charts.yearlyChange.destroy();
                this.charts.yearlyChange = null;
            } catch (error) {
                console.warn('Yearly change chart temizlenirken hata:', error);
            }
        }
    }

    getAdvancedOptions() {
        return {
            showTrendAnalysis: document.getElementById('option-trend-analysis')?.checked || false,
            showDensityAnalysis: document.getElementById('option-density-analysis')?.checked || false,
            showGrowthRates: document.getElementById('option-growth-rates')?.checked || false,
            showYearlyChange: document.getElementById('option-yearly-change')?.checked || false,
            normalizeData: document.getElementById('option-normalize')?.checked || false,
            showPercentage: document.getElementById('option-percentage')?.checked || false
        };
    }

    updateComparisonHeaders(year1, year2) {
        const year1Header = document.getElementById('year1-header');
        const year2Header = document.getElementById('year2-header');
        const year1HeaderTable = document.getElementById('year1-header-table');
        const year2HeaderTable = document.getElementById('year2-header-table');
        
        if (year1Header) {
            year1Header.innerHTML = `
                <div class="year-header">
                    <div class="year-number">${year1}</div>
                    <div class="year-label">Yıl 1</div>
                </div>
            `;
        }
        
        if (year2Header) {
            year2Header.innerHTML = `
                <div class="year-header">
                    <div class="year-number">${year2}</div>
                    <div class="year-label">Yıl 2</div>
                </div>
            `;
        }
        
        if (year1HeaderTable) {
            year1HeaderTable.textContent = year1;
        }
        
        if (year2HeaderTable) {
            year2HeaderTable.textContent = year2;
        }
    }

    showTrendAnalysis(year1, year2, data1, data2) {
        const comparisonResults = document.getElementById('comparison-results');
        if (!comparisonResults) {
            console.warn('comparison-results elementi bulunamadı');
            return;
        }
        
        const analysisSection = document.createElement('div');
        analysisSection.className = 'trend-analysis-section';
        analysisSection.innerHTML = `
            <h3><i class="fas fa-chart-line"></i> Trend Analizi</h3>
            <div class="trend-cards">
                <div class="trend-card">
                    <h4><i class="fas fa-plane"></i> Uçuş Trafiği Trendi</h4>
                    ${this.createTrendCard('uçak_trafiği', data1.air, data2.air, 'uçuş')}
                </div>
                <div class="trend-card">
                    <h4><i class="fas fa-users"></i> Yolcu Trendi</h4>
                    ${this.createTrendCard('yolcu_trafiği', data1.passenger, data2.passenger, 'yolcu')}
                </div>
                <div class="trend-card">
                    <h4><i class="fas fa-box"></i> Kargo Trendi</h4>
                    ${this.createTrendCard('kargo_trafiği_ton', data1.cargo, data2.cargo, 'ton')}
                </div>
                <div class="trend-card">
                    <h4><i class="fas fa-weight-hanging"></i> Yük Trendi</h4>
                    ${this.createTrendCard('yük_trafiği_ton', data1.freight, data2.freight, 'ton')}
                </div>
            </div>
        `;
        
        // Karşılaştırma sonuçları bölümüne ekle
        const detailedComparison = comparisonResults.querySelector('.detailed-comparison');
        
        if (detailedComparison) {
            comparisonResults.insertBefore(analysisSection, detailedComparison);
        } else {
            comparisonResults.appendChild(analysisSection);
        }
    }

    createTrendCard(field, data1, data2, unit) {
        if (!data1 || !data2 || !data1[field] || !data2[field]) {
            return '<div class="trend-description">Veri bulunamadı</div>';
        }
        
        const value1 = data1[field];
        const value2 = data2[field];
        const change = value2 - value1;
        const percentage = value1 > 0 ? (change / value1 * 100) : 0;
        const isPositive = change > 0;
        const isNegative = change < 0;
        
        let trendIcon = '';
        let trendClass = '';
        
        if (isPositive) {
            trendIcon = '<i class="fas fa-arrow-up"></i>';
            trendClass = 'trend-positive';
        } else if (isNegative) {
            trendIcon = '<i class="fas fa-arrow-down"></i>';
            trendClass = 'trend-negative';
        } else {
            trendIcon = '<i class="fas fa-minus"></i>';
            trendClass = 'trend-neutral';
        }
        
        return `
            <div class="trend-value ${trendClass}">
                ${trendIcon} ${percentage.toFixed(1)}%
            </div>
            <div class="trend-stats">
                <div class="trend-stat">
                    <span class="stat-label">Değişim:</span>
                    <span class="stat-value ${trendClass}">${isPositive ? '+' : ''}${this.formatNumber(change)} ${unit}</span>
                </div>
                <div class="trend-stat">
                    <span class="stat-label">Yıllık Ortalama:</span>
                    <span class="stat-value">${this.formatNumber((value1 + value2) / 2)} ${unit}/yıl</span>
                </div>
            </div>
            <div class="trend-description">
                ${isPositive ? 'Artış' : 'Düşüş'} trendi gözlemlenmektedir.
                ${Math.abs(percentage) > 10 ? 'Önemli bir değişim.' : 'Normal bir değişim.'}
            </div>
        `;
    }

    showDensityAnalysis(year1, year2, data1, data2) {
        const comparisonResults = document.getElementById('comparison-results');
        if (!comparisonResults) {
            console.warn('comparison-results elementi bulunamadı');
            return;
        }
        
        const densitySection = document.createElement('div');
        densitySection.className = 'density-analysis-section';
        densitySection.innerHTML = `
            <h3><i class="fas fa-chart-pie"></i> Yoğunluk Analizi</h3>
            <div class="density-cards">
                ${this.createDensityCard('Uçuş Başına Yolcu', data1, data2)}
                ${this.createDensityCard('Kargo Başına Yük', data1, data2)}
                ${this.createDensityCard('Yolcu Başına Gelir', data1, data2)}
                ${this.createDensityCard('Uçuş Başına Kapasite', data1, data2)}
            </div>
        `;
        
        // Trend analizinden sonra ekle
        const trendSection = document.querySelector('.trend-analysis-section');
        if (trendSection) {
            trendSection.after(densitySection);
        } else {
            comparisonResults.appendChild(densitySection);
        }
    }

    createDensityCard(title, data1, data2) {
        const density1 = this.calculateDensity(data1, title);
        const density2 = this.calculateDensity(data2, title);
        const change = density2 - density1;
        const percentage = density1 > 0 ? (change / density1 * 100) : 0;
        const isPositive = change > 0;
        
        return `
            <div class="density-card">
                <h4>${title}</h4>
                <div class="density-values">
                    <div class="density-year">
                        <span class="year-label">${data1.air?.yil || 'Yıl 1'}:</span>
                        <span class="density-value">${density1.toFixed(2)}</span>
                    </div>
                    <div class="density-year">
                        <span class="year-label">${data2.air?.yil || 'Yıl 2'}:</span>
                        <span class="density-value ${isPositive ? 'positive' : 'negative'}">${density2.toFixed(2)}</span>
                    </div>
                </div>
                <div class="density-change ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '↑' : '↓'} %${Math.abs(percentage).toFixed(1)} değişim
                </div>
            </div>
        `;
    }

    calculateDensity(data, title) {
        if (!data.air || !data.passenger || !data.cargo || !data.freight) return 0;
        
        switch(title) {
            case 'Uçuş Başına Yolcu':
                return data.passenger.yolcu_trafiği / data.air.uçak_trafiği;
            case 'Kargo Başına Yük':
                return data.freight.yük_trafiği_ton / data.cargo.kargo_trafiği_ton;
            case 'Yolcu Başına Gelir':
                return (data.passenger.yolcu_trafiği * 0.1) / data.passenger.yolcu_trafiği;
            case 'Uçuş Başına Kapasite':
                return data.passenger.yolcu_trafiği / (data.air.uçak_trafiği * 180);
            default:
                return 0;
        }
    }

    showGrowthRates(year1, year2, data1, data2) {
        const comparisonResults = document.getElementById('comparison-results');
        if (!comparisonResults) {
            console.warn('comparison-results elementi bulunamadı');
            return;
        }
        
        const growthSection = document.createElement('div');
        growthSection.className = 'growth-analysis-section';
        
        const growthRates = this.calculateGrowthRates(year1, year2, data1, data2);
        
        growthSection.innerHTML = `
            <h3>Büyüme Oranları Analizi</h3>
            <div class="growth-cards">
                ${growthRates.map(rate => `
                    <div class="growth-card">
                        <h4>${rate.metric}</h4>
                        <div class="growth-rate ${rate.rate > 0 ? 'positive' : 'negative'}">
                            ${rate.rate > 0 ? '+' : ''}${rate.rate.toFixed(1)}%
                        </div>
                        <div class="growth-description">
                            ${rate.description}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        const densitySection = document.querySelector('.density-analysis-section');
        if (densitySection) {
            densitySection.after(growthSection);
        } else {
            comparisonResults.appendChild(growthSection);
        }
    }

    calculateGrowthRates(year1, year2, data1, data2) {
        const rates = [];
        
        if (data1.air && data2.air) {
            const flightGrowth = this.calculateGrowthRate(
                data1.air.uçak_trafiği,
                data2.air.uçak_trafiği,
                year2 - year1
            );
            rates.push({
                metric: 'Uçuş Trafiği',
                rate: flightGrowth.yearlyRate,
                description: `Yıllık ortalama ${flightGrowth.yearlyRate > 0 ? 'büyüme' : 'küçülme'}`
            });
        }
        
        if (data1.passenger && data2.passenger) {
            const passengerGrowth = this.calculateGrowthRate(
                data1.passenger.yolcu_trafiği,
                data2.passenger.yolcu_trafiği,
                year2 - year1
            );
            rates.push({
                metric: 'Yolcu Trafiği',
                rate: passengerGrowth.yearlyRate,
                description: `${passengerGrowth.compoundRate > 0 ? 'Artış' : 'Azalış'} trendi`
            });
        }
        
        if (data1.cargo && data2.cargo) {
            const cargoGrowth = this.calculateGrowthRate(
                data1.cargo.kargo_trafiği_ton,
                data2.cargo.kargo_trafiği_ton,
                year2 - year1
            );
            rates.push({
                metric: 'Kargo Trafiği',
                rate: cargoGrowth.yearlyRate,
                description: `Yıllık ${cargoGrowth.yearlyRate > 0 ? 'büyüme' : 'küçülme'}`
            });
        }
        
        return rates;
    }

    calculateGrowthRate(startValue, endValue, years) {
        if (startValue === 0 || years === 0) return { yearlyRate: 0, compoundRate: 0 };
        
        const totalGrowth = (endValue - startValue) / startValue * 100;
        const yearlyRate = totalGrowth / years;
        const compoundRate = (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
        
        return { yearlyRate, compoundRate };
    }

    showYearlyChangeChart(year1, year2) {
        const comparisonResults = document.getElementById('comparison-results');
        if (!comparisonResults) {
            console.warn('comparison-results elementi bulunamadı');
            return;
        }
        
        const changeSection = document.createElement('div');
        changeSection.className = 'yearly-change-chart';
        changeSection.innerHTML = `
            <h3><i class="fas fa-chart-area"></i> Yıllık Değişim Grafiği (${year1}-${year2})</h3>
            <div class="custom-chart-container">
                <canvas id="yearly-change-chart"></canvas>
            </div>
        `;
        
        const growthSection = document.querySelector('.growth-analysis-section');
        if (growthSection) {
            growthSection.after(changeSection);
        } else {
            comparisonResults.appendChild(changeSection);
        }
        
        // Grafiği oluştur
        setTimeout(() => {
            this.createYearlyChangeChart(year1, year2);
        }, 100);
    }

    createYearlyChangeChart(startYear, endYear) {
        const ctx = document.getElementById('yearly-change-chart');
        if (!ctx) return;
        
        // Canvas'ı temizle
        const context = ctx.getContext('2d');
        if (context) {
            context.clearRect(0, 0, ctx.width, ctx.height);
        }
        
        // Mevcut chart'ı temizle
        if (this.charts.yearlyChange) {
            try {
                this.charts.yearlyChange.destroy();
            } catch (error) {
                console.warn('Yearly change chart temizlenirken hata:', error);
            }
        }
        
        // Seçilen yıllar arasındaki verileri al
        const years = [];
        const flightData = [];
        const passengerData = [];
        
        for (let year = startYear; year <= endYear; year++) {
            const yearData = this.getYearData(year);
            if (yearData.air && yearData.passenger) {
                years.push(year);
                flightData.push(yearData.air.uçak_trafiği);
                passengerData.push(yearData.passenger.yolcu_trafiği);
            }
        }
        
        this.charts.yearlyChange = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Uçuş Trafiği',
                        data: flightData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Yolcu Trafiği',
                        data: passengerData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${this.formatNumber(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: (value) => this.formatNumber(value)
                        }
                    }
                }
            }
        });
    }

    showComparisonSummary(year1, year2, data1, data2) {
        const comparisonResults = document.getElementById('comparison-results');
        if (!comparisonResults) {
            console.warn('comparison-results elementi bulunamadı');
            return;
        }
        
        const summarySection = document.createElement('div');
        summarySection.className = 'comparison-summary';
        summarySection.innerHTML = `
            <h3>Karşılaştırma Özeti</h3>
            <div class="summary-cards">
                <div class="summary-card">
                    <div class="summary-content">
                        <h4>Toplam Değişim</h4>
                        <div class="summary-value">${this.calculateTotalChange(data1, data2)}</div>
                        <div class="summary-description">Tüm metriklerdeki net değişim</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="summary-content">
                        <h4>En Büyük Artış</h4>
                        <div class="summary-value positive">${this.findLargestIncrease(data1, data2)}</div>
                        <div class="summary-description">En yüksek büyüme oranı</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="summary-content">
                        <h4>En Büyük Düşüş</h4>
                        <div class="summary-value negative">${this.findLargestDecrease(data1, data2)}</div>
                        <div class="summary-description">En yüksek küçülme oranı</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="summary-content">
                        <h4>Ortalama Değişim</h4>
                        <div class="summary-value">${this.calculateAverageChange(data1, data2)}%</div>
                        <div class="summary-description">Tüm metriklerin ortalaması</div>
                    </div>
                </div>
            </div>
        `;
        
        const firstChild = comparisonResults.firstChild;
        
        if (firstChild) {
            comparisonResults.insertBefore(summarySection, firstChild);
        } else {
            comparisonResults.appendChild(summarySection);
        }
    }

    calculateTotalChange(data1, data2) {
        const metrics = ['uçak_trafiği', 'yolcu_trafiği', 'kargo_trafiği_ton', 'yük_trafiği_ton'];
        let totalChange = 0;
        
        metrics.forEach(metric => {
            const val1 = data1[metric] || 0;
            const val2 = data2[metric] || 0;
            if (val1 > 0) {
                totalChange += (val2 - val1) / val1 * 100;
            }
        });
        
        return (totalChange / metrics.length).toFixed(1) + '%';
    }

    findLargestIncrease(data1, data2) {
        const metrics = [
            { name: 'Uçuş', value1: data1.air?.uçak_trafiği, value2: data2.air?.uçak_trafiği },
            { name: 'Yolcu', value1: data1.passenger?.yolcu_trafiği, value2: data2.passenger?.yolcu_trafiği },
            { name: 'Kargo', value1: data1.cargo?.kargo_trafiği_ton, value2: data2.cargo?.kargo_trafiği_ton },
            { name: 'Yük', value1: data1.freight?.yük_trafiği_ton, value2: data2.freight?.yük_trafiği_ton }
        ];
        
        let maxIncrease = { name: '', rate: -Infinity };
        
        metrics.forEach(metric => {
            if (metric.value1 > 0 && metric.value2) {
                const rate = (metric.value2 - metric.value1) / metric.value1 * 100;
                if (rate > maxIncrease.rate) {
                    maxIncrease = { name: metric.name, rate };
                }
            }
        });
        
        return maxIncrease.name ? `${maxIncrease.name}: +${maxIncrease.rate.toFixed(1)}%` : 'Veri yok';
    }

    findLargestDecrease(data1, data2) {
        const metrics = [
            { name: 'Uçuş', value1: data1.air?.uçak_trafiği, value2: data2.air?.uçak_trafiği },
            { name: 'Yolcu', value1: data1.passenger?.yolcu_trafiği, value2: data2.passenger?.yolcu_trafiği },
            { name: 'Kargo', value1: data1.cargo?.kargo_trafiği_ton, value2: data2.cargo?.kargo_trafiği_ton },
            { name: 'Yük', value1: data1.freight?.yük_trafiği_ton, value2: data2.freight?.yük_trafiği_ton }
        ];
        
        let maxDecrease = { name: '', rate: Infinity };
        
        metrics.forEach(metric => {
            if (metric.value1 > 0 && metric.value2) {
                const rate = (metric.value2 - metric.value1) / metric.value1 * 100;
                if (rate < maxDecrease.rate) {
                    maxDecrease = { name: metric.name, rate };
                }
            }
        });
        
        return maxDecrease.name ? `${maxDecrease.name}: ${maxDecrease.rate.toFixed(1)}%` : 'Veri yok';
    }

    calculateAverageChange(data1, data2) {
        const metrics = [
            data1.air?.uçak_trafiği, data1.passenger?.yolcu_trafiği,
            data1.cargo?.kargo_trafiği_ton, data1.freight?.yük_trafiği_ton
        ];
        
        const changes = metrics.filter(val => val > 0).map(val => {
            const corresponding = [
                data2.air?.uçak_trafiği, data2.passenger?.yolcu_trafiği,
                data2.cargo?.kargo_trafiği_ton, data2.freight?.yük_trafiği_ton
            ][metrics.indexOf(val)];
            
            return corresponding ? (corresponding - val) / val * 100 : 0;
        });
        
        if (changes.length === 0) return '0.0';
        
        const average = changes.reduce((a, b) => a + b, 0) / changes.length;
        return average.toFixed(1);
    }

    initializeAdvancedOptions() {
        const toggleBtn = document.getElementById('toggle-advanced-options');
        const optionsContent = document.getElementById('advanced-options-content');
        
        if (toggleBtn && optionsContent) {
            // Mevcut event listener'ı temizle (çoklu eklemeyi önlemek için)
            toggleBtn.replaceWith(toggleBtn.cloneNode(true));
            const newToggleBtn = document.getElementById('toggle-advanced-options');
            
            newToggleBtn.addEventListener('click', () => {
                newToggleBtn.classList.toggle('active');
                optionsContent.classList.toggle('active');
            });
        }
    }

    enhanceAllYearsMode() {
        // İstatistiksel özet kartlarını ekle
        this.showStatisticalSummary();
        
        // Trend analizlerini göster
        this.showEnhancedTrendAnalysis();
        
        // Yıllık büyüme oranlarını göster
        this.showAnnualGrowthRates();
        
        // Yoğunluk metriklerini ekle
        this.showDensityMetrics();
        
        // Dönemsel karşılaştırmaları göster
        this.showPeriodicComparisons();
        
        // Öngörü analizini göster
        this.showForecastAnalysis();
    }

    showStatisticalSummary() {
        const allYearsMode = document.getElementById('all-years-mode');
        if (!allYearsMode) return;
        
        // Önceki özet kartlarını temizle
        const existingSummary = allYearsMode.querySelector('.stats-summary-cards');
        if (existingSummary) {
            existingSummary.remove();
        }
        
        // İstatistiksel özet kartlarını oluştur
        const summarySection = document.createElement('div');
        summarySection.className = 'stats-summary-cards';
        
        const stats = this.calculateStatisticalSummary();
        
        summarySection.innerHTML = `
            <div class="summary-stat-card animated-card" style="animation-delay: 0.1s">
                <div class="stat-label">
                    <i class="fas fa-chart-line"></i> Toplam Büyüme
                </div>
                <div class="stat-value-large">${stats.totalGrowth}%</div>
                <div class="stat-change ${stats.growthDirection === 'up' ? 'positive' : 'negative'}">
                    ${stats.growthDirection === 'up' ? '↑' : '↓'} ${stats.annualGrowth}% yıllık ortalama
                </div>
            </div>
            
            <div class="summary-stat-card green animated-card" style="animation-delay: 0.2s">
                <div class="stat-label">
                    <i class="fas fa-plane"></i> Toplam Uçuş
                </div>
                <div class="stat-value-large">${this.formatNumber(stats.totalFlights)}</div>
                <div class="stat-change ${stats.flightGrowth > 0 ? 'positive' : 'negative'}">
                    ${stats.flightGrowth > 0 ? '+' : ''}${stats.flightGrowth.toFixed(1)}% son 5 yıl
                </div>
            </div>
            
            <div class="summary-stat-card orange animated-card" style="animation-delay: 0.3s">
                <div class="stat-label">
                    <i class="fas fa-users"></i> Toplam Yolcu
                </div>
                <div class="stat-value-large">${this.formatNumber(stats.totalPassengers)}</div>
                <div class="stat-change ${stats.passengerGrowth > 0 ? 'positive' : 'negative'}">
                    ${stats.passengerGrowth > 0 ? '+' : ''}${stats.passengerGrowth.toFixed(1)}% son 5 yıl
                </div>
            </div>
            
            <div class="summary-stat-card purple animated-card" style="animation-delay: 0.4s">
                <div class="stat-label">
                    <i class="fas fa-box"></i> Toplam Kargo
                </div>
                <div class="stat-value-large">${this.formatNumber(stats.totalCargo)}</div>
                <div class="stat-change ${stats.cargoGrowth > 0 ? 'positive' : 'negative'}">
                    ${stats.cargoGrowth > 0 ? '+' : ''}${stats.cargoGrowth.toFixed(1)}% son 5 yıl
                </div>
            </div>
            
            <div class="summary-stat-card red animated-card" style="animation-delay: 0.5s">
                <div class="stat-label">
                    <i class="fas fa-weight-hanging"></i> Ortalama Artış
                </div>
                <div class="stat-value-large">${stats.averageIncrease}%</div>
                <div class="stat-label">
                    Tüm metrikler için yıllık ortalama
                </div>
            </div>
        `;
        
        // Historical analysis'den sonra ekle
        const historicalSection = allYearsMode.querySelector('.historical-analysis');
        if (historicalSection) {
            historicalSection.after(summarySection);
        }
    }

    calculateStatisticalSummary() {
        const data = this.data.airTraffic;
        if (!data || data.length < 2) return {};
        
        const firstYear = data[0];
        const lastYear = data[data.length - 1];
        
        // Toplam büyüme
        const totalGrowth = ((lastYear.uçak_trafiği - firstYear.uçak_trafiği) / firstYear.uçak_trafiği * 100).toFixed(1);
        const annualGrowth = (totalGrowth / (data.length - 1)).toFixed(1);
        
        // Son 5 yıl büyümeleri
        const flightGrowth = this.calculatePeriodGrowth(data, 'uçak_trafiği', 5);
        const passengerData = this.data.passengerTraffic;
        const passengerGrowth = passengerData ? this.calculatePeriodGrowth(passengerData, 'yolcu_trafiği', 5) : 0;
        const cargoGrowth = this.data.cargoTraffic ? this.calculatePeriodGrowth(this.data.cargoTraffic, 'kargo_trafiği_ton', 5) : 0;
        
        // Toplam değerler
        const totalFlights = data.reduce((sum, year) => sum + year.uçak_trafiği, 0);
        const totalPassengers = passengerData ? passengerData.reduce((sum, year) => sum + year.yolcu_trafiği, 0) : 0;
        const totalCargo = this.data.cargoTraffic ? this.data.cargoTraffic.reduce((sum, year) => sum + year.kargo_trafiği_ton, 0) : 0;
        
        // Ortalama artış
        const yearlyGrowths = [];
        for (let i = 1; i < data.length; i++) {
            const growth = ((data[i].uçak_trafiği - data[i-1].uçak_trafiği) / data[i-1].uçak_trafiği * 100);
            yearlyGrowths.push(growth);
        }
        const averageIncrease = (yearlyGrowths.reduce((a, b) => a + b, 0) / yearlyGrowths.length).toFixed(1);
        
        return {
            totalGrowth,
            annualGrowth,
            flightGrowth,
            passengerGrowth,
            cargoGrowth,
            totalFlights,
            totalPassengers,
            totalCargo,
            averageIncrease,
            growthDirection: parseFloat(totalGrowth) > 0 ? 'up' : 'down'
        };
    }

    calculatePeriodGrowth(data, field, years) {
        if (data.length < years) return 0;
        
        const recent = data.slice(-years);
        const first = recent[0][field];
        const last = recent[recent.length - 1][field];
        
        return first > 0 ? ((last - first) / first * 100) : 0;
    }

    showEnhancedTrendAnalysis() {
        const allYearsMode = document.getElementById('all-years-mode');
        if (!allYearsMode) return;
        
        // Önceki trend analizini temizle
        const existingAnalysis = allYearsMode.querySelector('.trend-analysis-grid');
        if (existingAnalysis) {
            existingAnalysis.remove();
        }
        
        const analysisSection = document.createElement('div');
        analysisSection.className = 'trend-analysis-grid';
        
        const trends = this.calculateEnhancedTrends();
        
        analysisSection.innerHTML = `
            <div class="trend-analysis-card animated-card">
                <div class="trend-analysis-header">
                    <h4>Uzun Vadeli Trend</h4>
                    <span class="trend-indicator ${trends.longTerm.trend}">
                        ${trends.longTerm.trend === 'up' ? '↑' : 
                          trends.longTerm.trend === 'down' ? '↓' : '↔'}
                        ${trends.longTerm.percentage}%
                    </span>
                </div>
                <p>${trends.longTerm.description}</p>
                <div class="trend-details">
                    <div class="trend-stat">
                        <span>Başlangıç:</span>
                        <strong>${this.formatNumber(trends.longTerm.startValue)}</strong>
                    </div>
                    <div class="trend-stat">
                        <span>Bitiş:</span>
                        <strong>${this.formatNumber(trends.longTerm.endValue)}</strong>
                    </div>
                </div>
            </div>
            
            <div class="trend-analysis-card animated-card">
                <div class="trend-analysis-header">
                    <h4>Son 5 Yıl Performansı</h4>
                    <span class="trend-indicator ${trends.recent.trend}">
                        ${trends.recent.trend === 'up' ? '↑' : 
                          trends.recent.trend === 'down' ? '↓' : '↔'}
                        ${trends.recent.percentage}%
                    </span>
                </div>
                <p>${trends.recent.description}</p>
                <div class="trend-details">
                    <div class="trend-stat">
                        <span>Yıllık Ortalama:</span>
                        <strong>${trends.recent.annualAvg}%</strong>
                    </div>
                    <div class="trend-stat">
                        <span>En İyi Yıl:</span>
                        <strong>${trends.recent.bestYear}</strong>
                    </div>
                </div>
            </div>
            
            <div class="trend-analysis-card animated-card">
                <div class="trend-analysis-header">
                    <h4>Mevsimsel Dalgalanma</h4>
                    <span class="trend-indicator ${trends.volatility.level}">
                        ${trends.volatility.level === 'high' ? '' : 
                          trends.volatility.level === 'medium' ? '📊' : '📉'}
                        ${trends.volatility.percentage}%
                    </span>
                </div>
                <p>${trends.volatility.description}</p>
                <div class="trend-details">
                    <div class="trend-stat">
                        <span>En İyi Yıl:</span>
                        <strong>${trends.volatility.bestYear} (${this.formatNumber(trends.volatility.bestValue)})</strong>
                    </div>
                    <div class="trend-stat">
                        <span>En Düşük Yıl:</span>
                        <strong>${trends.volatility.worstYear} (${this.formatNumber(trends.volatility.worstValue)})</strong>
                    </div>
                </div>
            </div>
        `;
        
        const summarySection = allYearsMode.querySelector('.stats-summary-cards');
        if (summarySection) {
            summarySection.after(analysisSection);
        }
    }

    calculateEnhancedTrends() {
        const data = this.data.airTraffic || [];
        if (!data.length) {
            return {
                longTerm: {
                    trend: 'stable',
                    percentage: '0.0',
                    description: 'Veri bulunamadı',
                    startValue: 0,
                    endValue: 0
                },
                recent: {
                    trend: 'stable',
                    percentage: '0.0',
                    description: 'Veri bulunamadı',
                    annualAvg: '0.0',
                    bestYear: '-'
                },
                volatility: {
                    level: 'low',
                    percentage: '0.0',
                    description: 'Veri bulunamadı',
                    bestYear: '-',
                    bestValue: 0,
                    worstYear: '-',
                    worstValue: 0
                }
            };
        }
        
        if (data.length < 2) {
            const only = data[0];
            return {
                longTerm: {
                    trend: 'stable',
                    percentage: '0.0',
                    description: 'Tek yıl verisi mevcut, trend hesaplanamadı',
                    startValue: only.uçak_trafiği || 0,
                    endValue: only.uçak_trafiği || 0
                },
                recent: {
                    trend: 'stable',
                    percentage: '0.0',
                    description: 'Tek yıl verisi mevcut, trend hesaplanamadı',
                    annualAvg: '0.0',
                    bestYear: only.yil
                },
                volatility: {
                    level: 'low',
                    percentage: '0.0',
                    description: 'Tek yıl verisi mevcut, volatilite hesaplanamadı',
                    bestYear: only.yil,
                    bestValue: only.uçak_trafiği || 0,
                    worstYear: only.yil,
                    worstValue: only.uçak_trafiği || 0
                }
            };
        }
        
        const firstYear = data[0];
        const lastYear = data[data.length - 1];
        const longTermGrowth = firstYear.uçak_trafiği > 0
            ? ((lastYear.uçak_trafiği - firstYear.uçak_trafiği) / firstYear.uçak_trafiği * 100)
            : 0;
        
        const windowSize = Math.min(6, data.length);
        const recentYears = data.slice(-windowSize);
        const recentGrowth = this.calculatePeriodGrowth(data, 'uçak_trafiği', Math.min(5, data.length));
        
        const yearlyChanges = [];
        for (let i = 1; i < data.length; i++) {
            const prev = data[i-1].uçak_trafiği;
            const current = data[i].uçak_trafiği;
            if (prev > 0) {
                const change = ((current - prev) / prev * 100);
                yearlyChanges.push(change);
            }
        }
        
        const volatility = yearlyChanges.length
            ? Math.max(...yearlyChanges.map(c => Math.abs(c)))
            : 0;
        
        const validYears = data.filter(y => typeof y.uçak_trafiği === 'number');
        const bestYear = validYears.reduce((max, year) => 
            year.uçak_trafiği > max.uçak_trafiği ? year : max, validYears[0]);
        const worstYear = validYears.reduce((min, year) => 
            year.uçak_trafiği < min.uçak_trafiği ? year : min, validYears[0]);

        const bestRecentObj = recentYears.reduce((max, year) =>
            (typeof year.uçak_trafiği === 'number' && year.uçak_trafiği > max.uçak_trafiği)
                ? year
                : max,
            recentYears[0]
        );
        
        return {
            longTerm: {
                trend: longTermGrowth > 0 ? 'up' : longTermGrowth < 0 ? 'down' : 'stable',
                percentage: Math.abs(longTermGrowth).toFixed(1),
                description: longTermGrowth > 0 ? 
                    'Uzun vadeli sağlam büyüme trendi' : 
                    (longTermGrowth < 0 ? 'Uzun vadeli düşüş eğilimi' : 'Uzun vadede dengeli bir seyir'),
                startValue: firstYear.uçak_trafiği || 0,
                endValue: lastYear.uçak_trafiği || 0
            },
            recent: {
                trend: recentGrowth > 0 ? 'up' : recentGrowth < 0 ? 'down' : 'stable',
                percentage: Math.abs(recentGrowth).toFixed(1),
                description: recentGrowth > 0 ? 
                    'Yakın dönemde hızlanan büyüme' : 
                    (recentGrowth < 0 ? 'Yakın dönemde yavaşlama' : 'Yakın dönemde dengeli bir seyir'),
                annualAvg: (recentGrowth / Math.max(1, Math.min(5, data.length - 1))).toFixed(1),
                bestYear: bestRecentObj?.yil || recentYears[0]?.yil
            },
            volatility: {
                level: volatility > 15 ? 'high' : volatility > 5 ? 'medium' : 'low',
                percentage: volatility.toFixed(1),
                description: volatility > 15 ? 
                    'Yüksek volatilite - ekonomik dalgalanmalardan etkilenmiş' : 
                    (volatility > 5 ? 'Orta seviyede dalgalanma' : 'Düşük volatilite - istikrarlı büyüme'),
                bestYear: bestYear.yil,
                bestValue: bestYear.uçak_trafiği,
                worstYear: worstYear.yil,
                worstValue: worstYear.uçak_trafiği
            }
        };
    }

    showAnnualGrowthRates() {
        const allYearsMode = document.getElementById('all-years-mode');
        if (!allYearsMode) return;
        
        // Önceki growth tablosunu temizle
        const existingGrowth = allYearsMode.querySelector('.growth-table-container');
        if (existingGrowth) {
            existingGrowth.remove();
        }
        
        const growthSection = document.createElement('div');
        growthSection.className = 'growth-table-container';
        
        const growthRates = this.calculateAnnualGrowthRates();
        
        growthSection.innerHTML = `
            <h3>Yıllık Büyüme Oranları (%)</h3>
            <table class="growth-table">
                <thead>
                    <tr>
                        <th>Yıl</th>
                        <th>Uçuş Trafiği</th>
                        <th>Yolcu Trafiği</th>
                        <th>Kargo Trafiği</th>
                        <th>Yük Trafiği</th>
                        <th>Toplam Değişim</th>
                    </tr>
                </thead>
                <tbody>
                    ${growthRates.map(rate => `
                        <tr>
                            <td>${rate.year}</td>
                            <td class="growth-rate-cell ${rate.flight > 0 ? 'positive' : 'negative'}">
                                ${rate.flight > 0 ? '+' : ''}${rate.flight.toFixed(1)}%
                            </td>
                            <td class="growth-rate-cell ${rate.passenger > 0 ? 'positive' : 'negative'}">
                                ${rate.passenger > 0 ? '+' : ''}${rate.passenger.toFixed(1)}%
                            </td>
                            <td class="growth-rate-cell ${rate.cargo > 0 ? 'positive' : 'negative'}">
                                ${rate.cargo > 0 ? '+' : ''}${rate.cargo.toFixed(1)}%
                            </td>
                            <td class="growth-rate-cell ${rate.freight > 0 ? 'positive' : 'negative'}">
                                ${rate.freight > 0 ? '+' : ''}${rate.freight.toFixed(1)}%
                            </td>
                            <td class="growth-rate-cell ${rate.total > 0 ? 'positive' : 'negative'}">
                                ${rate.total > 0 ? '+' : ''}${rate.total.toFixed(1)}%
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        const trendSection = allYearsMode.querySelector('.trend-analysis-grid');
        if (trendSection) {
            trendSection.after(growthSection);
        }
    }

    calculateAnnualGrowthRates() {
        const rates = [];
        
        for (let i = 1; i < this.data.airTraffic.length; i++) {
            const currentYear = this.data.airTraffic[i];
            const prevYear = this.data.airTraffic[i-1];
            
            const flightRate = ((currentYear.uçak_trafiği - prevYear.uçak_trafiği) / prevYear.uçak_trafiği * 100);
            
            const passengerRate = this.data.passengerTraffic && this.data.passengerTraffic[i] && this.data.passengerTraffic[i-1] ?
                ((this.data.passengerTraffic[i].yolcu_trafiği - this.data.passengerTraffic[i-1].yolcu_trafiği) / 
                 this.data.passengerTraffic[i-1].yolcu_trafiği * 100) : 0;
            
            const cargoRate = this.data.cargoTraffic && this.data.cargoTraffic[i] && this.data.cargoTraffic[i-1] ?
                ((this.data.cargoTraffic[i].kargo_trafiği_ton - this.data.cargoTraffic[i-1].kargo_trafiği_ton) / 
                 this.data.cargoTraffic[i-1].kargo_trafiği_ton * 100) : 0;
            
            const freightRate = this.data.freightTraffic && this.data.freightTraffic[i] && this.data.freightTraffic[i-1] ?
                ((this.data.freightTraffic[i].yük_trafiği_ton - this.data.freightTraffic[i-1].yük_trafiği_ton) / 
                 this.data.freightTraffic[i-1].yük_trafiği_ton * 100) : 0;
            
            const totalRate = (flightRate + passengerRate + cargoRate + freightRate) / 4;
            
            rates.push({
                year: currentYear.yil,
                flight: flightRate,
                passenger: passengerRate,
                cargo: cargoRate,
                freight: freightRate,
                total: totalRate
            });
        }
        
        return rates;
    }

    

    showDensityMetrics() {
       /* const allYearsMode = document.getElementById('all-years-mode');
        if (!allYearsMode) return;
        
        // Önceki density metriklerini temizle
        const existingDensity = allYearsMode.querySelector('.density-metrics');
        if (existingDensity) {
            existingDensity.remove();
        }
        
        const densitySection = document.createElement('div');
        densitySection.className = 'density-metrics';
        
        const metrics = this.calculateDensityMetrics();
        
        densitySection.innerHTML = `
            <div class="density-metric animated-card">
                <div class="density-label">Uçuş Başına Yolcu</div>
                <div class="density-value">${metrics.passengersPerFlight.toFixed(1)}</div>
                <div class="density-label">yolcu/uçuş</div>
            </div>
            
            <div class="density-metric animated-card">
                <div class="density-label">Uçuş Başına Kargo</div>
                <div class="density-value">${metrics.cargoPerFlight.toFixed(1)}</div>
                <div class="density-label">kg/uçuş</div>
            </div>
            
            <div class="density-metric animated-card">
                <div class="density-label">Yolcu Başına Gelir</div>
                <div class="density-value">${metrics.revenuePerPassenger.toFixed(1)}</div>
                <div class="density-label">TL/yolcu</div>
            </div>
            
            <div class="density-metric animated-card">
                <div class="density-label">Uçuş Yoğunluğu</div>
                <div class="density-value">${metrics.flightDensity.toFixed(1)}</div>
                <div class="density-label">uçuş/gün</div>
            </div>
        `;
        
        const growthSection = allYearsMode.querySelector('.growth-table-container');
        if (growthSection) {
            growthSection.after(densitySection);
        }*/
    }

    calculateDensityMetrics() {
        const lastYear = this.data.airTraffic[this.data.airTraffic.length - 1];
        const lastYearPassenger = this.data.passengerTraffic ? 
            this.data.passengerTraffic.find(d => d.yil === lastYear.yil) : null;
        const lastYearCargo = this.data.cargoTraffic ? 
            this.data.cargoTraffic.find(d => d.yil === lastYear.yil) : null;
        
        return {
            passengersPerFlight: lastYearPassenger ? 
                lastYearPassenger.yolcu_trafiği / lastYear.uçak_trafiği : 0,
            cargoPerFlight: lastYearCargo ? 
                (lastYearCargo.kargo_trafiği_ton * 1000) / lastYear.uçak_trafiği : 0,
            revenuePerPassenger: 150,
            flightDensity: lastYear.uçak_trafiği / 365
        };
    }

    showPeriodicComparisons() {
        // İleride implemente edilecek
    }

    showForecastAnalysis() {
        // İleride implemente edilecek
    }

    animateElements() {
        // Animasyon fonksiyonu
        const elements = document.querySelectorAll('.animated-card');
        elements.forEach((el, index) => {
            el.style.animationDelay = `${index * 0.1}s`;
            el.classList.add('fade-in-up');
        });
    }
}

// İstatistikleri başlat
let statistics;