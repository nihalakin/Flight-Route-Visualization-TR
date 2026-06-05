// Optimizasyon Haritası Sınıfı - Budama Animasyonu ile
class OptimizationMap {
    constructor() {
        this.width = 800;
        this.height = 500;
        this.currentRoute = null;
        this.currentRouteType = null;
        this.optimizedRoutes = {};
        this.searchParams = null;
        this.animationInProgress = false;
        this.prunedGraph = null;
        
        console.log('OptimizationMap constructor çağrıldı');
        this.initializeMap();
    }

    initializeMap() {
        console.log('🗺️ initializeMap çağrıldı');
        
        try {
            // SVG oluştur
            const container = document.getElementById('optimization-map');
            if (!container) {
                console.error('Optimization map container not found');
                // Container'ı oluşturmaya çalış
                if (window.navigation && typeof window.navigation.createOptimizationMapContainer === 'function') {
                    window.navigation.createOptimizationMapContainer();
                }
                return;
            }
            
            // Container boşsa temizle
            container.innerHTML = '';
                
            this.svg = d3.select("#optimization-map")
                .append("svg")
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("viewBox", `0 0 ${this.width} ${this.height}`)
                .call(d3.zoom().on("zoom", (event) => {
                    this.svgGroup.attr("transform", event.transform);
                }))
                .append("g");

            this.svgGroup = this.svg.append("g");

            // Türkiye haritası için projeksiyon
            this.projection = d3.geoMercator()
                .center([35, 39])
                .scale(1600)
                .translate([this.width / 2, this.height / 2]);

            // Grupları oluştur
            this.mapGroup = this.svgGroup.append("g").attr("class", "map");
            this.linksGroup = this.svgGroup.append("g").attr("class", "links");
            this.nodesGroup = this.svgGroup.append("g").attr("class", "nodes");
            this.routeGroup = this.svgGroup.append("g").attr("class", "route");
            this.animationGroup = this.svgGroup.append("g").attr("class", "animation");

            // Türkiye haritasını yükle
            this.loadTurkeyMap();
            
            // Buton event listener'ları
            this.initializeControls();
            
            console.log('OptimizationMap başarıyla başlatıldı');
            
        } catch (error) {
            console.error('OptimizationMap başlatma hatası:', error);
        }
    }


    async setOptimizedRoutes(routes, searchParams, prunedGraph = null) {
        console.log('setOptimizedRoutes çağrıldı', { routes, searchParams, prunedGraph });
        
        if (this.animationInProgress) {
            console.log("Animasyon devam ediyor, yeni animasyon başlatılmıyor");
            return;
        }

        this.optimizedRoutes = routes;
        this.searchParams = searchParams;
        
        console.log('Optimize rotalar alındı:', routes);
        console.log('Budanmış graf:', prunedGraph);
        
        // Önce temizle
        this.clearMap();
        
        // Bilgi mesajını güncelle
        this.updateInfoMessage("Optimizasyon animasyonu başlatılıyor...");
        
        if (prunedGraph && Object.keys(prunedGraph).length > 0) {
            // Animasyonlu budama göster
            await this.animateGraphPruning(prunedGraph, searchParams, routes);
        } else {
            // Normal gösterim
            console.log('Budanmış graf yok, normal gösterim kullanılıyor');
            this.drawPossibleRoutes();
            this.showRoute('cheapest');
        }
    }

