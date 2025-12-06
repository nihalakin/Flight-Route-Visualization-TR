// Görselleştirme fonksiyonları

class FlightVisualization {
    constructor() {
        this.width = 1355;
        this.height = 600;
        this.activeAirport = null;
        this.currentRoute = null;
        this.networkMode = false;
        
        this.initializeMap();
    }
    
    initializeMap() {
        // SVG oluştur
        this.svg = d3.select("#map")
            .append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .call(d3.zoom().on("zoom", (event) => {
                this.svgGroup.attr("transform", event.transform);
            }))
            .append("g");

        this.svgGroup = this.svg.append("g");

        // Türkiye haritası için projeksiyon
        this.projection = d3.geoMercator()
            .center([35, 39])
            .scale(1800)
            .translate([this.width / 2, this.height / 2]);

        // Tooltip oluştur
        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        
            // Grupları DOĞRU SIRALAMA ile oluştur - EN ALTTAN EN ÜSTE
// 1. Harita (en altta)
this.mapGroup = this.svgGroup.append("g").attr("class", "map");


// 3. Network linkleri (normal linklerin üstünde)
this.networkGroup = this.svgGroup.append("g").attr("class", "network-links");

// 5. Node'lar (en üstte - tıklanabilir olmalı) 
this.nodeGroup = this.svgGroup.append("g").attr("class", "nodes");
// 2. Linkler (haritanın üstünde)
this.linkGroup = this.svgGroup.append("g").attr("class", "links");


// 4. Rotalar (linklerin üstünde) 
this.routeGroup = this.svgGroup.append("g").attr("class", "routes");


    }
    
    drawTurkeyMap(turkey) {
        // Türkiye sınırlarını çiz - MAP GRUBUNA
        const path = d3.geoPath().projection(this.projection);
        
        this.mapGroup.selectAll(".province")
            .data(turkey.features)
            .enter()
            .append("path")
            .attr("class", "province")
            .attr("d", path)
            .style("fill", "#f8f9fa")
            .style("stroke", "#ddd")
            .style("stroke-width", 0.5);
    }
    
    drawAirports(airportData, flightCounts, airportCoords, links) {
        // Önceki çizimleri temizle
        this.linkGroup.selectAll(".link").remove();
        this.nodeGroup.selectAll(".node").remove();
        this.nodeGroup.selectAll(".node-label").remove();

        // Uçuş rotalarını çiz (başlangıçta görünmez) - LINK GRUBUNA
        this.linkGroup.selectAll(".link")
            .data(links)
            .enter()
            .append("line")
            .attr("class", "link")
            .attr("x1", d => this.projection([airportCoords[d.source].lon, airportCoords[d.source].lat])[0])
            .attr("y1", d => this.projection([airportCoords[d.source].lon, airportCoords[d.source].lat])[1])
            .attr("x2", d => this.projection([airportCoords[d.target].lon, airportCoords[d.target].lat])[0])
            .attr("y2", d => this.projection([airportCoords[d.target].lon, airportCoords[d.target].lat])[1])
            .style("stroke", "#999")
            .style("stroke-width", 1)
            .style("opacity", 0) // Başlangıçta görünmez
            .style("pointer-events", "none"); // Linkler tıklanamaz

        // Havalimanı node'larını çiz - NODE GRUBUNA (EN ÜSTTE)
        this.nodeGroup.selectAll(".node")
            .data(airportData)
            .enter()
            .append("circle")
            .attr("class", "node")
            .attr("r", d => {
                const baseSize = 4;
                const sizeMultiplier = 0.15; 
                const flightCount = flightCounts[d.iata] || 0;
                return baseSize + (flightCount * sizeMultiplier);
            })
            .attr("cx", d => this.projection([d.lon, d.lat])[0])
            .attr("cy", d => this.projection([d.lon, d.lat])[1])
            .style("fill", d => getColor(flightCounts[d.iata]))
            .style("stroke", "#fff")
            .style("stroke-width", 1.5)
            .style("cursor", "pointer")
            .style("pointer-events", "all") // Node'lar tıklanabilir
            .on("mouseover", (event, d) => this.handleNodeMouseOver(event, d, flightCounts))
            .on("mouseout", (event, d) => this.handleNodeMouseOut(event, d, flightCounts))
            .on("click", (event, d) => this.handleNodeClick(event, d, flightCounts));
            
        // Havalimanı isimlerini ekle - NODE GRUBUNA
        this.nodeGroup.selectAll(".node-label")
            .data(airportData)
            .enter()
            .append("text")
            .attr("class", "node-label")
            .attr("x", d => this.projection([d.lon, d.lat])[0])
            .attr("y", d => this.projection([d.lon, d.lat])[1] - 10)
            .text(d => d.iata)
            .style("font-size", "8px")
            .style("text-anchor", "middle")
            .style("pointer-events", "none") // Etiketler tıklanamaz
            .style("user-select", "none"); // Metin seçilemez
            
        // Haritaya tıklandığında aktif havalimanını temizle
        this.svg.on("click", (event) => {
            // Sadece haritaya (mapGroup) veya province'lara tıklandığında çalışsın
            if (event.target.classList.contains('province') || event.target.tagName === 'svg') {
                if (this.networkMode) return;
                
                this.activeAirport = null;
                this.linkGroup.selectAll(".link")
                    .style("opacity", 0);
                d3.select("#status").text("Bir havalimanının üzerine gelerek uçuş rotalarını görüntüleyin veya tıklayarak kalıcı hale getirin");
            }
        });
    }
    
