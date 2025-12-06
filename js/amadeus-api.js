class AmadeusAPI {
    constructor() {

        this.API_KEY = "GDtPIq7WywpCmy5GG0rQU8fZuK1TB94l"; // Gerçek key ile değiştirin
        this.API_SECRET = "evNVsL9PlUDcN4G8"; // Gerçek secret ile değiştirin
        this.accessToken = null;
        this.baseURL = 'https://test.api.amadeus.com/v2';
        
        this.airlineDict = {
            "TK": "Türk Hava Yolları",
            "PC": "Pegasus",
            "VF": "Ajet",
            "XQ": "SunExpress",
            "J2": "Azerbaijan Airlines",
            "LH": "Lufthansa",
            "AF": "Air France",
            "BA": "British Airways"
        };
    }

    async authenticate() {
        try {
            const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'grant_type': 'client_credentials',
                    'client_id': this.API_KEY,
                    'client_secret': this.API_SECRET
                })
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            console.log('Amadeus API authentication successful');
            return this.accessToken;
        } catch (error) {
            console.error('Amadeus API authentication error:', error);
            throw error;
        }
    }

    async searchFlights(params) {
        if (!this.accessToken) {
            await this.authenticate();
        }

        const searchParams = new URLSearchParams({
            'originLocationCode': params.originLocationCode,
            'destinationLocationCode': params.destinationLocationCode,
            'departureDate': params.departureDate,
            'adults': params.adults || '1',
            'currencyCode': params.currencyCode || 'TRY',
            'max': params.max || '10'
        });

        try {
            const response = await fetch(`${this.baseURL}/shopping/flight-offers?${searchParams}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired, re-authenticate
                    await this.authenticate();
                    return this.searchFlights(params);
                }
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            return this.parseFlightOffers(data);
        } catch (error) {
            console.error('Amadeus API search error:', error);
            throw error;
        }
    }

    parseFlightOffers(apiData) {
        const flightRoutes = [];

        apiData.data.forEach((offer, offerIndex) => {
            const price = parseFloat(offer.price.total);
            
            offer.itineraries.forEach((itinerary) => {
                const segments = itinerary.segments.map((segment, segIndex) => {
                    const duration = Utils.parseISODuration(segment.duration);
                    const airlineName = this.airlineDict[segment.carrierCode] || segment.carrierCode;
                    
                    return new FlightSegment({
                        id: `amadeus_${offerIndex}_${segIndex}`,
                        airline: segment.carrierCode,
                        flightNumber: `${segment.carrierCode}${segment.number}`,
                        departureAirport: segment.departure.iataCode,
                        arrivalAirport: segment.arrival.iataCode,
                        departureTime: segment.departure.at,
                        arrivalTime: segment.arrival.at,
                        duration: duration,
                        price: segIndex === 0 ? price * 0.8 : price * 0.2, // Fiyatı segmentlere dağıt
                        aircraft: segment.aircraft?.code || 'Unknown',
                        departureTerminal: segment.departure.terminal || 'N/A',
                        arrivalTerminal: segment.arrival.terminal || 'N/A'
                    });
                });

                const totalPrice = segments.reduce((sum, seg) => sum + seg.price, 0);
                
                flightRoutes.push(new FlightRoute({
                    id: `amadeus_route_${offerIndex}`,
                    segments: segments,
                    totalPrice: totalPrice
                }));
            });
        });

        console.log(`Amadeus'tan ${flightRoutes.length} rota parse edildi`);
        return flightRoutes;
    }

    // Mock data fallback (API kullanılamazsa)
    async getMockFlights(from, to, date) {
        console.log('Mock uçuş verileri kullanılıyor');
        
        const mockRoutes = [];
        const basePrice = 200 + Math.random() * 800;
        
        // Direkt uçuş
        mockRoutes.push(new FlightRoute({
            id: 'mock_direct_1',
            segments: [new FlightSegment({
                id: 'mock_segment_1',
                airline: 'TK',
                flightNumber: 'TK1234',
                departureAirport: from,
                arrivalAirport: to,
                departureTime: new Date(date + 'T08:00:00').toISOString(),
                arrivalTime: new Date(date + 'T09:30:00').toISOString(),
                duration: 90,
                price: basePrice,
                aircraft: 'Boeing 737',
                seatsAvailable: 120
            })],
            totalPrice: basePrice
        }));

        // 1 aktarmalı uçuş
        const transferAirports = ['IST', 'SAW', 'ESB'].filter(ap => ap !== from && ap !== to);
        if (transferAirports.length > 0) {
            const transfer = transferAirports[0];
            mockRoutes.push(new FlightRoute({
                id: 'mock_transfer_1',
                segments: [
                    new FlightSegment({
                        id: 'mock_segment_2a',
                        airline: 'TK',
                        flightNumber: 'TK5678',
                        departureAirport: from,
                        arrivalAirport: transfer,
                        departureTime: new Date(date + 'T06:00:00').toISOString(),
                        arrivalTime: new Date(date + 'T07:30:00').toISOString(),
                        duration: 90,
                        price: basePrice * 0.6,
                        aircraft: 'Boeing 737',
                        seatsAvailable: 80
                    }),
                    new FlightSegment({
                        id: 'mock_segment_2b',
                        airline: 'TK',
                        flightNumber: 'TK9012',
                        departureAirport: transfer,
                        arrivalAirport: to,
                        departureTime: new Date(date + 'T09:00:00').toISOString(),
                        arrivalTime: new Date(date + 'T10:15:00').toISOString(),
                        duration: 75,
                        price: basePrice * 0.6,
                        aircraft: 'Airbus A320',
                        seatsAvailable: 90
                    })
                ],
                totalPrice: basePrice * 1.2
            }));
        }

        return mockRoutes;
    }
}