    // Olası rotaları çiz 
    drawPossibleRoutes() {
        if (!this.searchParams || !window.flightNetwork) return;
        
        const { origin, destination } = this.searchParams;
        const flightNetwork = window.flightNetwork;
        
        // Olası tüm bağlantıları çiz
        this.linksGroup.selectAll(".opt-link")
            .data(flightNetwork.links)
            .enter()
            .append("line")
            .attr("class", "opt-link")
            .attr("x1", d => this.projection([flightNetwork.airportCoords[d.source].lon, flightNetwork.airportCoords[d.source].lat])[0])
            .attr("y1", d => this.projection([flightNetwork.airportCoords[d.source].lon, flightNetwork.airportCoords[d.source].lat])[1])
            .attr("x2", d => this.projection([flightNetwork.airportCoords[d.target].lon, flightNetwork.airportCoords[d.target].lat])[0])
            .attr("y2", d => this.projection([flightNetwork.airportCoords[d.target].lon, flightNetwork.airportCoords[d.target].lat])[1])
            .style("stroke", "#6366f1")
            .style("stroke-width", 1)
            .style("opacity", 0.3);
        
        // Tüm havalimanlarını çiz
        this.nodesGroup.selectAll(".opt-node")
            .data(flightNetwork.airportData)
            .enter()
            .append("circle")
            .attr("class", "opt-node")
            .attr("r", 4)
            .attr("cx", d => this.projection([d.lon, d.lat])[0])
            .attr("cy", d => this.projection([d.lon, d.lat])[1])
            .style("fill", d => {
                if (d.iata === origin) return "#ef4444";
                if (d.iata === destination) return "#22c55e";
                return "#6366f1";
            })
            .style("stroke", "#fff")
            .style("stroke-width", 1.5);
        
        // Havalimanı etiketlerini ekle
        this.nodesGroup.selectAll(".opt-node-label")
            .data(flightNetwork.airportData)
            .enter()
            .append("text")
            .attr("class", "opt-node-label")
            .attr("x", d => this.projection([d.lon, d.lat])[0])
            .attr("y", d => this.projection([d.lon, d.lat])[1] - 8)
            .text(d => d.iata)
            .style("font-size", "8px")
            .style("text-anchor", "middle")
            .style("pointer-events", "none");
    }