    handleNodeMouseOver(event, d, flightCounts) {
        console.log('Mouse over node:', d.iata); // Debug için
        
        // Üzerine gelinen node'u vurgula
        d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr("r", Math.max(6, Math.min(12, flightCounts[d.iata] / 2)))
            .style("stroke-width", 2);
        
        // Aktif bir havalimanı seçili değilse ve ağ modu aktif değilse, hover edilenin uçuş rotalarını göster
        if (!this.activeAirport && !this.networkMode) {
            console.log('Showing links for:', d.iata); // Debug için
            
            this.linkGroup.selectAll(".link")
                .style("opacity", function(l) {
                    const shouldShow = (l.source === d.iata || l.target === d.iata);
                    return shouldShow ? 0.7 : 0;
                });
        }
        
        // Tooltip göster
        this.tooltip.transition()
            .duration(200)
            .style("opacity", .9);
        this.tooltip.html(`<strong>${d.name}</strong><br/>${d.city}<br/>Uçuş Noktası Sayısı: ${flightCounts[d.iata]}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
    }
    
    handleNodeMouseOut(event, d, flightCounts) {
        console.log('Mouse out node:', d.iata); // Debug için
        
        // Node'u normal haline getir
        d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr("r", Math.max(4, Math.min(8, flightCounts[d.iata] / 2)))
            .style("stroke-width", 1.5);
        
        // Aktif bir havalimanı seçili değilse ve ağ modu aktif değilse, tüm uçuş rotalarını gizle
        if (!this.activeAirport && !this.networkMode) {
            console.log('Hiding all links'); // Debug için
            this.linkGroup.selectAll(".link")
                .style("opacity", 0);
        } else if (this.activeAirport && !this.networkMode) {
            // Aktif havalimanı seçiliyse, sadece onun uçuş rotalarını göster
            console.log('Showing links for active airport:', this.activeAirport.iata); // Debug için
            this.linkGroup.selectAll(".link")
                .style("opacity", function(l) {
                    const shouldShow = (l.source === this.activeAirport.iata || l.target === this.activeAirport.iata);
                    return shouldShow ? 0.7 : 0;
                }.bind(this));
        }
        
        // Tooltip'i gizle
        this.tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    }
    
    handleNodeClick(event, d, flightCounts) {
        event.stopPropagation();
        console.log('Node clicked:', d.iata); // Debug için
        
        // Ağ modu aktifse bile tıklamaya izin ver, sadece görsel vurgulamayı engelle
        if (this.networkMode) {
            // Ağ modunda sadece detay göster, görsel vurgulama yapma
            showAirportDetails(d);
            d3.select("#status").text(`${d.name} detayları gösteriliyor (Ağ modu aktif)`);
            return;
        }
        
        // Aynı havalimanına tekrar tıklandıysa, aktif durumu kaldır
        if (this.activeAirport && this.activeAirport.iata === d.iata) {
            this.activeAirport = null;
            this.linkGroup.selectAll(".link")
                .style("opacity", 0);
            d3.select("#status").text("Bir havalimanının üzerine gelerek uçuş rotalarını görüntüleyin veya tıklayarak kalıcı hale getirin");
        } else {
            // Yeni bir havalimanı seçildi
            this.activeAirport = d;
            this.linkGroup.selectAll(".link")
                .style("opacity", function(l) {
                    const shouldShow = (l.source === d.iata || l.target === d.iata);
                    return shouldShow ? 0.7 : 0;
                });
            d3.select("#status").text(`${d.name} uçuş rotaları gösteriliyor. Kapatmak için tekrar tıklayın.`);
        }
        
        // Havalimanı detaylarını göster
        showAirportDetails(d);
    }
}