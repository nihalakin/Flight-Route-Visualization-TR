// Ana uygulama dosyası

// Havalimanı verileri
const airportData = [
    {city: "Ankara", icao: "LTAC", iata: "ESB", name: "Ankara Esenboğa Havalimanı", type: "Sivil", year: 1955, lat: 40.1281, lon: 32.9950, flights: "IST;SAW;TEQ;CKZ;EDO;ADB;BJV;DLM;AYT;GZP;COV;HTY;GZT;KCM;GNY;ADF;MLX;DIY;NKT;BAL;EZS;YKO;BGG;MSR;VAN;ERC;AJI;IGD;KSY;RZV;TZX;OGU;SZF;MQM;SXZ;ERZ"},
    {city: "Antalya", icao: "LTAI", iata: "AYT", name: "Antalya Havalimanı", type: "Sivil/Askerî", year: 1960, lat: 36.9003, lon: 30.7928, flights: "IST;SAW;ADB;ESB;BAL;SZF;TZX;RZV;ASR;ERZ;EZS;MSR;VAN;DIY;GNY;MQM;GZT;COV"},
    {city: "Alanya", icao: "LTFG", iata: "GZP", name: "Gazipaşa Havalimanı", type: "Sivil", year: 2009, lat: 36.2992, lon: 32.3014, flights: "IST;SAW;ESB"},
    {city: "Balıkesir", icao: "LTFD", iata: "EDO", name: "Balıkesir Koca Seyit Havalimanı", type: "Sivil", year: 1997, lat: 39.5525, lon: 27.0103, flights: "IST;SAW;ESB"},
    {city: "Bursa", icao: "LTBR", iata: "YEI", name: "Bursa Yenişehir Havalimanı", type: "Sivil/Askerî", year: 2000, lat: 40.2558, lon: 29.5620, flights: "DIY;MSR;ERZ;TZX"},
    {city: "Çanakkale", icao: "LTBH", iata: "CKZ", name: "Çanakkale Havalimanı", type: "Sivil/Askerî", year: 1995, lat: 40.1375, lon: 26.4308, flights: "ESB"},
    {city: "Denizli", icao: "LTAY", iata: "DNZ", name: "Denizli Çardak Havalimanı", type: "Sivil/Askerî", year: 1991, lat: 37.7878, lon: 29.7050, flights: "IST;SAW"},
    {city: "Diyarbakır", icao: "LTCC", iata: "DIY", name: "Diyarbakır Havalimanı", type: "Sivil/Askerî", year: 1952, lat: 37.9011, lon: 40.1858, flights: "IST;SAW;TZX;ESB;YEI;ADB;AYT"},
    {city: "Elazığ", icao: "LTCA", iata: "EZS", name: "Elazığ Havalimanı", type: "Sivil/Askerî", year: 1940, lat: 38.5975, lon: 39.2814, flights: "IST;SAW;ESB;ADB;AYT"},
    {city: "Erzurum", icao: "LTCE", iata: "ERZ", name: "Erzurum Havalimanı", type: "Sivil/Askerî", year: 1966, lat: 39.9558, lon: 41.1706, flights: "IST;SAW;ESB;ADB;AYT;YEI"},
    {city: "Eskişehir", icao: "LTBY", iata: "AOE", name: "Hasan Polatkan Havalimanı", type: "Sivil", year: 1989, lat: 39.8125, lon: 30.5281, flights: ""},
    {city: "Gaziantep", icao: "LTAJ", iata: "GZT", name: "Gaziantep Havalimanı", type: "Sivil", year: 1976, lat: 36.9478, lon: 37.4789, flights: "IST;SAW;ESB;ADB;AYT;TZX"},
    {city: "Hatay", icao: "LTDA", iata: "HTY", name: "Hatay Havalimanı", type: "Sivil", year: 2007, lat: 36.3722, lon: 36.2986, flights: "IST;SAW;ESB;ADB"},
    {city: "Isparta", icao: "LTFC", iata: "ISE", name: "Isparta Süleyman Demirel Havalimanı", type: "Sivil", year: 1997, lat: 37.8558, lon: 30.3669, flights: "IST"},
    {city: "İstanbul", icao: "LTFM", iata: "IST", name: "İstanbul Havalimanı", type: "Sivil", year: 2018, lat: 41.2608, lon: 28.7422, flights: "NOP;ONQ;SZF;KFS;OGU;EDO;ADB;BJV;DLM;AYT;GZP;COV;HTY;GZT;KCM;GNY;ADF;MLX;DIY;NKT;BAL;EZS;YKO;BGG;MSR;VAN;ERC;AJI;IGD;KSY;RZV;TZX;SXZ;MQM;KYA;MZH;DNZ;NAV;ASR;TJK;VAS;ERZ;ESB;ISE;KZR"},
    {city: "İstanbul", icao: "LTFJ", iata: "SAW", name: "Sabiha Gökçen Havalimanı", type: "Sivil", year: 2001, lat: 40.8942, lon: 29.3083, "flights": "NOP;EDO;ADB;BJV;DLM;AYT;GZP;COV;HTY;GZT;KCM;GNY;ADF;MLX;DIY;NKT;BAL;EZS;BGG;MSR;VAN;ERC;AJI;IGD;KSY;RZV;TZX;OGU;SZF;MQM;DNZ;ESB;MZH;NAV;ASR;VAS;TJK;ERZ;KYA"},
    {city: "İzmir", icao: "LTBJ", iata: "ADB", name: "Adnan Menderes Havalimanı", type: "Sivil", year: 1987, lat: 38.2892, lon: 27.1550, flights: "IST;SAW;SZF;ESB;TZX;OGU;RZV;KSY;VAS;ERZ;AJI;MSR;EZS;VAN;MLX;BAL;DIY;GNY;MQM;GZT;HTY;COV;AYT;ASR;KYA;NAV"},
    {city: "Kars", icao: "LTCF", iata: "KSY", name: "Kars Harakani Havalimanı", type: "Sivil", year: 1988, lat: 40.5622, lon: 43.1147, flights: "ADB;ESB;IST;SAW"},
    {city: "Kayseri", icao: "LTAU", iata: "ASR", name: "Erkilet Havalimanı", type: "Sivil/Askerî", year: 1998, lat: 38.7703, lon: 35.4953, flights: "IST;SAW;ADB;AYT"},
    {city: "Konya", icao: "LTAN", iata: "KYA", name: "Konya Havalimanı", type: "Sivil/Askerî", year: 2000, lat: 37.9806, lon: 32.5625, flights: "IST;SAW;ADB"},
    {city: "Kütahya", icao: "LTBZ", iata: "KZR", name: "Zafer Havalimanı", type: "Sivil", year: 2012, lat: 39.1114, lon: 30.1300, flights: "IST"},
    {city: "Malatya", icao: "LTAT", iata: "MLX", name: "Malatya Havalimanı", type: "Sivil/Askerî", year: 1941, lat: 38.4322, lon: 38.0831, flights: "IST;SAW;ESB;ADB"},
    {city: "Muğla", icao: "LTBS", iata: "DLM", name: "Dalaman Havalimanı", type: "Sivil/Askerî", year: 1981, lat: 36.7125, lon: 28.7914, flights: "IST;SAW;ESB;AYT;BJV"},
    {city: "Muğla", icao: "LTFE", iata: "BJV", name: "Milas-Bodrum Havalimanı", type: "Sivil/Askerî", year: 1998, lat: 37.2494, lon: 27.6647, flights: "IST;SAW;ESB;COV;AYT;DLM"},
    {city: "Mersin", icao: "LTDB", iata: "COV", name: "Çukurova Uluslararası Havalimanı", type: "Sivil", year: 2024, lat: 36.8996, lon: 35.0628, flights: "IST;SAW;ESB;ADB;BJV;AYT;TZX;VAN"},
    {city: "Nevşehir", icao: "LTAZ", iata: "NAV", name: "Nevşehir Kapadokya Havalimanı", type: "Sivil", year: 1998, lat: 38.7753, lon: 34.5267, flights: "IST;SAW;ADB"},
    {city: "Ordu-Giresun", icao: "LTCB", iata: "OGU", name: "Ordu-Giresun Havalimanı", type: "Sivil", year: 2015, lat: 40.9672, lon: 38.0819, flights: "IST;SAW;ADB;ESB"},
    {city: "Rize-Artvin", icao: "LTFO", iata: "RZV", name: "Rize-Artvin Havalimanı", type: "Sivil", year: 2022, lat: 41.1692, lon: 40.8289, flights: "IST;SAW;AYT;ADB;ESB"},
    {city: "Samsun", icao: "LTFH", iata: "SZF", name: "Samsun Çarşamba Havalimanı", type: "Sivil", year: 1998, lat: 41.2656, lon: 36.5486, flights: "IST;SAW;AYT;ADB;ESB"},
    {city: "Sinop", icao: "LTCM", iata: "NOP", name: "Sinop Havalimanı", type: "Sivil", year: 1993, lat: 42.0158, lon: 35.0664, flights: "IST;SAW"},
    {city: "Sivas", icao: "LTAR", iata: "VAS", name: "Sivas Nuri Demirağ Havalimanı", type: "Sivil", year: 1957, lat: 39.8142, lon: 36.9025, flights: "IST;SAW;ADB"},
    {city: "Şanlıurfa", icao: "LTCS", iata: "GNY", name: "Şanlıurfa GAP Havalimanı", type: "Sivil", year: 2007, lat: 37.4567, lon: 38.9083, flights: "IST;SAW;ESB;ADB;AYT"},
    {city: "Tekirdağ", icao: "LTBU", iata: "TEQ", name: "Tekirdağ Çorlu Havalimanı", type: "Sivil/Askerî", year: 1998, lat: 41.1294, lon: 27.9064, flights: "ESB"},
    {city: "Trabzon", icao: "LTCG", iata: "TZX", name: "Trabzon Havalimanı", type: "Sivil", year: 1957, lat: 40.9958, lon: 39.7853, flights: "IST;SAW;YEI;ESB;ADB;AYT;COV;DIY;GZT"},
    {city: "Van", icao: "LTCI", iata: "VAN", name: "Van Ferit Melen Havalimanı", type: "Sivil/Askerî", year: 1943, lat: 38.4686, lon: 43.3319, flights: "IST;SAW;AYT;ADB;COV;ESB"},
    {city: "Zonguldak", icao: "LTAS", iata: "ONQ", name: "Zonguldak Havalimanı", type: "Sivil", year: 1999, lat: 41.5064, lon: 32.0886, flights: "IST"},
    {city: "Hakkari", icao: "YKO", iata: "YKO", name: "Hakkari Havalimanı", type: "Sivil", year: 1990, lat: 37.574, lon: 43.740, flights: "IST;ESB"},
    {city: "Siirt", icao: "SXZ", iata: "SXZ", name: "Siirt Havalimanı", type: "Sivil", year: 1990, lat: 37.933, lon: 41.966, flights: "IST;ESB"},
    {city: "Şırnak", icao: "GNY", iata: "NKT", name: "Şırnak Havalimanı", type: "Sivil", year: 2007, lat: 37.454, lon: 42.481, flights: "IST;SAW;ESB"},
    {city: "Bingöl", icao: "BGG", iata: "BGG", name: "Bingöl Havalimanı", type: "Sivil", year: 2009, lat: 38.8850, lon: 40.4961, flights: "IST;SAW;ESB"},
    {city: "Batman", icao: "BAL", iata: "BAL", name: "Batman Havalimanı", type: "Sivil", year: 1997, lat: 37.9333, lon: 41.1167, flights: "IST;SAW;ESB;ADB;AYT"},
    {city: "Amasya", icao: "MZH", iata: "MZH", name: "Amasya Merzifon Havalimanı", type: "Sivil", year: 1995, lat: 40.8267, lon: 35.4972, flights: "IST;SAW"},
    {city: "Erzincan", icao: "ERC", iata: "ERC", name: "Erzincan Havalimanı", type: "Sivil", year: 1940, lat: 39.7500, lon: 39.5000, flights: "IST;SAW;ESB"},
    {city: "Tokat", icao: "LTAW", iata: "TJK", name: "Tokat Havalimanı", type: "Sivil", year: null, lat: 40.3117, lon: 36.3736, flights: "IST;SAW"},
    {city: "Kahramanmaraş", icao: "LTCN", iata: "KCM", name: "Kahramanmaraş Havalimanı", type: "Sivil", year: null, lat: 37.5383, lon: 36.9519, flights: "IST;SAW;ESB"},
{city: "Iğdır", icao: "LTCT", iata: "IGD", name: "Iğdır Şehit Bülent Aydın Havalimanı", type: "Sivil", year: 2012, lat: 39.8889, lon: 44.0333, flights: "IST;SAW;ESB"},
{city: "Adıyaman", icao: "LTCP", iata: "ADF", name: "Adıyaman Havalimanı", type: "Sivil", year: 1998, lat: 37.7314, lon: 38.4689, flights: "IST;SAW;ESB"},  
{city: "Mardin", icao: "LTCR", iata: "MQM", name: "Mardin Prof. Dr. Aziz Sancar Havalimanı", type: "Sivil", year: 1999, lat: 37.2233, lon: 40.6317, flights: "IST;SAW;ESB;AYT;ADB"},  
{city: "Muş", icao: "LTCK", iata: "MSR", name: "Muş Sultan Alparslan Havalimanı", type: "Sivil/Askeri", year: 1992, lat: 38.7447, lon: 41.6539, flights: "IST;SAW;ESB;AYT;ADB;YEI"},
{city: "Ağrı", icao: "LTCO", iata: "AJI", name: "Ağrı Ahmed‑i Hani Havalimanı", type: "Sivil", year: 1997, lat: 39.6544, lon: 43.0272, flights: "IST;SAW;ESB;ADB"},
{city: "Kastamonu", icao: "LTAL", iata: "KFS", name: "Kastamonu Havalimanı", type: "Sivil", year: 2013, lat: 41.3139, lon: 33.7950, flights: "IST"}


];

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
    // Uçuş ağı oluştur
    flightNetwork = new FlightNetwork(airportData);
    window.flightNetwork = flightNetwork; // Global erişim için
    
    // Görselleştirme oluştur
    visualization = new FlightVisualization();
    
    // Filtreleme oluştur
    flightFilter = new FlightFilter(flightNetwork, visualization);
    
    // Sesli komutlar oluştur
    voiceCommands = new VoiceCommands(flightNetwork, flightFilter);
    
    // Türkiye haritasını yükle ve çiz
    d3.json("https://raw.githubusercontent.com/cihadturhan/tr-geojson/master/geo/tr-cities-utf8.json").then(function(turkey) {
        visualization.drawTurkeyMap(turkey);
        visualization.drawAirports(flightNetwork.airportData, flightNetwork.flightCounts, flightNetwork.airportCoords, flightNetwork.links);
    }).catch(function(error) {
        console.error("Harita yüklenirken hata oluştu:", error);
        // Harita yüklenemezse bile havalimanlarını çiz
        visualization.drawAirports(flightNetwork.airportData, flightNetwork.flightCounts, flightNetwork.airportCoords, flightNetwork.links);
    });
});