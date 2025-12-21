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
validateCouponForFlight(couponCode, flight, searchParams = null) {
    // 1. Temel doğrulama
    const basicValidation = this.validateCoupon(couponCode);
    if (!basicValidation.valid) {
        return {
            valid: false,
            message: basicValidation.message,
            coupon: null
        };
    }

    const coupon = basicValidation.coupon;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. Tarih kontrolü (kupon geçerlilik tarihi vs uçuş tarihi)
    if (searchParams && searchParams.departureDate) {
        const departureDate = new Date(searchParams.departureDate);
        departureDate.setHours(0, 0, 0, 0);
        
        if (coupon.expiryDate < departureDate) {
            return {
                valid: false,
                message: 'Kupon kodunuzun süresi seçilen uçuş tarihinden önce dolmuştur.',
                coupon: null
            };
        }
    }

    // 3. Havayolu uyumluluğu kontrolü
    if (!this.isFlightCompatibleWithCoupon(flight, coupon)) {
        return {
            valid: false,
            message: `Seçilen uçuş ${coupon.airline} havayolu ile uyumlu değil. Kupon uygulanamaz.`,
            coupon: null
        };
    }

    // 4. Kupon hala geçerli mi? (son kullanım tarihi)
    if (coupon.expiryDate < today) {
        return {
            valid: false,
            message: 'Kupon kodunuzun süresi dolmuştur.',
            coupon: null
        };
    }

    return {
        valid: true,
        message: `Kupon geçerli! ${coupon.airline} havayolu için ${coupon.discountAmount} TL indirim uygulanacak.`,
        coupon: coupon
    };
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
isFlightCompatibleWithCoupon(flight, coupon) {
    const itinerary = flight.itineraries[0];
    
    // Uçuşun tüm segmentlerini kontrol et
    const hasMatchingAirline = itinerary.segments.some(segment => 
        this.isMatchingAirline(segment.airline, coupon.airline)
    );
    
    return hasMatchingAirline;
}
validateCouponForPDF(coupon, flight, searchParams) {
    try {
        // Havayolu uyumluluğu
        const isCompatible = this.couponManager.isFlightCompatibleWithCoupon(flight, coupon);
        if (!isCompatible) {
            return {
                valid: false,
                message: 'PDF için: Havayolu uyumsuzluğu'
            };
        }
        
        // Tarih kontrolleri
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (coupon.expiryDate < today) {
            return {
                valid: false,
                message: 'PDF için: Kupon süresi dolmuş'
            };
        }
        
        if (searchParams.departureDate) {
            const departureDate = new Date(searchParams.departureDate);
            departureDate.setHours(0, 0, 0, 0);
            
            if (coupon.expiryDate < departureDate) {
                return {
                    valid: false,
                    message: 'PDF için: Uçuş tarihi uyumsuz'
                };
            }
        }
        
        return {
            valid: true,
            message: 'PDF için kupon geçerli'
        };
        
    } catch (error) {
        console.error('PDF kupon doğrulama hatası:', error);
        return {
            valid: false,
            message: 'PDF için: Doğrulama hatası'
        };
    }
}
// Kuponlu uçuşu fiyatlandır
applyCouponToSingleFlight(flight, coupon) {
    if (!this.isFlightCompatibleWithCoupon(flight, coupon)) {
        return {
            ...flight,
            couponApplied: false,
            couponError: `Bu uçuş ${coupon.airline} havayolu ile uyumlu değil.`
        };
    }

    const discountedPrice = this.calculateDiscountedPrice(flight.price, coupon.discountAmount);
    
    return {
        ...flight,
        price: discountedPrice,
        originalPrice: flight.price,
        couponApplied: true,
        couponCode: coupon.code,
        discountAmount: coupon.discountAmount,
        couponAirline: coupon.airline
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
// flight-search.js içinde generateTicketPDF fonksiyonunu güncelleyin
generateTicketPDF(flight, passengerInfo = null, options = {}) {
    try {
        // E-ticket verilerini hazırla (searchParams ile)
        const ticketData = this.prepareTicketData(flight, passengerInfo, options.searchParams || {});
        
        // Ticket.html şablonunu al
        const template = this.getTicketTemplate();
        
        // Şablonu doldur
        const filledTemplate = this.fillTicketTemplate(template, ticketData);
        
        // PDF olarak indir
        this.downloadPDF(filledTemplate, ticketData);
        
        // Yeni sekmede aç (isteğe bağlı)
        if (options.openInNewTab !== false) {
            this.openTicketPreview(filledTemplate, ticketData);
        }
        
        return true;
    } catch (error) {
        console.error('PDF oluşturma hatası:', error);
        return false;
    }
}

// flight-search.js - prepareTicketData fonksiyonunu güncelleyin
prepareTicketData(flight, passengerInfo, searchParams = null) {
    const itinerary = flight.itineraries[0];
    const firstSegment = itinerary.segments[0];
    const lastSegment = itinerary.segments[itinerary.segments.length - 1];
    
    // Kupon bilgilerini kontrol et
    const hasCoupon = flight.couponApplied || false;
    const couponCode = flight.couponCode || '';
    const couponDiscount = flight.discountAmount || 0;
    const couponAirline = flight.couponAirline || '';
    
    // Fiyat hesaplamaları
    const originalPrice = flight.originalPrice || flight.price;
    const finalPrice = flight.price;
    const discountAmount = originalPrice - finalPrice;
    
    // Fiyatları formatla (iki ondalık haneli)
    const formattedOriginalPrice = originalPrice.toFixed(2);
    const formattedFinalPrice = finalPrice.toFixed(2);
    const formattedDiscount = discountAmount.toFixed(2);
    
    // Yolcu bilgileri - artık parametre olarak geliyor
    const passengerName = passengerInfo?.name || "YOLCU ADI SOYADI";
    const passengerSurname = passengerInfo?.surname || "";
    const passengerEmail = passengerInfo?.email || "";
    const passengerPhone = passengerInfo?.phone || "";
    
    // Tam adı oluştur
    const fullName = passengerName && passengerSurname 
        ? `${passengerName} ${passengerSurname}`
        : passengerName || "YOLCU ADI SOYADI";

    // Aktarmalı uçuş için ekstra bilgiler
    let transferInfo = {};
    let secondAirlineInfo = {};
    
    // Kabin sınıfı bilgisi - searchParams'tan al veya flight'tan al
    let cabinClass = "Economy"; // Varsayılan
    if (searchParams && searchParams.cabinClass) {
        cabinClass = searchParams.cabinClass === 'ECONOMY' ? 'Ekonomi' : 'Business';
    } else if (flight.cabinClass) {
        cabinClass = flight.cabinClass === 'ECONOMY' ? 'Ekonomi' : 'Business';
    }
    
    if (itinerary.segments.length > 1) {
        const transferSegment = itinerary.segments[0];
        const secondSegment = itinerary.segments[1];
        
        transferInfo = {
            transferCity: window.flightNetwork.airportCoords[transferSegment.arrival.airport]?.city || transferSegment.arrival.airport,
            transferCode: transferSegment.arrival.airport,
            transferAirport: window.flightNetwork.airportCoords[transferSegment.arrival.airport]?.name || transferSegment.arrival.airport,
            transferTerminal: transferSegment.arrival.terminal || "Bilgi Yok",
            transferArrivalTime: new Date(transferSegment.arrival.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            transferDepartureTime: secondSegment ? new Date(secondSegment.departure.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : "",
            transferWaitTime: this.calculateWaitTime(transferSegment.arrival.time, secondSegment?.departure.time),
            transferFlightCode2: secondSegment?.flightNumber || "Bilgi Yok",
            transferFlightDuration2: secondSegment?.duration ? this.formatDurationForTicket(secondSegment.duration) : "Bilgi Yok"
        };
        
        // İkinci segment havayolu bilgisi
        if (secondSegment) {
            secondAirlineInfo = {
                airlineName2: secondSegment.airline || "Bilgi Yok",
                airlineCode2: secondSegment.carrier || "Bilgi Yok"
            };
        }
    }

    return {
        // Yolcu bilgileri - GÜNCELLENDİ
        passengerName: fullName,
        passengerFirstName: passengerName,
        passengerLastName: passengerSurname,
        passengerEmail: passengerEmail,
        passengerPhone: passengerPhone,
        
        // Ana rota bilgileri
        fromCity: window.flightNetwork.airportCoords[firstSegment.departure.airport]?.city || firstSegment.departure.airport,
        fromCode: firstSegment.departure.airport,
        fromAirport: window.flightNetwork.airportCoords[firstSegment.departure.airport]?.name || firstSegment.departure.airport,
        fromTerminal: firstSegment.departure.terminal || "Bilgi Yok",
        
        toCity: window.flightNetwork.airportCoords[lastSegment.arrival.airport]?.city || lastSegment.arrival.airport,
        toCode: lastSegment.arrival.airport,
        toAirport: window.flightNetwork.airportCoords[lastSegment.arrival.airport]?.name || lastSegment.arrival.airport,
        toTerminal: lastSegment.arrival.terminal || "Bilgi Yok",
        
        // Uçuş bilgileri
        departureDate: new Date(firstSegment.departure.time).toLocaleDateString('tr-TR', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }),
        arrivalDate: new Date(lastSegment.arrival.time).toLocaleDateString('tr-TR', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }),
        departureTime: new Date(firstSegment.departure.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        arrivalTime: new Date(lastSegment.arrival.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        totalDuration: this.formatDurationForTicket(itinerary.duration),
        
        // Havayolu bilgileri
        airlineName: firstSegment.airline || "Bilgi Yok",
        airlineCode: firstSegment.carrier || "Bilgi Yok",
        flightNumber: firstSegment.flightNumber || "Bilgi Yok",
        ...secondAirlineInfo, // Aktarma varsa havayolu bilgisi
        
        // Sınıf bilgisi
        cabinClass: cabinClass,
        flightType: itinerary.isDirect ? "Direkt" : "Aktarmalı",
        
        // Aktarma bilgileri (eğer varsa)
        ...transferInfo,
        
        // Kupon bilgileri
        hasCoupon: hasCoupon,
        couponCode: couponCode,
        couponDiscount: formattedDiscount,
        couponAirline: couponAirline,
        originalPrice: formattedOriginalPrice,
        finalPrice: formattedFinalPrice,
        
        // Ücret bilgisi
        price: `${formattedFinalPrice} ${flight.currency}`,
        totalPrice: `${formattedFinalPrice} ${flight.currency}`,
        
        // PNR (rezervasyon) numarası
        pnr: this.generatePNR(),
        
        // Segment süreleri
        flightDuration1: this.formatDurationForTicket(firstSegment.duration),
        flightDuration2: itinerary.segments.length > 1 ? this.formatDurationForTicket(itinerary.segments[1].duration) : "Bilgi Yok",
        
        // Koltuk numarası (varsayılan)
        seatNumber: passengerInfo?.seat || "A001",
        
        // Para birimi
        currency: flight.currency || "TL"
    };
}
    // Ticket.html şablonunu al
   getTicketTemplate() {
        return this.loadTemplateFile('templates/ticket.html');
    }

    // Template yükleme fonksiyonu
    loadTemplateFile(templatePath) {
        try {
            // XMLHttpRequest ile senkron okuma
            const xhr = new XMLHttpRequest();
            xhr.open('GET', templatePath, false);
            xhr.send(null);
            
            if (xhr.status === 200) {
                return xhr.responseText;
            } else {
                console.warn(`Şablon dosyası yüklenemedi: ${templatePath}`);
                return this.getDefaultTemplate();
            }
        } catch (error) {
            console.error('Şablon yükleme hatası:', error);
            return this.getDefaultTemplate();
        }
    }
    getDefaultTemplate() {
        const currentYear = new Date().getFullYear();
        return `<!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>E-Bilet - Türkiye Uçuş Ağı</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .ticket { border: 1px solid #ccc; padding: 20px; max-width: 800px; margin: 0 auto; border-radius: 10px; }
            .header { background: #1a237e; color: white; padding: 20px; border-radius: 10px 10px 0 0; }
            .content { padding: 20px; }
            .footer { background: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; }
        </style>
    </head>
    <body>
        <div class="ticket">
            <div class="header">
                <h1>TÜRKİYE UÇUŞ AĞI - E-Bilet</h1>
                <div>PNR: {{PNR}}</div>
            </div>
            <div class="content">
                <h2>YOLCU: {{PASSENGER_NAME}}</h2>
                <p><strong>Rota:</strong> {{FROM_CODE}} ({{FROM_CITY}}) → {{TO_CODE}} ({{TO_CITY}})</p>
                <p><strong>Tarih & Saat:</strong> {{DEPARTURE_DATE}} {{DEPARTURE_TIME}} - {{ARRIVAL_TIME}}</p>
                <p><strong>Havayolu:</strong> {{AIRLINE_NAME}} | <strong>Uçuş:</strong> {{FLIGHT_NUMBER}}</p>
                <p><strong>Kabin Sınıfı:</strong> {{CABIN_CLASS}} | <strong>Süre:</strong> {{TOTAL_DURATION}}</p>
                <p><strong>Toplam Tutar:</strong> {{PRICE}}</p>
            </div>
            <div class="footer">
                © ${currentYear} Türkiye Uçuş Ağı<br>
                Elektronik Bilet - Geçerli Seyahat Belgesi
            </div>
        </div>
    </body>
    </html>`;
    }

fillTicketTemplate(template, data) {
    let filledTemplate = template;
    const currentYear = new Date().getFullYear();
    
    // Aktarma kontrolü
    const hasTransfer = data.transferCity && data.transferCity.trim() !== '';
    
    // Kupon kontrolü
    const hasCoupon = data.hasCoupon || false;
    
    // Tüm değişkenleri değiştir
    const replacements = {
        // Yolcu bilgileri - YENİ EKLENDİ
        '{{PASSENGER_NAME}}': data.passengerName,
        '{{PASSENGER_FIRST_NAME}}': data.passengerFirstName || '',
        '{{PASSENGER_LAST_NAME}}': data.passengerLastName || '',
        '{{PASSENGER_EMAIL}}': data.passengerEmail || '',
        '{{PASSENGER_PHONE}}': data.passengerPhone || '',
        
        '{{PNR}}': data.pnr,
        '{{FROM_CODE}}': data.fromCode,
        '{{TO_CODE}}': data.toCode,
        '{{FROM_CITY}}': data.fromCity,
        '{{FROM_AIRPORT}}': data.fromAirport,
        '{{FROM_TERMINAL}}': data.fromTerminal,
        '{{TO_CITY}}': data.toCity,
        '{{TO_AIRPORT}}': data.toAirport,
        '{{TO_TERMINAL}}': data.toTerminal,
        '{{DEPARTURE_DATE}}': data.departureDate,
        '{{ARRIVAL_DATE}}': data.arrivalDate,
        '{{DEPARTURE_TIME}}': data.departureTime,
        '{{ARRIVAL_TIME}}': data.arrivalTime,
        '{{TOTAL_DURATION}}': data.totalDuration,
        '{{AIRLINE_NAME}}': data.airlineName,
        '{{AIRLINE_NAME_2}}': data.airlineName2 || data.airlineName,
        '{{AIRLINE_CODE}}': data.airlineCode,
        '{{AIRLINE_CODE_2}}': data.airlineCode2 || data.airlineCode,
        '{{CABIN_CLASS}}': data.cabinClass,
        '{{FLIGHT_NUMBER}}': data.flightNumber,
        '{{FLIGHT_NUMBER_2}}': data.flightNumber2 || data.flightNumber,
        '{{FLIGHT_DURATION_1}}': data.flightDuration1,
        '{{FLIGHT_DURATION_2}}': data.flightDuration2 || '',
        '{{TRANSFER_CITY}}': data.transferCity || '',
        '{{TRANSFER_CODE}}': data.transferCode || '',
        '{{TRANSFER_AIRPORT}}': data.transferAirport || '',
        '{{TRANSFER_TERMINAL}}': data.transferTerminal || '',
        '{{TRANSFER_ARRIVAL_TIME}}': data.transferArrivalTime || '',
        '{{TRANSFER_DEPARTURE_TIME}}': data.transferDepartureTime || '',
        '{{TRANSFER_WAIT_TIME}}': data.transferWaitTime || '',
        '{{PRICE}}': data.finalPrice || data.price,
        '{{ORIGINAL_PRICE}}': data.originalPrice || data.finalPrice || data.price,
        '{{FINAL_PRICE}}': data.finalPrice || data.price,
        '{{COUPON_CODE}}': data.couponCode || '',
        '{{COUPON_DISCOUNT}}': data.couponDiscount || '0.00',
        '{{COUPON_AIRLINE}}': data.couponAirline || '',
        '{{TOTAL_PRICE}}': data.totalPrice,
        '{{SEAT_NUMBER}}': data.seatNumber || 'A001',
        '{{CURRENCY}}': data.currency || 'TL',
        '{{CURRENT_YEAR}}': currentYear
    };

    // 1. Önce basit değişken değiştirme
    for (const [key, value] of Object.entries(replacements)) {
        filledTemplate = filledTemplate.replace(new RegExp(key, 'g'), value);
    }

    // 2. Koşullu blokları işle
    filledTemplate = this.processTemplateConditions(filledTemplate, hasTransfer, hasCoupon);
    
    // 3. Kalan {{#if}} ve {{/if}} tag'lerini temizle (güvenlik için)
    filledTemplate = filledTemplate.replace(/\{\{#if.*?\}\}/g, '');
    filledTemplate = filledTemplate.replace(/\{\{\/if\}\}/g, '');
    
    return filledTemplate;
}

    // Template koşullarını işleyen yardımcı fonksiyon
    processTemplateConditions(template, hasTransfer, hasCoupon) {
        let result = template;
        
        // HAS_TRANSFER bloklarını işle
        result = this.processConditionBlock(result, 'HAS_TRANSFER', hasTransfer);
        
        // HAS_COUPON bloklarını işle
        result = this.processConditionBlock(result, 'HAS_COUPON', hasCoupon);
        
        return result;
    }

// Tek bir koşul bloğunu işleyen fonksiyon
processConditionBlock(template, conditionName, conditionValue) {
    const ifPattern = new RegExp(`\\{\\{#if ${conditionName}\\}\\}([\\s\\S]*?)\\{\\{/if\\}\\}`, 'g');
    
    return template.replace(ifPattern, (match, content) => {
        return conditionValue ? content : '';
    });
}

    // PDF olarak indir
    downloadTicketAsPDF(filledTemplate, ticketData) {
        try {
            // Yeni pencere aç ve HTML içeriğini yükle
            const printWindow = window.open('', '_blank');
            printWindow.document.write(filledTemplate);
            printWindow.document.close();
            
            // Yazdırma dialogunu aç (PDF olarak kaydet seçeneği ile)
            printWindow.focus();
            
            // Kısa bir gecikme ile yazdırma dialogunu aç
            setTimeout(() => {
                printWindow.print();
                
                // Otomatik kapatma (isteğe bağlı)
                setTimeout(() => {
                    printWindow.close();
                }, 1000);
            }, 500);
            
        } catch (error) {
            console.error('PDF indirme hatası:', error);
            
            // Alternatif: HTML dosyası olarak indir
            this.downloadAsHTML(filledTemplate, ticketData);
        }
    }

downloadPDF(filledTemplate, ticketData) {
    try {
        // HTML'den PDF oluşturmak için jsPDF ve html2canvas kullan
        this.generatePDFWithJSPDF(filledTemplate, ticketData);
        
    } catch (error) {
        console.error('PDF indirme hatası:', error);
        // Fallback: HTML olarak indir
        this.downloadAsHTML(filledTemplate, ticketData);
    }
}
async generatePDFWithJSPDF(htmlContent, ticketData) {
    try {
        // PDF oluşturma sırasında sayfayı dondur
        const body = document.body;
        const navbar = document.querySelector('.navbar');
        
        if (body) body.classList.add('pdf-generating');
        if (navbar) navbar.classList.add('pdf-generating');
        
        // jsPDF ve html2canvas kütüphanelerini dinamik olarak yükle
        await this.loadPDFLibraries();
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        // HTML'i canvas'a çevir - daha izole bir ortam kullan
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        element.style.width = '210mm';
        element.style.position = 'fixed';
        element.style.left = '-9999px';
        element.style.top = '0';
        element.style.background = 'white';
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        element.style.zIndex = '-1';
        document.body.appendChild(element);
        
        // Kısa bir bekleme ekle ki element tam yüklensin
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight
        });
        
        document.body.removeChild(element);
        
        // PDF oluşturma class'larını kaldır
        if (body) body.classList.remove('pdf-generating');
        if (navbar) navbar.classList.remove('pdf-generating');
        
        // Canvas'ı PDF'e ekle
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 genişliği mm
        const pageHeight = 297; // A4 yüksekliği mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Eğer resim sayfadan büyükse birden fazla sayfaya böl
        let heightLeft = imgHeight;
        let position = 0;
        let page = 1;
        
        while (heightLeft > 0) {
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            
            if (heightLeft > 0) {
                position -= pageHeight;
                pdf.addPage();
                page++;
            }
        }
        
        // PDF'i indir
        pdf.save(`E-Bilet_${ticketData.pnr}_${new Date().getTime()}.pdf`);
        
        // Başarı mesajı göster
        this.showPDFSuccessMessage();
        
    } catch (error) {
        console.error('jsPDF ile PDF oluşturma hatası:', error);
        
        // Hata durumunda da class'ları kaldır
        const body = document.body;
        const navbar = document.querySelector('.navbar');
        if (body) body.classList.remove('pdf-generating');
        if (navbar) navbar.classList.remove('pdf-generating');
        
        // Fallback: HTML olarak indir
        this.downloadAsHTML(htmlContent, ticketData);
        this.showPDFErrorMessage();
    }
}

loadPDFLibraries() {
    return new Promise((resolve, reject) => {
        // jsPDF yüklü mü kontrol et
        if (typeof window.jspdf !== 'undefined' && typeof window.html2canvas !== 'undefined') {
            resolve();
            return;
        }
        
        // Kütüphaneleri yükle
        const libraries = [
            'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
        ];
        
        let loadedCount = 0;
        
        libraries.forEach((url, index) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            
            script.onload = () => {
                loadedCount++;
                if (loadedCount === libraries.length) {
                    setTimeout(resolve, 100); // Kütüphanelerin tam yüklenmesini bekle
                }
            };
            
            script.onerror = () => {
                reject(new Error(`${url} yüklenemedi`));
            };
            
            document.head.appendChild(script);
        });
    });
}

showPDFSuccessMessage() {
    const notification = document.createElement('div');
    notification.className = 'pdf-notification success';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-check-circle" style="color: #10b981; margin-right: 10px;"></i>
            <span>E-Bilet PDF olarak başarıyla indirildi!</span>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        border-left: 4px solid #10b981;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-family: 'Segoe UI', sans-serif;
    `;
    
    document.body.appendChild(notification);
    
    // 3 saniye sonra kaldır
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Hata mesajı
showPDFErrorMessage() {
    const notification = document.createElement('div');
    notification.className = 'pdf-notification error';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-exclamation-triangle" style="color: #ef4444; margin-right: 10px;"></i>
            <span>PDF oluşturulamadı. HTML formatında indirildi.</span>
        </div>
    `;
    
    notification.style.cssText = `
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
        font-family: 'Segoe UI', sans-serif;
    `;
    
    document.body.appendChild(notification);
    
    // 3 saniye sonra kaldır
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// HTML olarak indir (fallback)
downloadAsHTML(htmlContent, ticketData) {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `E-Bilet_${ticketData.pnr}.html`;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    
    // Temizlik
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}


openTicketPreview(filledTemplate, ticketData) {
    try {
        const cleanHTML = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-Bilet - ${ticketData.pnr}</title>
    <style>
        /* Normal sayfa stil - scroll serbest */
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: auto;
            overflow-x: hidden; /* Sadece yatay scroll'u engelle */
        }
        
        body {
            background: #f5f5f5;
            font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif;
            padding: 30px 0; /* Sadece üstten ve alttan 30px boşluk */
            min-height: 100vh;
            box-sizing: border-box;
        }
        
        /* Ticket container'ı - orijinal halinde, iç scroll yok */
        .ticket-container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            /* İÇ SCROLL YOK - overflow kaldırıldı */
            overflow: visible;
        }
        
        /* Ticket içindeki tüm container'ların scroll'unu kaldır */
        .ticket-container * {
            overflow: visible !important;
            max-height: none !important;
        }
        
        /* Yazdırma için */
        @media print {
            html, body {
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
            }
            
            .ticket-container {
                box-shadow: none !important;
                border-radius: 0 !important;
                margin: 0 auto !important;
            }
            
            .no-print {
                display: none !important;
            }
        }
    </style>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    ${filledTemplate}
    
    
    <script>
        // Sayfa yüklendiğinde tüm iç scroll'ları kaldır
        window.addEventListener('load', function() {
            // Ticket container ve tüm child elementlerinin scroll'unu kaldır
            const ticketContainer = document.querySelector('.ticket-container');
            if (ticketContainer) {
                // Container'ın scroll'unu kaldır
                ticketContainer.style.overflow = 'visible';
                ticketContainer.style.maxHeight = 'none';
                
                // Tüm child elementlerin scroll'unu kaldır
                const allElements = ticketContainer.querySelectorAll('*');
                allElements.forEach(el => {
                    el.style.overflow = 'visible';
                    el.style.maxHeight = 'none';
                });
            }
            
            // Sayfanın başına dön
            window.scrollTo(0, 0);
        });
    </script>
</body>
</html>`;
        
        const newTab = window.open('', '_blank');
        newTab.document.open();
        newTab.document.write(cleanHTML);
        newTab.document.close();
        newTab.focus();
        
    } catch (error) {
        console.error('Önizleme açma hatası:', error);
        const newTab = window.open('', '_blank');
        newTab.document.write(filledTemplate);
        newTab.document.close();
    }
}

// Basit önizleme (fallback)
openSimplePreview(filledTemplate) {
    const newTab = window.open('', '_blank');
    newTab.document.write(filledTemplate);
    newTab.document.close();
}

    // Yardımcı fonksiyonlar
    generatePNR() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let pnr = '';
        for (let i = 0; i < 6; i++) {
            pnr += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pnr;
    }

    calculateWaitTime(arrivalTimeStr, departureTimeStr) {
        if (!arrivalTimeStr || !departureTimeStr) return 'Bilgi Yok';
        
        const arrival = new Date(arrivalTimeStr);
        const departure = new Date(departureTimeStr);
        const diffMs = departure - arrival;
        
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0 && minutes > 0) {
            return `${hours}sa ${minutes}dak`;
        } else if (hours > 0) {
            return `${hours}sa`;
        } else {
            return `${minutes}dak`;
        }
    }

    formatDurationForTicket(durationStr) {
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
    }


    generateTicketForPassenger(ticketData) {
    try {
        const { passengerInfo, pnr, order, priceInfo, route, searchParams, routeType, validCoupon } = ticketData;
        
        // 4. AŞAMA: PDF oluşturmadan önce kupon doğrulama
        let finalCoupon = validCoupon;
        
        if (validCoupon) {
            const pdfValidation = this.validateCouponForPDF(validCoupon, route.flight, searchParams);
            
            if (!pdfValidation.valid) {
                console.warn('PDF oluşturma öncesi kupon doğrulama başarısız:', pdfValidation.message);
                finalCoupon = null;
                
                // Fiyat bilgilerini güncelle
                priceInfo.discount = 0;
                priceInfo.net = priceInfo.gross;
            }
        }
        
        // Bilet verilerini hazırla (güncellenmiş kupon bilgisi ile)
        const flight = route.flight;
        const passenger = passengerInfo;
        
        const preparedData = this.prepareTicketDataForPassenger(
            flight, 
            passenger, 
            searchParams, 
            pnr,
            priceInfo,
            passengerInfo.ticketNumber,
            finalCoupon  // Güncellenmiş kupon bilgisi
        );
        
        // Ticket.html şablonunu al
        const template = this.getTicketTemplate();
        
        // Şablonu doldur
        const filledTemplate = this.fillPassengerTicketTemplate(template, preparedData, finalCoupon);
        
        // PDF olarak indir
        const fileName = `E-Bilet_${pnr}_${passenger.ticketNumber}_${passenger.name}_${passenger.surname}.pdf`;
        this.downloadPassengerPDF(filledTemplate, preparedData, fileName);
        
        return true;
    } catch (error) {
        console.error('Yolcu bilet oluşturma hatası:', error);
        return false;
    }
}

// Yolcu için bilet verilerini hazırla
prepareTicketDataForPassenger(flight, passengerInfo, searchParams, pnr, priceInfo, ticketNumber) {
    const itinerary = flight.itineraries[0];
    const firstSegment = itinerary.segments[0];
    const lastSegment = itinerary.segments[itinerary.segments.length - 1];
    
    // Kupon bilgilerini kontrol et
    const hasCoupon = flight.couponApplied || false;
    const couponCode = flight.couponCode || '';
    const couponDiscount = priceInfo.discount || 0;
    const couponAirline = flight.couponAirline || '';
    
    // Kabin sınıfı bilgisi
    let cabinClass = "Economy";
    if (searchParams && searchParams.cabinClass) {
        cabinClass = searchParams.cabinClass === 'ECONOMY' ? 'Ekonomi' : 'Business';
    } else if (flight.cabinClass) {
        cabinClass = flight.cabinClass === 'ECONOMY' ? 'Ekonomi' : 'Business';
    }

    // Aktarmalı uçuş için ekstra bilgiler
    let transferInfo = {};
    let secondAirlineInfo = {};
    
    if (itinerary.segments.length > 1) {
        const transferSegment = itinerary.segments[0];
        const secondSegment = itinerary.segments[1];
        
        transferInfo = {
            transferCity: window.flightNetwork.airportCoords[transferSegment.arrival.airport]?.city || transferSegment.arrival.airport,
            transferCode: transferSegment.arrival.airport,
            transferAirport: window.flightNetwork.airportCoords[transferSegment.arrival.airport]?.name || transferSegment.arrival.airport,
            transferTerminal: transferSegment.arrival.terminal || "Bilgi Yok",
            transferArrivalTime: new Date(transferSegment.arrival.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            transferDepartureTime: secondSegment ? new Date(secondSegment.departure.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : "",
            transferWaitTime: this.calculateWaitTime(transferSegment.arrival.time, secondSegment?.departure.time),
            transferFlightCode2: secondSegment?.flightNumber || "Bilgi Yok",
            transferFlightDuration2: secondSegment?.duration ? this.formatDurationForTicket(secondSegment.duration) : "Bilgi Yok"
        };
        
        // İkinci segment havayolu bilgisi
        if (secondSegment) {
            secondAirlineInfo = {
                airlineName2: secondSegment.airline || "Bilgi Yok",
                airlineCode2: secondSegment.carrier || "Bilgi Yok"
            };
        }
    }

    return {
        // Yolcu bilgileri
        passengerName: `${passengerInfo.name} ${passengerInfo.surname}`,
        passengerFirstName: passengerInfo.name,
        passengerLastName: passengerInfo.surname,
        passengerEmail: passengerInfo.email || '',
        passengerPhone: passengerInfo.phone || '',
        
        // Rezervasyon bilgileri
        pnr: pnr,
        ticketNumber: ticketNumber,
        
        // Ana rota bilgileri
        fromCity: window.flightNetwork.airportCoords[firstSegment.departure.airport]?.city || firstSegment.departure.airport,
        fromCode: firstSegment.departure.airport,
        fromAirport: window.flightNetwork.airportCoords[firstSegment.departure.airport]?.name || firstSegment.departure.airport,
        fromTerminal: firstSegment.departure.terminal || "Bilgi Yok",
        
        toCity: window.flightNetwork.airportCoords[lastSegment.arrival.airport]?.city || lastSegment.arrival.airport,
        toCode: lastSegment.arrival.airport,
        toAirport: window.flightNetwork.airportCoords[lastSegment.arrival.airport]?.name || lastSegment.arrival.airport,
        toTerminal: lastSegment.arrival.terminal || "Bilgi Yok",
        
        // Uçuş bilgileri
        departureDate: new Date(firstSegment.departure.time).toLocaleDateString('tr-TR', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }),
        arrivalDate: new Date(lastSegment.arrival.time).toLocaleDateString('tr-TR', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }),
        departureTime: new Date(firstSegment.departure.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        arrivalTime: new Date(lastSegment.arrival.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        totalDuration: this.formatDurationForTicket(itinerary.duration),
        
        // Havayolu bilgileri
        airlineName: firstSegment.airline || "Bilgi Yok",
        airlineCode: firstSegment.carrier || "Bilgi Yok",
        flightNumber: firstSegment.flightNumber || "Bilgi Yok",
        ...secondAirlineInfo,
        
        // Sınıf bilgisi
        cabinClass: cabinClass,
        flightType: itinerary.isDirect ? "Direkt" : "Aktarmalı",
        
        // Aktarma bilgileri
        ...transferInfo,
        
        // Fiyat bilgileri (yolcu bazlı)
        hasCoupon: hasCoupon,
        couponCode: couponCode,
        couponDiscount: couponDiscount.toFixed(2),
        couponAirline: couponAirline,
        originalPrice: priceInfo.gross.toFixed(2),
        finalPrice: priceInfo.net.toFixed(2),
        
        // Ücret bilgisi
        price: `${priceInfo.net.toFixed(2)} ${flight.currency}`,
        totalPrice: `${priceInfo.net.toFixed(2)} ${flight.currency}`,
        
        // Segment süreleri
        flightDuration1: this.formatDurationForTicket(firstSegment.duration),
        flightDuration2: itinerary.segments.length > 1 ? this.formatDurationForTicket(itinerary.segments[1].duration) : "Bilgi Yok",
        
        // Koltuk numarası (varsayılan)
        seatNumber: this.generateSeatNumber(),
        
        // Para birimi
        currency: flight.currency || "TL",
        
        // Tarih bilgisi
        currentYear: new Date().getFullYear(),
        issueDate: new Date().toLocaleDateString('tr-TR')
    };
}

// Yolcu bilet şablonunu doldur
fillPassengerTicketTemplate(template, data) {
    let filledTemplate = template;
    
    // Aktarma kontrolü
    const hasTransfer = data.transferCity && data.transferCity.trim() !== '';
    
    // Kupon kontrolü
    const hasCoupon = data.hasCoupon || false;
    
    // Tüm değişkenleri değiştir
    const replacements = {
        // Yolcu bilgileri
        '{{PASSENGER_NAME}}': data.passengerName,
        '{{PASSENGER_FIRST_NAME}}': data.passengerFirstName,
        '{{PASSENGER_LAST_NAME}}': data.passengerLastName,
        '{{PASSENGER_EMAIL}}': data.passengerEmail,
        '{{PASSENGER_PHONE}}': data.passengerPhone,
        
        // Rezervasyon bilgileri
        '{{PNR}}': data.pnr,
        '{{TICKET_NUMBER}}': data.ticketNumber,
        
        // Uçuş bilgileri
        '{{FROM_CODE}}': data.fromCode,
        '{{TO_CODE}}': data.toCode,
        '{{FROM_CITY}}': data.fromCity,
        '{{FROM_AIRPORT}}': data.fromAirport,
        '{{FROM_TERMINAL}}': data.fromTerminal,
        '{{TO_CITY}}': data.toCity,
        '{{TO_AIRPORT}}': data.toAirport,
        '{{TO_TERMINAL}}': data.toTerminal,
        '{{DEPARTURE_DATE}}': data.departureDate,
        '{{ARRIVAL_DATE}}': data.arrivalDate,
        '{{DEPARTURE_TIME}}': data.departureTime,
        '{{ARRIVAL_TIME}}': data.arrivalTime,
        '{{TOTAL_DURATION}}': data.totalDuration,
        '{{AIRLINE_NAME}}': data.airlineName,
        '{{AIRLINE_NAME_2}}': data.airlineName2 || data.airlineName,
        '{{AIRLINE_CODE}}': data.airlineCode,
        '{{AIRLINE_CODE_2}}': data.airlineCode2 || data.airlineCode,
        '{{CABIN_CLASS}}': data.cabinClass,
        '{{FLIGHT_NUMBER}}': data.flightNumber,
        '{{FLIGHT_NUMBER_2}}': data.flightNumber2 || data.flightNumber,
        '{{FLIGHT_DURATION_1}}': data.flightDuration1,
        '{{FLIGHT_DURATION_2}}': data.flightDuration2 || '',
        '{{TRANSFER_CITY}}': data.transferCity || '',
        '{{TRANSFER_CODE}}': data.transferCode || '',
        '{{TRANSFER_AIRPORT}}': data.transferAirport || '',
        '{{TRANSFER_TERMINAL}}': data.transferTerminal || '',
        '{{TRANSFER_ARRIVAL_TIME}}': data.transferArrivalTime || '',
        '{{TRANSFER_DEPARTURE_TIME}}': data.transferDepartureTime || '',
        '{{TRANSFER_WAIT_TIME}}': data.transferWaitTime || '',
        '{{PRICE}}': data.finalPrice || data.price,
        '{{ORIGINAL_PRICE}}': data.originalPrice || data.finalPrice || data.price,
        '{{FINAL_PRICE}}': data.finalPrice || data.price,
        '{{COUPON_CODE}}': data.couponCode || '',
        '{{COUPON_DISCOUNT}}': data.couponDiscount || '0.00',
        '{{COUPON_AIRLINE}}': data.couponAirline || '',
        '{{TOTAL_PRICE}}': data.totalPrice,
        '{{SEAT_NUMBER}}': data.seatNumber || 'A001',
        '{{CURRENCY}}': data.currency || 'TL',
        '{{CURRENT_YEAR}}': data.currentYear,
        '{{ISSUE_DATE}}': data.issueDate
    };

    // Değişken değiştirme
    for (const [key, value] of Object.entries(replacements)) {
        filledTemplate = filledTemplate.replace(new RegExp(key, 'g'), value);
    }

    // Koşullu blokları işle
    filledTemplate = this.processTemplateConditions(filledTemplate, hasTransfer, hasCoupon);
    
    // Kalan template tag'lerini temizle
    filledTemplate = filledTemplate.replace(/\{\{#if.*?\}\}/g, '');
    filledTemplate = filledTemplate.replace(/\{\{\/if\}\}/g, '');
    
    return filledTemplate;
}

// Koltuk numarası üret
generateSeatNumber() {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    const row = rows[Math.floor(Math.random() * rows.length)];
    const seat = Math.floor(Math.random() * 30) + 1;
    return `${row}${seat}`;
}

// Yolcu PDF'ini indir
downloadPassengerPDF(filledTemplate, ticketData, fileName) {
    try {
        // HTML'den PDF oluşturmak için jsPDF ve html2canvas kullan
        this.generatePDFForPassenger(filledTemplate, ticketData, fileName);
        
    } catch (error) {
        console.error('PDF indirme hatası:', error);
        // Fallback: HTML olarak indir
        this.downloadAsHTML(filledTemplate, ticketData, fileName);
    }
}
async generatePDFForPassenger(htmlContent, ticketData, fileName) {
    const navbar = document.querySelector('.navbar');
    
    try {
        // PDF oluşturma başladığında body ve navbar'a class ekle
        // Scroll pozisyonunu kaydet ve sabitle
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        
        // Body'yi fixed yapmak yerine sadece overflow'u engelle
        // Bu sayede içerik görünür kalır
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        
        // Scroll pozisyonunu korumak için padding ekle (scrollbar genişliği için)
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
        
        document.body.classList.add('pdf-generating');
        if (navbar) {
            navbar.classList.add('pdf-generating');
        }
        
        // jsPDF ve html2canvas kütüphanelerini yükle
        await this.loadPDFLibraries();
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        // HTML'i canvas'a çevir
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        element.style.width = '210mm';
        element.style.position = 'absolute';
        element.style.left = '-9999px';
        element.style.top = '0';
        element.style.background = 'white';
        document.body.appendChild(element);
        
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });
        
        document.body.removeChild(element);
        
        // Canvas'ı PDF'e ekle
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 genişliği mm
        const pageHeight = 297; // A4 yüksekliği mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Eğer resim sayfadan büyükse birden fazla sayfaya böl
        let heightLeft = imgHeight;
        let position = 0;
        let page = 1;
        
        while (heightLeft > 0) {
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            
            if (heightLeft > 0) {
                position -= pageHeight;
                pdf.addPage();
                page++;
            }
        }
        
        // PDF'i blob olarak al
        const pdfBlob = pdf.output('blob');
        
        // PDF'i indir
        pdf.save(fileName);
        
        // PDF oluşturma tamamlandığında class'ları kaldır ve scroll pozisyonunu geri yükle
        document.body.classList.remove('pdf-generating');
        if (navbar) {
            navbar.classList.remove('pdf-generating');
        }
        
        // Scroll pozisyonunu geri yükle
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
        document.documentElement.style.removeProperty('overflow');
        window.scrollTo(0, scrollPosition);
        
        return true;
        
    } catch (error) {
        console.error('Yolcu PDF oluşturma hatası:', error);
        
        // Hata durumunda da class'ları kaldır ve scroll pozisyonunu geri yükle
        document.body.classList.remove('pdf-generating');
        if (navbar) {
            navbar.classList.remove('pdf-generating');
        }
        
        // Scroll pozisyonunu geri yükle
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
        document.documentElement.style.removeProperty('overflow');
        window.scrollTo(0, scrollPosition);
        
        // Fallback: HTML olarak indir
        this.downloadAsHTML(htmlContent, ticketData, fileName.replace('.pdf', '.html'));
        return false;
    }
}
}