    // Graf budama animasyonu 
    // optimization-map.js - animateGraphPruning fonksiyonunu güncelleyin
async animateGraphPruning(prunedGraph, searchParams, optimizedRoutes) {
    this.animationInProgress = true;
    this.prunedGraph = prunedGraph;
    
    const flightNetwork = window.flightNetwork;
    const { origin, destination } = searchParams;
    
    try {
        // 1. Adım: Tüm ağı göster
        this.updateInfoMessage("Tüm Türkiye uçuş ağı gösteriliyor...");
        await this.drawInitialNetwork(flightNetwork);
        await this.delay(1500);

        // 2. Adım: Kullanılmayan havalimanlarını kademeli olarak kaldır
        this.updateInfoMessage("Kullanılmayan bağlantılar budanıyor...");
        await this.animateRemovingUnusedAirports(prunedGraph, flightNetwork);
        
        // 3. Adım: Budanmış grafı göster - OKLARLA BİRLİKTE
        this.updateInfoMessage("Optimize rotalar hesaplanıyor...");
        await this.delay(1000);
        
        // 4. Adım: Son budanmış grafı oklarla göster
        this.showPrunedGraphFinalWithArrows(prunedGraph, origin, destination, flightNetwork);
        await this.delay(1000);
        
        // 5. Adım: Optimize rotaları animasyonla göster
        this.updateInfoMessage("Optimize rotalar haritada gösteriliyor...");
        await this.animateOptimizedRoutes(optimizedRoutes, flightNetwork);
        
        // 6. Adım: Sonuçları göster
        this.updateInfoMessage("Optimizasyon tamamlandı! Butonlarla farklı rotaları görüntüleyin.");
        
    } catch (error) {
        console.error("Animasyon hatası:", error);
        this.updateInfoMessage("Animasyon sırasında hata oluştu");
    } finally {
        this.animationInProgress = false;
    }
}



showPrunedGraphFinalWithArrows(prunedGraph, origin, destination, flightNetwork) {
    // Önce TÜM önceki elemanları temizle
    this.linksGroup.selectAll("*").remove();
    this.nodesGroup.selectAll("*").remove();

    // Ok başı tanımlarını oluştur - DAHA KÜÇÜK BOYUTLAR
    const defs = this.svgGroup.select("defs");
    if (defs.empty()) {
        this.svgGroup.append("defs");
    }

    // ÇOK KÜÇÜK ok başı marker'ını tanımla
    defs.append("marker")
        .attr("id", "pruned-arrowhead")
        .attr("viewBox", "0 -2 4 4")  // ÇOK DAHA KÜÇÜK viewBox
        .attr("refX", 4)              // DAHA KÜÇÜK refX
        .attr("refY", 0)
        .attr("markerWidth", 3)       // ÇOK DAHA KÜÇÜK genişlik
        .attr("markerHeight", 3)      // ÇOK DAHA KÜÇÜK yükseklik
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-2L4,0L0,2")   // ÇOK DAHA KÜÇÜK ok
        .attr("fill", "#6366f1")
        .style("opacity", 0.6);

    // Budanmış bağlantıları çiz
    const prunedLinks = this.getPrunedLinks(prunedGraph, flightNetwork);
    
    // Ana bağlantıları çiz - ÇOK İNCE ÇİZGİLER
    const links = this.linksGroup.selectAll(".link-pruned")
        .data(prunedLinks)
        .enter()
        .append("line")
        .attr("class", "link-pruned")
        .attr("x1", d => this.projection([d.sourceCoords.lon, d.sourceCoords.lat])[0])
        .attr("y1", d => this.projection([d.sourceCoords.lon, d.sourceCoords.lat])[1])
        .attr("x2", d => this.projection([d.targetCoords.lon, d.targetCoords.lat])[0])
        .attr("y2", d => this.projection([d.targetCoords.lon, d.targetCoords.lat])[1])
        .style("stroke", "#6366f1")
        .style("stroke-width", 1)     // ÇOK DAHA İNCE
        .style("opacity", 0)
        .style("marker-end", "url(#pruned-arrowhead)");

    // Bağlantıları animasyonla göster
    links.transition()
        .duration(800)
        .delay((d, i) => i * 100)
        .style("opacity", 0.6);

    // Kalan kod aynı...
    // Budanmış havalimanlarını çiz
    const prunedNodes = this.getPrunedNodes(prunedGraph, flightNetwork);
    
    const nodes = this.nodesGroup.selectAll(".node-pruned")
        .data(prunedNodes)
        .enter()
        .append("circle")
        .attr("class", "node-pruned")
        .attr("r", 0)
        .attr("cx", d => this.projection([d.lon, d.lat])[0])
        .attr("cy", d => this.projection([d.lon, d.lat])[1])
        .style("fill", d => {
            if (d.iata === origin) return "#ef4444";
            if (d.iata === destination) return "#22c55e";
            return "#6366f1";
        })
        .style("stroke", "#fff")
        .style("stroke-width", 1)     // DAHA İNCE
        .style("opacity", 0);

    // Havalimanlarını animasyonla göster
    nodes.transition()
        .duration(600)
        .delay((d, i) => i * 80 + 200)
        .attr("r", 4)   // DAHA KÜÇÜK node'lar
        .style("opacity", 1);

    // Havalimanı etiketlerini ekle
    const labels = this.nodesGroup.selectAll(".label-pruned")
        .data(prunedNodes)
        .enter()
        .append("text")
        .attr("class", "label-pruned")
        .attr("x", d => this.projection([d.lon, d.lat])[0])
        .attr("y", d => this.projection([d.lon, d.lat])[1] - 6)  // DAHA YAKIN
        .text(d => d.iata)
        .style("font-size", "8px")    // DAHA KÜÇÜK FONT
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .style("fill", "#1f2937")
        .style("opacity", 0);

    // Etiketleri animasyonla göster
    labels.transition()
        .duration(500)
        .delay((d, i) => i * 60 + 500)
        .style("opacity", 1);
}
// Bağlantıları hesaplama fonksiyonunu güncelleyin (çift yönlü oklar için)
getPrunedLinks(prunedGraph, flightNetwork) {
    const links = [];
    
    // Çift yönlü bağlantıları oluştur
    for (const source in prunedGraph) {
        for (const target in prunedGraph[source]) {
            const sourceCoords = flightNetwork.airportCoords[source];
            const targetCoords = flightNetwork.airportCoords[target];
            
            if (sourceCoords && targetCoords) {
                // Her iki yönde de bağlantı ekle
                links.push({
                    source: source,
                    target: target,
                    sourceCoords: sourceCoords,
                    targetCoords: targetCoords,
                    direction: 'forward'
                });
                
                // Ters yönde de bağlantı ekle (çift yönlü göstermek için)
                links.push({
                    source: target,
                    target: source,
                    sourceCoords: targetCoords,
                    targetCoords: sourceCoords,
                    direction: 'backward'
                });
            }
        }
    }
    
    console.log(`Budanmış bağlantı sayısı (çift yönlü): ${links.length}`);
    return links;
}

