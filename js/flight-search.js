// Uçuş Arama ve API Entegrasyonu - Backend ile
class CouponManager {
    constructor() {
        this.coupons = new Map();
        this.loadCoupons();
    }

    async loadCoupons() {
        try {
            const response = await fetch('assets/data/sentetik_iade_biletleri_turkiye.csv');
            const csvText = await response.text();
            this.parseCSV(csvText);
            console.log(` ${this.coupons.size} adet kupon yüklendi`);
        } catch (error) {
            console.warn('Kupon verileri yüklenemedi, kupon özelliği devre dışı:', error);
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n').slice(1); // Başlık satırını atla
        lines.forEach(line => {
            const [pnr_kodu, havayolu, bilet_tutari_tl, iade_edilen_tutar_tl, 
                   iade_tarihi, iptal_nedeni, son_kullanim_tarihi] = line.split(',');
            
            if (pnr_kodu && iade_edilen_tutar_tl) {
                const coupon = {
                    code: pnr_kodu.trim(),
                    airline: havayolu.trim(),
                    originalAmount: parseFloat(bilet_tutari_tl),
                    discountAmount: parseFloat(iade_edilen_tutar_tl),
                    issueDate: iade_tarihi.trim(),
                    reason: iptal_nedeni.trim(),
                    expiryDate: new Date(son_kullanim_tarihi.trim())
                };
                
                this.coupons.set(coupon.code.toUpperCase(), coupon);
            }
        });
    }

    validateCoupon(code) {
        const coupon = this.coupons.get(code.toUpperCase());
        
        if (!coupon) {
            return {
                valid: false,
                message: 'Girdiğiniz kupon kodu geçersizdir.'
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (coupon.expiryDate < today) {
            return {
                valid: false,
                message: 'Kupon kodunuzun süresi dolmuştur.'
            };
        }

        return {
            valid: true,
            coupon: coupon
        };
    }

    applyCouponToFlights(flights, coupon, searchParams) {
        // 1. Öncelikle kuponun havayoluna ait uçuşları filtrele
        const airlineFlights = flights.filter(flight => {
            const itinerary = flight.itineraries[0];
            return itinerary.segments.some(segment => 
                this.isMatchingAirline(segment.airline, coupon.airline)
            );
        });

        // 2. Havayoluna ait uçuşlar varsa, onlara indirim uygula
        if (airlineFlights.length > 0) {
            const discountedFlights = airlineFlights.map(flight => {
                return {
                    ...flight,
                    price: this.calculateDiscountedPrice(flight.price, coupon.discountAmount),
                    originalPrice: flight.price, // Orijinal fiyatı sakla
                    couponApplied: true,
                    couponCode: coupon.code,
                    discountAmount: coupon.discountAmount,
                    couponAirline: coupon.airline
                };
            });

            // 3. Diğer havayolu uçuşlarını (indirimsiz) ekle
            const otherFlights = flights.filter(flight => 
                !airlineFlights.some(f => f.id === flight.id)
            ).map(flight => ({
                ...flight,
                couponApplied: false
            }));

            return [...discountedFlights, ...otherFlights];
        } else {
            // Havayoluna ait uçuş yoksa
            return flights.map(flight => ({
                ...flight,
                couponApplied: false,
                couponWarning: `Kuponunuz bağlı olduğu ${coupon.airline} havayolu şirketinin bu rota için uçuşu bulunmamaktadır.`
            }));
        }
    }

    isMatchingAirline(segmentAirline, couponAirline) {
        // Havayolu eşleştirme mantığı
        const airlineMap = {
            'Ajet': ['AJ', 'VF', 'Ajet'],
            'AnadoluJet': ['AJ', 'AnadoluJet', 'TK-AnadoluJet'],
            'Pegasus': ['PC', 'Pegasus'],
            'SunExpress': ['XQ', 'SunExpress'],
            'Turkish Airlines': ['TK', 'Turkish Airlines']
        };

        const couponAirlineKey = Object.keys(airlineMap).find(key => 
            key.toLowerCase().includes(couponAirline.toLowerCase()) || 
            couponAirline.toLowerCase().includes(key.toLowerCase())
        );

        if (couponAirlineKey) {
            const possibleCodes = airlineMap[couponAirlineKey];
            return possibleCodes.some(code => 
                segmentAirline && segmentAirline.toString().toLowerCase().includes(code.toLowerCase())
            );
        }

        return segmentAirline && segmentAirline.toString().toLowerCase().includes(couponAirline.toLowerCase());
    }

    calculateDiscountedPrice(originalPrice, discountAmount) {
        const newPrice = originalPrice - discountAmount;
        return Math.max(newPrice, 0); // Fiyat negatif olamaz
    }

    getCouponStatusMessage(flights) {
        const couponAppliedFlights = flights.filter(f => f.couponApplied);
        const couponWarningFlights = flights.filter(f => f.couponWarning);
        
        if (couponAppliedFlights.length > 0) {
            const coupon = couponAppliedFlights[0];
            return `<i class="fa-solid fa-check" style="color: #63E6BE;"></i> Kupon kodu uygulandı! ${coupon.couponAirline} uçuşlarında ${coupon.discountAmount} TL indirim.`;
        } else if (couponWarningFlights.length > 0) {
            return couponWarningFlights[0].couponWarning;
        }
        
        return null;
    }
}


class FlightSearch {
    constructor() {
        this.backendUrl = 'http://localhost:5000/api';
        this.couponManager = new CouponManager();
        this.airlineDict = {
            "TK": "Türk Hava Yolları",
            "PC": "Pegasus",
            "XQ": "SunExpress",
            "AJ": "AnadoluJet",
            "VF": "Ajet",
            "8Q": "Onur Air",
            "W5": "Mahan Air",
            "FH": "Freebird Airlines"
        };
    }

    // Havalimanı listesini doldur
    populateAirportSelects() {
        const originSelect = document.getElementById('origin');
        const destinationSelect = document.getElementById('destination');
        
        // Select'leri temizle
        originSelect.innerHTML = '<option value="">Seçiniz</option>';
        destinationSelect.innerHTML = '<option value="">Seçiniz</option>';
        
        const airports = window.flightNetwork.airportData;
        
        airports.forEach(airport => {
            const option = document.createElement('option');
            option.value = airport.iata;
            option.textContent = `${airport.city} (${airport.iata})`;
            
            originSelect.appendChild(option.cloneNode(true));
            destinationSelect.appendChild(option.cloneNode(true));
        });

        // Tarih input'una bugünün tarihini varsayılan olarak ayarla
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('departure-date').value = today;
    }


async searchFlights(searchParams) {
        try {
            const queryParams = new URLSearchParams({
                origin: searchParams.origin,
                destination: searchParams.destination,
                departureDate: searchParams.departureDate,
                adults: searchParams.adults || 1,
                travelClass: searchParams.cabinClass || 'ECONOMY'
            });

            const response = await fetch(`${this.backendUrl}/flights?${queryParams}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Backend hatası: ${response.status}`);
            }

            const data = await response.json();
            let processedFlights = this.processFlightData(data);
            
            // Kupon kodu varsa uygula
            if (searchParams.couponCode && searchParams.couponCode.trim() !== '') {
                processedFlights = this.applyCouponCode(processedFlights, searchParams.couponCode);
            }
            
            // Business sınıfı kontrolü
            if (processedFlights.length === 0 && searchParams.cabinClass === 'BUSINESS') {
                return {
                    flights: [],
                    cabinClassWarning: 'BUSINESS',
                    message: 'Seçilen tarihte BUSINESS sınıfında uçuş bulunamadı.'
                };
            }
            
            return {
                flights: processedFlights,
                cabinClass: searchParams.cabinClass,
                couponStatus: this.couponManager.getCouponStatusMessage(processedFlights)
            };
            
        } catch (error) {
            console.error('Uçuş arama hatası:', error);
            throw error;
        }
    }

    applyCouponCode(flights, couponCode) {
        const validation = this.couponManager.validateCoupon(couponCode);
        
        if (!validation.valid) {
            // Kupon geçersizse hata mesajı ekle
            return flights.map(flight => ({
                ...flight,
                couponError: validation.message
            }));
        }
        
        // Kupon geçerliyse uçuşlara uygula
        return this.couponManager.applyCouponToFlights(flights, validation.coupon);
    }

    // Backend sağlık kontrolü
    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.backendUrl}/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // API verilerini işle
    processFlightData(apiData) {
        const flights = [];
        
        for (const offer of apiData.data || []) {

        const originalPrice = parseFloat(offer.price.total);
        const dividedPrice = originalPrice / 10;
        const formattedPrice = parseFloat(dividedPrice.toFixed(2));

            const flight = {
                id: offer.id,
                price: formattedPrice, 
                currency: offer.price.currency,
                itineraries: []
            };

            for (const itinerary of offer.itineraries) {
                const segments = itinerary.segments.map(segment => ({
                    departure: {
                        airport: segment.departure.iataCode,
                        time: new Date(segment.departure.at),
                        terminal: segment.departure.terminal
                    },
                    arrival: {
                        airport: segment.arrival.iataCode,
                        time: new Date(segment.arrival.at),
                        terminal: segment.arrival.terminal
                    },
                    carrier: segment.carrierCode,
                    flightNumber: segment.number,
                    duration: segment.duration,
                    airline: this.airlineDict[segment.carrierCode] || segment.carrierCode
                }));

                const itineraryData = {
                    duration: itinerary.duration,
                    segments: segments,
                    transferCount: segments.length - 1,
                    isDirect: segments.length === 1,
                    transferPoints: segments.slice(0, -1).map(seg => seg.arrival.airport)
                };

                flight.itineraries.push(itineraryData);
            }

            flights.push(flight);
        }

        this.saveResultsToFile(flights);
        return flights;
    }

    // Sonuçları JSON dosyası olarak kaydet
    saveResultsToFile(flights) {
        const dataStr = JSON.stringify(flights, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        // Download linki oluştur
        const downloadLink = document.getElementById('download-results');
        if (downloadLink) {
            downloadLink.href = URL.createObjectURL(dataBlob);
            downloadLink.download = `flight_results_${new Date().toISOString().split('T')[0]}.json`;
            downloadLink.style.display = 'inline-flex';
        }
    }

    // Süreyi formatla
    formatDuration(durationStr) {
        const matches = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        const hours = parseInt(matches[1] || 0);
        const minutes = parseInt(matches[2] || 0);
        return `${hours}h ${minutes}m`;
    }

    showError(message) {
        alert(`${message}`);
    }
}