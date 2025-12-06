// Uçuş Arama ve API Entegrasyonu - Backend ile
class FlightSearch {
    constructor() {
        this.backendUrl = 'http://localhost:5000/api'; // Backend URL'si
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

    // Backend API üzerinden uçuş araması yap
    // flight-search.js - searchFlights fonksiyonunu güncelleyin
async searchFlights(searchParams) {
    try {
        // Backend API'sine sorgu yap
        const queryParams = new URLSearchParams({
            origin: searchParams.origin,
            destination: searchParams.destination,
            departureDate: searchParams.departureDate,
            adults: searchParams.adults || 1,
            travelClass: searchParams.cabinClass || 'ECONOMY' // Yeni parametre
        });

        const response = await fetch(`${this.backendUrl}/flights?${queryParams}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Backend hatası: ${response.status}`);
        }

        const data = await response.json();
        const processedFlights = this.processFlightData(data);
        
        // Eğer uçuş bulunamadıysa ve business sınıfı seçildiyse
        if (processedFlights.length === 0 && searchParams.cabinClass === 'BUSINESS') {
            return {
                flights: [],
                cabinClassWarning: 'BUSINESS',
                message: 'Seçilen tarihte BUSINESS sınıfında uçuş bulunamadı. ECONOMY sınıfındaki uçuşlara bakmak için lütfen filtreyi değiştirin.'
            };
        }
        
        return {
            flights: processedFlights,
            cabinClass: searchParams.cabinClass
        };
        
    } catch (error) {
        console.error('Uçuş arama hatası:', error);
        
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
            throw new Error('Backend servisine ulaşılamıyor. Lütfen backend\'in çalıştığından emin olun.');
        }
        
        throw error;
    }
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