    // Kullanılmayan havalimanlarını kaldırma animasyonu 
    async animateRemovingUnusedAirports(prunedGraph, flightNetwork) {
        const usedAirports = new Set(Object.keys(prunedGraph));
        
        // Kullanılmayan havalimanlarını bul
        const unusedAirports = flightNetwork.airportData.filter(airport => 
            !usedAirports.has(airport.iata)
        );

        console.log(`Budanacak havalimanları: ${unusedAirports.length} adet`);
        console.log('Kullanılacak havalimanları:', Array.from(usedAirports));

        // Kademeli olarak kaldır
        for (const airport of unusedAirports) {
            // Havalimanını kaldır
            this.nodesGroup.selectAll(".node-initial")
                .filter(d => d.iata === airport.iata)
                .transition()
                .duration(200)
                .style("opacity", 0)
                .attr("r", 0)
                .remove();
                
            // Bu havalimanına ait bağlantıları da kaldır
            this.linksGroup.selectAll(".link-initial")
                .filter(d => d.source === airport.iata || d.target === airport.iata)
                .transition()
                .duration(200)
                .style("opacity", 0)
                .style("stroke-width", 0)
                .remove();
            
            await this.delay(30);
        }

        await this.delay(500);
    }

    // Son budanmış grafı göster
    showPrunedGraphFinal(prunedGraph, origin, destination, flightNetwork) {
        // Önce TÜM önceki elemanları temizle
        this.linksGroup.selectAll("*").remove();
        this.nodesGroup.selectAll("*").remove();

        // Budanmış bağlantıları çiz - SADECE PRUNED GRAPH'TAKİLER
        const prunedLinks = this.getPrunedLinks(prunedGraph, flightNetwork);
        
        console.log('Budanmış bağlantılar:', prunedLinks.length);
        
        this.linksGroup.selectAll(".link-pruned")
            .data(prunedLinks)
            .enter()
            .append("line")
            .attr("class", "link-pruned")
            .attr("x1", d => this.projection([d.sourceCoords.lon, d.sourceCoords.lat])[0])
            .attr("y1", d => this.projection([d.sourceCoords.lon, d.sourceCoords.lat])[1])
            .attr("x2", d => this.projection([d.targetCoords.lon, d.targetCoords.lat])[0])
            .attr("y2", d => this.projection([d.targetCoords.lon, d.targetCoords.lat])[1])
            .style("stroke", "#6366f1")
            .style("stroke-width", 2)
            .style("opacity", 0.6);

        // Budanmış havalimanlarını çiz - SADECE PRUNED GRAPH'TAKİLER
        const prunedNodes = this.getPrunedNodes(prunedGraph, flightNetwork);
        
        console.log('Budanmış havalimanları:', prunedNodes.length);
        
        this.nodesGroup.selectAll(".node-pruned")
            .data(prunedNodes)
            .enter()
            .append("circle")
            .attr("class", "node-pruned")
            .attr("r", 6)
            .attr("cx", d => this.projection([d.lon, d.lat])[0])
            .attr("cy", d => this.projection([d.lon, d.lat])[1])
            .style("fill", d => {
                if (d.iata === origin) return "#ef4444";
                if (d.iata === destination) return "#22c55e";
                return "#6366f1";
            })
            .style("stroke", "#fff")
            .style("stroke-width", 2)
            .style("opacity", 1);

        // Havalimanı etiketlerini ekle - SADECE PRUNED GRAPH'TAKİLER
        this.nodesGroup.selectAll(".label-pruned")
            .data(prunedNodes)
            .enter()
            .append("text")
            .attr("class", "label-pruned")
            .attr("x", d => this.projection([d.lon, d.lat])[0])
            .attr("y", d => this.projection([d.lon, d.lat])[1] - 10)
            .text(d => d.iata)
            .style("font-size", "10px")
            .style("text-anchor", "middle")
            .style("font-weight", "bold")
            .style("fill", "#1f2937")
            .style("opacity", 1);
    }

