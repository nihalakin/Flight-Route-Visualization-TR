// Uçuş ağı ve rota işlemleri

class FlightNetwork {
    constructor(airportData) {
        this.airportData = airportData;
        this.links = [];
        this.graph = {};
        this.flightCounts = {};
        this.airportCoords = {};
        
        this.initializeNetwork();
    }
    
    initializeNetwork() {
        // Havalimanı IATA kodlarına göre koordinatları bulmak için bir sözlük oluştur
        this.airportData.forEach(airport => {
            this.airportCoords[airport.iata] = {
                lat: airport.lat, 
                lon: airport.lon, 
                city: airport.city, 
                name: airport.name
            };
        });

        // Graph yapısını oluştur
        this.airportData.forEach(airport => {
            this.graph[airport.iata] = {};
        });

        // Uçuş bağlantılarını ve mesafelerini oluştur
        this.airportData.forEach(source => {
            if (source.flights) {
                const destinations = source.flights.split(';');
                destinations.forEach(dest => {
                    if (dest && this.airportCoords[dest]) {
                        const distance = calculateDistance(
                            source.lat, source.lon,
                            this.airportCoords[dest].lat, this.airportCoords[dest].lon
                        );
                        
                        this.links.push({
                            source: source.iata,
                            target: dest,
                            sourceCity: source.city,
                            targetCity: this.airportCoords[dest].city,
                            distance: distance
                        });
                        
                        // Graph'a ekle (çift yönlü)
                        this.graph[source.iata][dest] = distance;
                        this.graph[dest][source.iata] = distance;
                    }
                });
            }
        });

        // Havalimanlarının uçuş sayılarını hesapla
        this.airportData.forEach(airport => {
            if (airport.flights) {
                this.flightCounts[airport.iata] = airport.flights.split(';').filter(dest => dest && this.airportCoords[dest]).length;
            } else {
                this.flightCounts[airport.iata] = 0;
            }
        });
    }
    
    // flight-network.js dosyasında calculateNetworkStats fonksiyonunu güncelleyin

calculateNetworkStats() {
    const totalAirports = this.airportData.length;
    const totalConnections = this.links.length
    const totalDistance = this.links.reduce((sum, link) => sum + link.distance, 0);
    
    // En çok bağlantıya sahip havalimanı
    const mostConnected = this.airportData.reduce((max, airport) => 
        this.flightCounts[airport.iata] > this.flightCounts[max.iata] ? airport : max
    );
    
    // En az bağlantıya sahip havalimanı - TÜM havalimanlarını dahil et
    const leastConnected = this.airportData.reduce((min, airport) => 
        this.flightCounts[airport.iata] < this.flightCounts[min.iata] ? airport : min
    );
    
    return {
        totalAirports,
        totalConnections,
        totalDistance: totalDistance,
        mostConnected,
        leastConnected,
        averageConnections: (totalConnections * 2 / totalAirports).toFixed(1)
    };
}
    
    // Rotayı bul
    findRoute(fromIata, toIata) {
        return dijkstra(this.graph, fromIata, toIata);
    }
    
    getAirportByIata(iata) {
        return this.airportData.find(a => a.iata === iata);
    }
}