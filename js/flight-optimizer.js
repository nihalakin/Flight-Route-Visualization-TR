// Uçuş Optimizasyon ve Graf Budama Sistemi
class FlightOptimizer {
    constructor(flightNetwork) {
        this.flightNetwork = flightNetwork;
        this.optimizedRoutes = {};
    }

    // Ana optimizasyon fonksiyonu
    optimizeFlights(flights, searchParams) {
            if (flights.cabinClassWarning) {
        return {
            routes: {
                cheapest: null,
                fastest: null,
                earliest: null,
                balanced: null
            },
            prunedGraph: {},
            filteredCount: 0,
            cabinClassWarning: flights.cabinClassWarning,
            message: flights.message
        };
    }
    
    const filteredFlights = this.filterByTime(flights, searchParams);
        
        this.optimizedRoutes = {
            cheapest: this.findCheapestRoute(filteredFlights),
            fastest: this.findFastestRoute(filteredFlights),
            earliest: this.findEarliestArrivalRoute(filteredFlights),
            balanced: this.findBalancedRoute(filteredFlights)
        };

        // Grafı buda
        const prunedGraph = this.pruneGraph(filteredFlights, searchParams);
        
        return {
            routes: this.optimizedRoutes,
            prunedGraph: prunedGraph,
            filteredCount: filteredFlights.length
        };
    }

    // Saat filtresine göre uçuşları filtrele
    filterByTime(flights, searchParams) {
        if (!searchParams.arrivalTime) {
            return flights; // Saat filtresi yoksa tüm uçuşları döndür
        }

        const [targetHour, targetMinute] = searchParams.arrivalTime.split(':').map(Number);
        
        return flights.filter(flight => {
            const itinerary = flight.itineraries[0];
            const lastSegment = itinerary.segments[itinerary.segments.length - 1];
            const arrivalTime = new Date(lastSegment.arrival.time);
            
            // Varış saati kontrolü
            const arrivalHour = arrivalTime.getHours();
            const arrivalMinute = arrivalTime.getMinutes();
            
            // Hedef saatten önce veya aynı saatte mi?
            if (arrivalHour < targetHour) {
                return true;
            } else if (arrivalHour === targetHour && arrivalMinute <= targetMinute) {
                return true;
            }
            
            return false;
        });
    }

    // En ucuz rotayı bul
    findCheapestRoute(flights) {
        if (flights.length === 0) return null;
        
        return flights.reduce((cheapest, current) => {
            return current.price < cheapest.price ? current : cheapest;
        });
    }

    // En hızlı rotayı bul (toplam uçuş süresi)
    findFastestRoute(flights) {
        if (flights.length === 0) return null;
        
        return flights.reduce((fastest, current) => {
            const fastestDuration = this.parseDuration(fastest.itineraries[0].duration);
            const currentDuration = this.parseDuration(current.itineraries[0].duration);
            
            return currentDuration < fastestDuration ? current : fastest;
        });
    }

    // En erken varış rotasını bul
    findEarliestArrivalRoute(flights) {
        if (flights.length === 0) return null;
        
        return flights.reduce((earliest, current) => {
            const earliestArrival = new Date(earliest.itineraries[0].segments.slice(-1)[0].arrival.time);
            const currentArrival = new Date(current.itineraries[0].segments.slice(-1)[0].arrival.time);
            
            return currentArrival < earliestArrival ? current : earliest;
        });
    }

    // Dengeli rota bul (süre/fiyat)
    findBalancedRoute(flights) {
        if (flights.length === 0) return null;

        // Fiyat ve süre için normalize skorlar hesapla
        const maxPrice = Math.max(...flights.map(f => f.price));
        const maxDuration = Math.max(...flights.map(f => this.parseDuration(f.itineraries[0].duration)));

        const scoredFlights = flights.map(flight => {
            const duration = this.parseDuration(flight.itineraries[0].duration);
            const priceScore = flight.price / maxPrice;
            const durationScore = duration / maxDuration;
            
            // Ağırlıklı skor (fiyat %60, süre %40)
            const balancedScore = (priceScore * 0.6) + (durationScore * 0.4);
            
            return {
                flight: flight,
                score: balancedScore
            };
        });

        // En düşük skoru (en iyi) bul
        return scoredFlights.reduce((best, current) => {
            return current.score < best.score ? current : best;
        }).flight;
    }

    // Süreyi parse et (dakikaya çevir)
    parseDuration(durationStr) {
        const matches = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        const hours = parseInt(matches[1] || 0);
        const minutes = parseInt(matches[2] || 0);
        return hours * 60 + minutes;
    }

    // Grafı buda - sadece optimize rotalarda kullanılan havalimanlarını göster
   // flight-optimizer.js - pruneGraph fonksiyonunu güncelle
pruneGraph(flights, searchParams) {
    const usedAirports = new Set();
    
    // Tüm uçuşlardaki havalimanlarını topla
    flights.forEach(flight => {
        flight.itineraries.forEach(itinerary => {
            itinerary.segments.forEach(segment => {
                usedAirports.add(segment.departure.airport);
                usedAirports.add(segment.arrival.airport);
            });
        });
    });

    // Arama parametrelerindeki havalimanlarını da ekle
    usedAirports.add(searchParams.origin);
    usedAirports.add(searchParams.destination);

    // Budanmış graf oluştur
    const prunedGraph = {};
    
    usedAirports.forEach(airport => {
        if (this.flightNetwork.graph[airport]) {
            prunedGraph[airport] = {};
            for (const neighbor in this.flightNetwork.graph[airport]) {
                if (usedAirports.has(neighbor)) {
                    prunedGraph[airport][neighbor] = this.flightNetwork.graph[airport][neighbor];
                }
            }
        }
    });

    console.log(`Budanmış graf: ${Object.keys(prunedGraph).length} havalimanı, ${this.countLinks(prunedGraph)} bağlantı`);
    return prunedGraph;
}

// Bağlantı sayısını hesapla
countLinks(graph) {
    let count = 0;
    for (const node in graph) {
        count += Object.keys(graph[node]).length;
    }
    return count / 2; // Çift yönlü olduğu için
}

    // Optimize rotaları formatla
    formatOptimizedRoute(flight, type) {
        if (!flight) return null;

        const itinerary = flight.itineraries[0];
        const duration = this.parseDuration(itinerary.duration);
        const lastSegment = itinerary.segments[itinerary.segments.length - 1];
        const arrivalTime = new Date(lastSegment.arrival.time);

        return {
            flight: flight,
            summary: {
                price: flight.price,
                currency: flight.currency,
                duration: duration,
                transferCount: itinerary.transferCount,
                arrivalTime: arrivalTime,
                isDirect: itinerary.isDirect
            },
            path: itinerary.segments.map(seg => seg.departure.airport)
                .concat([lastSegment.arrival.airport]),
            segments: itinerary.segments
        };
    }

    // Tüm optimize rotaları getir
    getAllOptimizedRoutes() {
        return {
            cheapest: this.formatOptimizedRoute(this.optimizedRoutes.cheapest, 'cheapest'),
            fastest: this.formatOptimizedRoute(this.optimizedRoutes.fastest, 'fastest'),
            earliest: this.formatOptimizedRoute(this.optimizedRoutes.earliest, 'earliest'),
            balanced: this.formatOptimizedRoute(this.optimizedRoutes.balanced, 'balanced')
        };
    }
}