    // Optimize rotaları animasyonla göster 

async animateOptimizedRoutes(optimizedRoutes, flightNetwork) {
    const routeTypes = ['cheapest', 'fastest', 'earliest', 'balanced'];
    const colors = {
        'cheapest': '#10b981',
        'fastest': '#3b82f6', 
        'earliest': '#f59e0b',
        'balanced': '#8b5cf6'
    };

    // Her rota tipi için marker oluştur
    const defs = this.svgGroup.select("defs");
    routeTypes.forEach(routeType => {
        const markerId = `optimized-arrow-${routeType}`;
        defs.append("marker")
            .attr("id", markerId)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 8)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", colors[routeType])
            .style("opacity", 0.9);
    });

    // Tüm rotaları geçici olarak göster
    for (const routeType of routeTypes) {
        const route = optimizedRoutes[routeType];
        if (route && route.path) {
            await this.animateSingleRouteWithArrows(route, routeType, flightNetwork, colors[routeType]);
            await this.delay(800);
            
            // Geçici rotayı kaldır (son gösterilen hariç)
            if (routeType !== 'cheapest') {
                this.routeGroup.selectAll(`.route-${routeType}`)
                    .transition()
                    .duration(300)
                    .style("opacity", 0)
                    .remove();
            }
        }
    }
}

async animateSingleRouteWithArrows(route, routeType, flightNetwork, color) {
    const path = route.path || [];
    
    if (path.length < 2) return;

    const markerId = `optimized-arrow-${routeType}`;

    for (let i = 0; i < path.length - 1; i++) {
        const source = path[i];
        const target = path[i+1];
        
        const sourceCoords = flightNetwork.airportCoords[source];
        const targetCoords = flightNetwork.airportCoords[target];
        
        if (!sourceCoords || !targetCoords) continue;
        
        const x1 = this.projection([sourceCoords.lon, sourceCoords.lat])[0];
        const y1 = this.projection([sourceCoords.lon, sourceCoords.lat])[1];
        const x2 = this.projection([targetCoords.lon, targetCoords.lat])[0];
        const y2 = this.projection([targetCoords.lon, targetCoords.lat])[1];
        
        // Ana çizgiyi çiz - DAHA İNCE
        const line = this.routeGroup.append("line")
            .attr("class", `route-line route-${routeType}`)
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x1)
            .attr("y2", y1)
            .style("stroke", color)
            .style("stroke-width", 2.5)   // DAHA İNCE
            .style("opacity", 0.9)
            .style("marker-end", `url(#${markerId})`)
            .style("z-index", 1000);

        // Çizgiyi animasyonla uzat
        line.transition()
            .duration(1000)
            .ease(d3.easeCubicInOut)
            .attr("x2", x2)
            .attr("y2", y2);

        await this.delay(300);
    }
}
    // Normal rota gösterimi (butonlarla değiştirmek için) 
    showRoute(routeType) {
        if (this.animationInProgress) return;
        
        // Önceki rotayı temizle
        this.clearCurrentRoute();
        
        // Buton durumlarını güncelle
        this.updateButtonStates(routeType);
        
        const route = this.optimizedRoutes[routeType];
        if (!route) {
            this.updateInfoMessage(`${this.getRouteTypeName(routeType)} rotası bulunamadı.`);
            return;
        }
        
        this.currentRoute = route;
        this.currentRouteType = routeType;
        
        // Rotayı çiz - SADECE BUDANMIŞ GRAF ÜZERİNDE
        this.drawRouteOnPrunedGraph(route, routeType);
        
        // Bilgi mesajını güncelle
        this.showRouteInfo(route, routeType);
    }
    
   // optimization-map.js - drawRouteOnPrunedGraph fonksiyonunu güncelleyin
