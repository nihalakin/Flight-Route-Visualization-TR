// Uçuş filtreleme ve rota gösterim işlemleri

class FlightFilter {
    constructor(flightNetwork, visualization) {
        this.flightNetwork = flightNetwork;
        this.visualization = visualization;
        this.currentRoute = null;
        
        this.initializeControls();
    }
    
    initializeControls() {
        // Havalimanı seçim listelerini doldur
        const fromSelect = d3.select("#from-airport");
        const toSelect = d3.select("#to-airport");
        
        this.flightNetwork.airportData.forEach(airport => {
            fromSelect.append("option")
                .attr("value", airport.iata)
                .text(`${airport.city} - ${airport.name} (${airport.iata})`);
                
            toSelect.append("option")
                .attr("value", airport.iata)
                .text(`${airport.city} - ${airport.name} (${airport.iata})`);
        });

        // Buton event listener'ları
        d3.select("#show-route").on("click", () => this.showRoute());
        d3.select("#show-network").on("click", () => this.showNetwork());
        d3.select("#clear-route").on("click", () => this.clearAll());
    }
    
    showRoute() {
    const fromIata = d3.select("#from-airport").property("value");
    const toIata = d3.select("#to-airport").property("value");
    
    if (!fromIata || !toIata) {
        alert("Lütfen hem kalkış hem de varış havalimanını seçin.");
        return;
    }
    
    if (fromIata === toIata) {
        alert("Kalkış ve varış havalimanları aynı olamaz.");
        return;
    }
    
    // ÖNCEKİ ROTAYI TEMİZLE
    this.clearRouteOnly(); // Sadece rotayı temizle, diğer kontrolleri koru
    
    // Rota bilgisini göster
    const fromAirport = this.flightNetwork.getAirportByIata(fromIata);
    const toAirport = this.flightNetwork.getAirportByIata(toIata);
    
    const routeInfo = d3.select("#route-info");
    routeInfo.html(`
        <strong>Seçilen Rota:</strong> ${fromAirport.city} (${fromIata}) → ${toAirport.city} (${toIata})
    `).style("display", "block");
    
    // Buton durumunu güncelle
    this.updateButtonStates('route');
    
    // Rotayı bul ve göster
    this.findAndShowRoute(fromIata, toIata);
}

// flight-filter.js dosyasında clearRouteOnly fonksiyonunu bu şekilde güncelleyin

clearRouteOnly() {
    // TÜM rota çizgilerini ve okları kaldır - daha kapsamlı temizlik
    this.visualization.svgGroup.selectAll(".link.route, .link.transfer, .link-arrow, .link-arrow-middle").remove();
    
    // Tüm marker/ok başı tanımlarını kaldır
    const defs = this.visualization.svgGroup.select("defs");
    if (!defs.empty()) {
        defs.selectAll("marker").remove();
    }
    
    // Havalimanı vurgularını kaldır - SADECE GÖLGEYİ KALDIR
    this.visualization.svgGroup.selectAll(".node")
        .classed("start", false)
        .classed("end", false)
        .classed("transfer", false)
        .style("filter", null); // Tüm filtreleri kaldır
    
    // Rota bilgilerini gizle
    d3.select("#route-info").style("display", "none");
    d3.select("#route-details").style("display", "none");
    
    // Durum mesajını sıfırla
    d3.select("#status").text("Bir havalimanının üzerine gelerek uçuş rotalarını görüntüleyin veya tıklayarak kalıcı hale getirin");
    
    this.currentRoute = null;
    
    // Ek temizlik: routes grubunu da temizle
    const routesGroup = this.visualization.svgGroup.select(".routes");
    if (!routesGroup.empty()) {
        routesGroup.selectAll("*").remove();
    }
    

}
    
