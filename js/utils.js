// Yardımcı fonksiyonlar

// Mesafe hesaplama fonksiyonu (Haversine formülü)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Havalimanı renklerini belirle
function getColor(flightCount) {
    if (flightCount >= 10) return "#8B0000"; // Bordo - Çok uçuş
    if (flightCount >= 5) return "#FF4500";  // Turuncu - Orta uçuş
    return "#FFD700"; // Sarı - Az uçuş
}

// Metin temizleme fonksiyonu 
function cleanText(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/i̇/g, 'i')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/'/g, '')
        .replace(/"/g, '')
        .trim();
}

// Toplam mesafeyi hesapla
function calculateTotalDistance(route, graph) {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
        const source = route[i];
        const target = route[i+1];
        total += graph[source][target];
    }
    return total;
}

// Dijkstra algoritması - En kısa yolu bul
function dijkstra(graph, start, end) {
    const distances = {};
    const previous = {};
    const nodes = new Set();
    const path = [];
    
    // Başlangıç değerlerini ayarla
    for (let node in graph) {
        distances[node] = Infinity;
        previous[node] = null;
        nodes.add(node);
    }
    distances[start] = 0;
    
    while (nodes.size > 0) {
        // En küçük mesafeli node'u bul
        let smallest = null;
        for (let node of nodes) {
            if (smallest === null || distances[node] < distances[smallest]) {
                smallest = node;
            }
        }
        
        if (smallest === end) {
            // Yolu oluştur
            while (previous[smallest]) {
                path.push(smallest);
                smallest = previous[smallest];
            }
            path.push(start);
            return path.reverse();
        }
        
        if (distances[smallest] === Infinity) {
            break;
        }
        
        nodes.delete(smallest);
        
        // Komşuları güncelle
        for (let neighbor in graph[smallest]) {
            const alt = distances[smallest] + graph[smallest][neighbor];
            if (alt < distances[neighbor]) {
                distances[neighbor] = alt;
                previous[neighbor] = smallest;
            }
        }
    }
    
    return null;
}