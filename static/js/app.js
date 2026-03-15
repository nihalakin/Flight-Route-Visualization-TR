// Ana uygulama dosyası

// Havalimanı verileri (artık veritabanından yüklenecek)
let airportData = [];

async function loadAirportData() {
    try {
        const res = await fetch('/api/airports');
        if (!res.ok) {
            console.error('Havalimanları API isteği başarısız:', res.status);
            return;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
            airportData = data;
        }
    } catch (e) {
        console.error('Havalimanları API isteği sırasında hata:', e);
    }
}

// Global fonksiyon - Havalimanı detaylarını göster
function showAirportDetails(airport) {
    const airportInfo = d3.select("#airport-info");
    airportInfo.html("");
    
    // Havalimanı kartı
    const airportCard = airportInfo.append("div")
        .attr("class", "airport-card");
        
    airportCard.append("div")
        .attr("class", "airport-name")
        .text(airport.name);
        
    airportCard.append("div")
        .attr("class", "airport-code")
        .html(`<strong>Şehir:</strong> ${airport.city}<br>
               <strong>IATA Kodu:</strong> ${airport.iata}<br>
               <strong>ICAO Kodu:</strong> ${airport.icao}<br>
               <strong>Tür:</strong> ${airport.type}<br>
               <strong>Açılış Yılı:</strong> ${airport.year || "Bilinmiyor"}`);
               
    airportCard.append("div")
        .attr("class", "flight-count")
        .text(`Doğrudan Uçuş Noktaları: ${window.flightNetwork.flightCounts[airport.iata]}`);
        
    // Uçuş noktalarını listele
    if (airport.flights) {
        const destinations = airport.flights.split(';').filter(dest => dest && window.flightNetwork.airportCoords[dest]);
        if (destinations.length > 0) {
            const destinationsList = airportCard.append("div")
                .style("margin-top", "10px");
                
            destinationsList.append("div")
                .style("font-weight", "bold")
                .text("Doğrudan Uçuşlar:");
                
            destinations.forEach(dest => {
                const distance = calculateDistance(
                    airport.lat, airport.lon,
                    window.flightNetwork.airportCoords[dest].lat, window.flightNetwork.airportCoords[dest].lon
                );
                destinationsList.append("div")
                    .text(`• ${window.flightNetwork.airportCoords[dest].city} (${dest}) - ${distance.toFixed(0)} km`);
            });
        }
    }
}

// Uygulamayı başlat
let flightNetwork, visualization, flightFilter, voiceCommands;

// DOM yüklendikten sonra çalıştır
document.addEventListener('DOMContentLoaded', function() {
    // PDF oluşturma class'larını temizle (eğer kalıcı olarak kalmışsa)
    const navbar = document.querySelector('.navbar');
    const body = document.body;
    if (navbar && navbar.classList.contains('pdf-generating')) {
        navbar.classList.remove('pdf-generating');
    }
    if (body && body.classList.contains('pdf-generating')) {
        body.classList.remove('pdf-generating');
    }

    // Havalimanı verilerini veritabanından yükle ve ardından uçuş ağını başlat
    (async function initAirportsAndNetwork() {
        await loadAirportData();

        // Uçuş ağı oluştur (tüm sayfalarda: ana sayfa harita, rota sayfası kalkış/varış listesi için)
        if (typeof FlightNetwork !== 'undefined' && Array.isArray(airportData) && airportData.length > 0) {
            flightNetwork = new FlightNetwork(airportData);
            window.flightNetwork = flightNetwork; // Global erişim için
        }

        // Harita sayfasındaysa (index) görselleştirme ve haritayı yükle (sadece visualization.js yüklüyse)
        if (document.getElementById('map') && typeof FlightVisualization !== 'undefined' && flightNetwork) {
            try {
                visualization = new FlightVisualization();
                flightFilter = new FlightFilter(flightNetwork, visualization);
                voiceCommands = new VoiceCommands(flightNetwork, flightFilter);
                d3.json("https://raw.githubusercontent.com/cihadturhan/tr-geojson/master/geo/tr-cities-utf8.json").then(function(turkey) {
                    visualization.drawTurkeyMap(turkey);
                    visualization.drawAirports(flightNetwork.airportData, flightNetwork.flightCounts, flightNetwork.airportCoords, flightNetwork.links);
                }).catch(function(error) {
                    console.error("Harita yüklenirken hata oluştu:", error);
                    if (visualization) visualization.drawAirports(flightNetwork.airportData, flightNetwork.flightCounts, flightNetwork.airportCoords, flightNetwork.links);
                });
            } catch (e) {
                console.warn('Harita görselleştirmesi atlandı:', e);
            }
        }
    })();
// Ana uygulama başlatıcı
document.addEventListener('DOMContentLoaded', function() {
    // Navbar hamburger menü toggle
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    
    if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("active");
        });
        
        // Hamburger menü kapatma
        document.querySelectorAll(".nav-link").forEach(n => n.addEventListener("click", () => {
            hamburger.classList.remove("active");
            navMenu.classList.remove("active");
        }));
    }
    
    // Sayfalar arası geçiş
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetTab = this.getAttribute('data-tab');
            
            // Aktif linki güncelle
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // İlgili tab içeriğini göster
            tabContents.forEach(tab => {
                tab.classList.remove('active');
                if (tab.id === targetTab) {
                    tab.classList.add('active');
                }
            });
            
            // Tab değiştiğinde özel işlemler
            if (targetTab === 'havayolu-analiz') {
                // Havayolu analiz sayfasına geçildiğinde
                if (typeof window.airlineReviews === 'undefined') {
                    // AirlineReviews sınıfını global yap
                    window.airlineReviews = new AirlineReviews();
                }
            }
        });
    });
    
    // Başlangıçta ilk tab'ı göster
    if (navLinks.length > 0) {
        const firstTab = navLinks[0].getAttribute('data-tab');
        document.getElementById(firstTab)?.classList.add('active');
        navLinks[0].classList.add('active');
    }
});

});