    showNetwork() {
        // Önceki her şeyi temizle
        this.clearAll();
        
        this.visualization.networkMode = true;
        
        // Ağ çizgilerini çiz
        const networkGroup = this.visualization.svgGroup.select(".network-links");
        networkGroup.selectAll(".link.network")
            .data(this.flightNetwork.links)
            .enter()
            .append("line")
            .attr("class", "link network")
            .attr("x1", d => this.visualization.projection([this.flightNetwork.airportCoords[d.source].lon, this.flightNetwork.airportCoords[d.source].lat])[0])
            .attr("y1", d => this.visualization.projection([this.flightNetwork.airportCoords[d.source].lon, this.flightNetwork.airportCoords[d.source].lat])[1])
            .attr("x2", d => this.visualization.projection([this.flightNetwork.airportCoords[d.target].lon, this.flightNetwork.airportCoords[d.target].lat])[0])
            .attr("y2", d => this.visualization.projection([this.flightNetwork.airportCoords[d.target].lon, this.flightNetwork.airportCoords[d.target].lat])[1])
            .style("stroke", "#9b59b6")
            .style("stroke-width", 0.5)
            .style("opacity", 0.4)
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(100)
                    .style("opacity", 0.8)
                    .style("stroke-width", 2)
                    .style("stroke", "blue");
            })
            .on("mouseout", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(100)
                    .style("opacity", 0.4)
                    .style("stroke-width", 0.5)
                    .style("stroke", "#9b59b6");
            });
        
        // Havalimanlarını vurgula
        this.visualization.svgGroup.selectAll(".node")
            .classed("network", true)
            .transition()
            .duration(500)
            .style("stroke", "#9b59b6")
            .style("stroke-width", 2);
        
        // Ağ istatistiklerini göster
        this.showNetworkStats();
        
        // Buton durumunu güncelle
        this.updateButtonStates('network');
        
        // Durum mesajını güncelle
        d3.select("#status").text("Tüm uçuş ağı gösteriliyor. Bağlantıların üzerine gelerek detayları görüntüleyin.");
    }
    
    findAndShowRoute(fromIata, toIata) {
        // Dijkstra algoritması ile en kısa rotayı bul
        const route = this.flightNetwork.findRoute(fromIata, toIata);
        
        if (!route || route.length < 2) {
            alert("Seçilen havalimanları arasında uçuş rotası bulunamadı.");
            return;
        }
        
        this.currentRoute = route;
        this.displayRoute(route);
    }
    
  // flight-filter.js - displayRoute fonksiyonunu bu şekilde güncelleyin