drawRouteOnPrunedGraph(route, routeType) {
    const flightNetwork = window.flightNetwork;
    const path = route.path || [];
    
    if (path.length < 2) return;

    // Önceki rotayı temizle
    this.routeGroup.selectAll("*").remove();

    // Tüm olası rotaları silik göster VE OKLARI GİZLE
    this.linksGroup.selectAll(".link-pruned")
        .style("opacity", 0.2)
        .style("stroke-width", 0.8)
        .style("marker-end", "none");

    // Optimize rota için marker oluştur - showPrunedGraphFinalWithArrows ile AYNI BOYUTLAR
    const defs = this.svgGroup.select("defs");
    const markerId = `optimized-arrow-${routeType}`;
    
    // Eski marker'ı temizle ve yenisi oluştur
    defs.select(`#${markerId}`).remove();
    defs.append("marker")
        .attr("id", markerId)
        .attr("viewBox", "0 -5 10 10")  // showPrunedGraphFinalWithArrows ile AYNI
        .attr("refX", 8)                // showPrunedGraphFinalWithArrows ile AYNI
        .attr("refY", 0)
        .attr("markerWidth", 6)         // showPrunedGraphFinalWithArrows ile AYNI
        .attr("markerHeight", 6)        // showPrunedGraphFinalWithArrows ile AYNI
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")   // showPrunedGraphFinalWithArrows ile AYNI
        .attr("fill", this.getRouteColor(routeType))
        .style("opacity", 0.9);

    // Seçilen rotayı belirgin göster
    for (let i = 0; i < path.length - 1; i++) {
        const source = path[i];
        const target = path[i+1];
        
        const sourceCoords = flightNetwork.airportCoords[source];
        const targetCoords = flightNetwork.airportCoords[target];
        
        if (!sourceCoords || !targetCoords) continue;
        
        const x1 = this.projection([sourceCoords.lon, sourceCoords.lat])[0];
        const y1 = this.projection([sourceCoords.lon, sourceCoords.lat])[1];
        const x2 = this.projection([targetCoords.lon, targetCoords.lat])[0];
        const y2 = this.projection([targetCoords.lon, targetCoords.lat])[1];
        
        // Ana çizgiyi çiz
        const line = this.routeGroup.append("line")
            .attr("class", `route-line route-${routeType}`)
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2)
            .style("stroke", this.getRouteColor(routeType))
            .style("stroke-width", 3)   // Çizgi kalınlığını biraz artırdım
            .style("opacity", 0.9)
            .style("marker-end", `url(#${markerId})`)
            .style("z-index", 1000);
    }
    
    // Havalimanı vurgulama
    path.forEach((airportIata, index) => {
        if (this.prunedGraph && this.prunedGraph[airportIata]) {
            const nodeSelection = this.nodesGroup.selectAll(".node-pruned")
                .filter(d => d.iata === airportIata);
            
            nodeSelection
                .transition()
                .duration(500)
                .attr("r", 6)
                .style("fill", this.getNodeColor(index, path.length))
                .style("stroke", "#fff")
                .style("stroke-width", 2);
        }
    });

    // Diğer havalimanlarını normal göster
    this.nodesGroup.selectAll(".node-pruned")
        .filter(d => !path.includes(d.iata))
        .transition()
        .duration(500)
        .attr("r", 4)
        .style("fill", d => {
            if (d.iata === this.searchParams.origin) return "#ef4444";
            if (d.iata === this.searchParams.destination) return "#22c55e";
            return "#6366f1";
        })
        .style("stroke-width", 1);
}
clearCurrentRoute() {
    // Rota çizgilerini kaldır
    this.routeGroup.selectAll("*").remove();
    
    if (!window.flightNetwork || !this.searchParams || !this.prunedGraph) return;
    
    // Tüm bağlantıları normal opaklığa getir VE OKLARI GERİ GETİR
    this.linksGroup.selectAll(".link-pruned")
        .style("opacity", 0.6)
        .style("stroke-width", 1)     // DAHA İNCE
        .style("marker-end", "url(#pruned-arrowhead)");
    
    // Tüm havalimanlarını normal görünüme getir
    this.nodesGroup.selectAll(".node-pruned")
        .attr("r", 4)   // DAHA KÜÇÜK
        .style("stroke-width", 1)     // DAHA İNCE
        .style("fill", d => {
            if (d.iata === this.searchParams.origin) return "#ef4444";
            if (d.iata === this.searchParams.destination) return "#22c55e";
            return "#6366f1";
        });
}
// Rota renklerini güncelle - GÜNCELLENMİŞ
getRouteColor(routeType) {
    const colors = {
        'cheapest': '#10b981', // Yeşil
        'fastest': '#3b82f6',  // Mavi
        'earliest': '#f59e0b', // Turuncu
        'balanced': '#8b5cf6'  // Mor
    };
    return colors[routeType] || '#10b981';
}
    clearMap() {
        this.clearCurrentRoute();
        this.currentRoute = null;
        this.currentRouteType = null;
        this.prunedGraph = null;
        
        // Tüm grupları temizle
        this.linksGroup.selectAll("*").remove();
        this.nodesGroup.selectAll("*").remove();
        this.routeGroup.selectAll("*").remove();
        this.animationGroup.selectAll("*").remove();
        
        // Buton durumlarını sıfırla
        this.updateButtonStates(null);
        
        this.updateInfoMessage("Optimize rotalar bulunduktan sonra burada görselleştirilecek");
    }


    // optimization-map.js - getPrunedLinks fonksiyonunu güncelleyin
getPrunedLinks(prunedGraph, flightNetwork) {
    const links = [];
    
    // TEK YÖNLÜ BAĞLANTILARI OLUŞTUR (daha temiz görünüm için)
    for (const source in prunedGraph) {
        for (const target in prunedGraph[source]) {
            // Sadece source < target durumunda ekle (çift yönlü görünümü önle)
            if (source < target) {
                const sourceCoords = flightNetwork.airportCoords[source];
                const targetCoords = flightNetwork.airportCoords[target];
                
                if (sourceCoords && targetCoords) {
                    links.push({
                        source: source,
                        target: target,
                        sourceCoords: sourceCoords,
                        targetCoords: targetCoords
                    });
                }
            }
        }
    }
    
    console.log(`Budanmış bağlantı sayısı (tek yönlü): ${links.length}`);
    return links;
}
    getPrunedNodes(prunedGraph, flightNetwork) {
        const nodes = [];
        for (const iata in prunedGraph) {
            const airport = flightNetwork.airportData.find(a => a.iata === iata);
            if (airport) {
                nodes.push(airport);
            }
        }
        console.log(`Budanmış havalimanı sayısı: ${nodes.length}`);
        return nodes;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    updateButtonStates(activeType) {
        document.querySelectorAll('.route-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (activeType) {
            const activeButton = document.getElementById(`show-${activeType}-route`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
    }
    
    getRouteTypeName(routeType) {
        const names = {
            'cheapest': 'En Ucuz',
            'fastest': 'En Hızlı',
            'earliest': 'En Erken Varış',
            'balanced': 'Dengeli'
        };
        return names[routeType] || routeType;
    }
    
    getRouteColor(routeType) {
        const colors = {
            'cheapest': '#10b981',
            'fastest': '#3b82f6',
            'earliest': '#f59e0b',
            'balanced': '#8b5cf6'
        };
        return colors[routeType] || '#10b981';
    }
    
    getNodeColor(index, totalLength) {
        if (index === 0) return "#ef4444";
        if (index === totalLength - 1) return "#22c55e";
        return "#f59e0b";
    }
    
    // optimization-map.js içinde
showRouteInfo(route, routeType) {
    const flightNetwork = window.flightNetwork;
    const path = route.path || [];
    
    let info = `<strong>${this.getRouteTypeName(routeType)} Rota</strong><br>`;
    info += `<strong style="color: ${this.getRouteColor(routeType)}">Rota:</strong> ${path.join(' → ')}<br>`;
    
    if (route.summary) {
        info += `<strong>Fiyat:</strong> ${route.summary.price} ${route.summary.currency}<br>`;
        info += `<strong>Süre:</strong> ${Math.floor(route.summary.duration/60)}s ${route.summary.duration%60}d<br>`;
        info += `<strong>Aktarma:</strong> ${route.summary.transferCount}<br>`;
        
        const arrivalTime = route.summary.arrivalTime.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        info += `<strong>Varış:</strong> ${arrivalTime}`;
    }
    

    
    this.updateInfoMessage(info);
}
    
    updateInfoMessage(message) {
        const infoElement = document.getElementById('optimization-info');
        if (infoElement) {
            infoElement.innerHTML = message;
        }
    }


    async loadTurkeyMap() {
        try {
            const turkey = await d3.json("https://raw.githubusercontent.com/cihadturhan/tr-geojson/master/geo/tr-cities-utf8.json");
            this.drawTurkeyMap(turkey);
        } catch (error) {
            console.error("Harita yüklenirken hata oluştu:", error);
            this.drawBackground();
        }
    }
    
    drawTurkeyMap(turkey) {
        const path = d3.geoPath().projection(this.projection);
        
        this.mapGroup.selectAll(".province")
            .data(turkey.features)
            .enter()
            .append("path")
            .attr("class", "province")
            .attr("d", path)
            .style("fill", "#f8f9fa")
            .style("stroke", "#cececeff")
            .style("stroke-width", 0.5);
    }
    
    drawBackground() {
        this.mapGroup.append("rect")
            .attr("width", this.width)
            .attr("height", this.height)
            .style("fill", "#f8f9fa")
            .style("stroke", "#e5e7eb")
            .style("stroke-width", 1);
    }

    async drawInitialNetwork(flightNetwork) {
        // Tüm havalimanlarını göster
        this.nodesGroup.selectAll(".node-initial")
            .data(flightNetwork.airportData)
            .enter()
            .append("circle")
            .attr("class", "node-initial")
            .attr("r", 3)
            .attr("cx", d => this.projection([d.lon, d.lat])[0])
            .attr("cy", d => this.projection([d.lon, d.lat])[1])
            .style("fill", "#94a3b8")
            .style("stroke", "#fff")
            .style("stroke-width", 1)
            .style("opacity", 0)
            .transition()
            .duration(800)
            .style("opacity", 0.7);

        // Tüm bağlantıları göster
        this.linksGroup.selectAll(".link-initial")
            .data(flightNetwork.links)
            .enter()
            .append("line")
            .attr("class", "link-initial")
            .attr("x1", d => this.projection([flightNetwork.airportCoords[d.source].lon, flightNetwork.airportCoords[d.source].lat])[0])
            .attr("y1", d => this.projection([flightNetwork.airportCoords[d.source].lon, flightNetwork.airportCoords[d.source].lat])[1])
            .attr("x2", d => this.projection([flightNetwork.airportCoords[d.target].lon, flightNetwork.airportCoords[d.target].lat])[0])
            .attr("y2", d => this.projection([flightNetwork.airportCoords[d.target].lon, flightNetwork.airportCoords[d.target].lat])[1])
            .style("stroke", "#cbd5e1")
            .style("stroke-width", 1)
            .style("opacity", 0)
            .transition()
            .duration(800)
            .delay(200)
            .style("opacity", 0.3);

        await this.delay(1000);
    }

// optimization-map.js - animateSingleRouteWithArrows fonksiyonunu da güncelleyin
async animateSingleRouteWithArrows(route, routeType, flightNetwork, color) {
    const path = route.path || [];
    
    if (path.length < 2) return;

    const markerId = `optimized-arrow-${routeType}`;

    for (let i = 0; i < path.length - 1; i++) {
        const source = path[i];
        const target = path[i+1];
        
        const sourceCoords = flightNetwork.airportCoords[source];
        const targetCoords = flightNetwork.airportCoords[target];
        
        if (!sourceCoords || !targetCoords) continue;
        
        const x1 = this.projection([sourceCoords.lon, sourceCoords.lat])[0];
        const y1 = this.projection([sourceCoords.lon, sourceCoords.lat])[1];
        const x2 = this.projection([targetCoords.lon, targetCoords.lat])[0];
        const y2 = this.projection([targetCoords.lon, targetCoords.lat])[1];
        
        // Ana çizgiyi çiz
        const line = this.routeGroup.append("line")
            .attr("class", `route-line route-${routeType}`)
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x1)
            .attr("y2", y1)
            .style("stroke", color)
            .style("stroke-width", 3)   // Çizgi kalınlığını artırdım
            .style("opacity", 0.9)
            .style("marker-end", `url(#${markerId})`)
            .style("z-index", 1000);

        // Çizgiyi animasyonla uzat
        line.transition()
            .duration(1000)
            .ease(d3.easeCubicInOut)
            .attr("x2", x2)
            .attr("y2", y2);

        await this.delay(300);
    }
}
    // optimization-map.js içinde buton kontrolleri
initializeControls() {
    const buttons = [
        'show-cheapest-route',
        'show-fastest-route', 
        'show-earliest-route',
        'show-balanced-route',
    ];
    
    buttons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', () => {
                const routeType = buttonId.replace('show-', '').replace('-route', '');
                this.showRoute(routeType);
                
                // Buton durumlarını güncelle
                document.querySelectorAll('.route-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
            });
        }
    });
}
}