displayRoute(route) {
    const routeGroup = this.visualization.svgGroup.select(".routes");
    const totalDistance = calculateTotalDistance(route, this.flightNetwork.graph);
    
    // Önce ok başı tanımlarını oluştur - ORTA NOKTADA GÖSTERİM İÇİN
    const defs = this.visualization.svgGroup.select("defs");
    if (defs.empty()) {
        this.visualization.svgGroup.append("defs");
    }
    
    // Orta nokta için ok başları
    this.visualization.svgGroup.select("defs").html(`
        <marker id="direct-arrowhead-middle" markerWidth="10" markerHeight="8" 
                refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <polygon points="0 0, 10 4, 0 8" 
                    style="fill: #10b981; stroke: #10b981; stroke-width: 1;" />
        </marker>
        <marker id="transfer-arrowhead-middle" markerWidth="10" markerHeight="8" 
                refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <polygon points="0 0, 10 4, 0 8" 
                    style="fill: #ff9800; stroke: #ff9800; stroke-width: 1;" />
        </marker>
    `);
    
    // Rota çizgilerini çiz - ORTA NOKTADA OK
    for (let i = 0; i < route.length - 1; i++) {
        const source = route[i];
        const target = route[i+1];
        const isDirect = route.length === 2;
        
        const sourceCoords = this.flightNetwork.airportCoords[source];
        const targetCoords = this.flightNetwork.airportCoords[target];
        
        const x1 = this.visualization.projection([sourceCoords.lon, sourceCoords.lat])[0];
        const y1 = this.visualization.projection([sourceCoords.lon, sourceCoords.lat])[1];
        const x2 = this.visualization.projection([targetCoords.lon, targetCoords.lat])[0];
        const y2 = this.visualization.projection([targetCoords.lon, targetCoords.lat])[1];
        
        // Orta noktayı hesapla
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        // Çizgi açısını hesapla
        const angle = Math.atan2(y2 - y1, x2 - x1);
        
        // Ana çizgiyi çiz (ok işareti olmadan)
        const lineClass = isDirect ? "link route" : "link transfer";
        const lineColor = isDirect ? "#10b981" : "#ff9800";
        
        const line = routeGroup.append("line")
            .attr("class", lineClass)
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2)
            .style("stroke", lineColor)
            .style("stroke-width", 2)
            .style("opacity", 0)
            .style("z-index", 1000);
            
        // ORTA NOKTADA OK ÇİZ
        const arrowId = isDirect ? "direct-arrowhead-middle" : "transfer-arrowhead-middle";
        
        // Ok için kısa bir çizgi (sadece okun görünmesi için)
        const arrowLength = 8; // Ok uzunluğu
        const arrowLine = routeGroup.append("line")
            .attr("class", "link-arrow-middle")
            .attr("x1", midX - (arrowLength/2) * Math.cos(angle))
            .attr("y1", midY - (arrowLength/2) * Math.sin(angle))
            .attr("x2", midX + (arrowLength/2) * Math.cos(angle))
            .attr("y2", midY + (arrowLength/2) * Math.sin(angle))
            .style("stroke", lineColor)
            .style("stroke-width", 3) // Ok çizgisini biraz kalın yap
            .style("marker-end", `url(#${arrowId})`)
            .style("opacity", 0)
            .style("z-index", 1001); // Ana çizgiden daha üstte
        
        // Ana çizgiyi animasyonla göster
        line.transition()
            .duration(500)
            .delay(i * 200)
            .style("opacity", 1);
            
        // Ok çizgisini animasyonla göster
        arrowLine.transition()
            .duration(500)
            .delay(i * 200 + 100)
            .style("opacity", 1);
    }
    
    // Rota üzerindeki havalimanlarını vurgula
    route.forEach((airportIata, index) => {
        const nodeSelection = this.visualization.svgGroup.selectAll(".node")
            .filter(d => d.iata === airportIata);
        
        if (index === 0) {
            nodeSelection.classed("start", true);
        } else if (index === route.length - 1) {
            nodeSelection.classed("end", true);
        } else {
            nodeSelection.classed("transfer", true);
        }
        
        nodeSelection.transition()
            .duration(500)
            .delay(index * 200)
            .style("filter", "drop-shadow(0 0 6px rgba(0,0,0,0.8))");
    });
    
    // Rota detaylarını göster
    this.showRouteDetails(route, totalDistance);
}
    showRouteDetails(route, totalDistance) {
        const fromAirport = this.flightNetwork.getAirportByIata(route[0]);
        const toAirport = this.flightNetwork.getAirportByIata(route[route.length - 1]);
        
        let detailsHTML = `
            <div><strong>Toplam Mesafe:</strong> ${totalDistance.toFixed(0)} km</div>
            <div><strong>Uçuş Segmentleri:</strong> ${route.length - 1}</div>
            <div><strong>Rota Detayları:</strong></div>
        `;
        
        if (route.length === 2) {
            detailsHTML += `
                <div class="transfer-info">
                    <strong>Doğrudan Uçuş:</strong> ${fromAirport.city} → ${toAirport.city}
                </div>
            `;
            d3.select("#status").text(`Doğrudan uçuş: ${fromAirport.city} → ${toAirport.city} (${totalDistance.toFixed(0)} km)`);
        } else {
            const transfers = route.slice(1, -1);
            detailsHTML += `
                <div class="transfer-info">
                    <strong>Kalkış:</strong> ${fromAirport.city} (${route[0]})<br>
                    <strong>Aktarmalar:</strong> ${transfers.map(a => `${this.flightNetwork.airportCoords[a].city} (${a})`).join(' → ')}<br>
                    <strong>Varış:</strong> ${toAirport.city} (${route[route.length - 1]})
                </div>
            `;
            d3.select("#status").text(`Aktarmalı uçuş: ${fromAirport.city} → ${transfers.map(a => this.flightNetwork.airportCoords[a].city).join(' → ')} → ${toAirport.city} (${totalDistance.toFixed(0)} km)`);
        }
        
        d3.select("#route-details")
            .html(detailsHTML)
            .style("display", "block");
    }
    
    showNetworkStats() {
        const stats = this.flightNetwork.calculateNetworkStats();
        
        const statsHTML = `
            <div class="network-info">
                <strong>Türkiye Uçuş Ağı İstatistikleri</strong><br>
                • Toplam Havalimanı: ${stats.totalAirports}<br>
                • Toplam Bağlantı: ${stats.totalConnections}<br>
                • Toplam Uçuş Ağı Uzunluğu: ${stats.totalDistance.toFixed(0)} km<br>
                • Ortalama Bağlantı Sayısı: ${stats.averageConnections}<br>
                • En Bağlantılı Havalimanı: ${stats.mostConnected.city} (${stats.mostConnected.iata}) - ${this.flightNetwork.flightCounts[stats.mostConnected.iata]} bağlantı<br>
                • En Az Bağlantılı Havalimanı: ${stats.leastConnected.city} (${stats.leastConnected.iata}) - ${this.flightNetwork.flightCounts[stats.leastConnected.iata]} bağlantı
            </div>
        `;
        
        d3.select("#network-stats")
            .html(statsHTML)
            .style("display", "block");
    }
    
    updateButtonStates(mode) {
        // Tüm butonları sıfırla
        d3.select("#show-route").classed("active", false);
        d3.select("#show-network").classed("network-active", false);
        
        // Seçili moda göre vurgula
        if (mode === 'route') {
            d3.select("#show-route").classed("active", true);
        } else if (mode === 'network') {
            d3.select("#show-network").classed("network-active", true);
        }
    }
    
    clearAll() {
    // Rota çizgilerini ve okları kaldır
    this.clearRouteOnly(); // Yeni metodumuzu kullan
    
    // Ağ çizgilerini kaldır
    this.visualization.svgGroup.selectAll(".link.network").remove();
    
    // Bilgi panellerini gizle
    d3.select("#route-info").style("display", "none");
    d3.select("#network-stats").style("display", "none");
    
    // Buton durumlarını sıfırla
    this.updateButtonStates('none');
    
    // Durum mesajını sıfırla
    d3.select("#status").text("Bir havalimanının üzerine gelerek uçuş rotalarını görüntüleyin veya tıklayarak kalıcı hale getirin");
    
    this.visualization.networkMode = false;
    this.visualization.activeAirport = null;
    
    // Normal linkleri gizle
    this.visualization.linkGroup.selectAll(".link")
        .style("opacity", 0);
}
}