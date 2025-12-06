// Sesli komut ve seslendirme işlemleri

class VoiceCommands {
    constructor(flightNetwork, flightFilter) {
        this.flightNetwork = flightNetwork;
        this.flightFilter = flightFilter;
        
        // Seslendirme ve ses tanıma desteği kontrolü
        this.speechSupported = 'speechSynthesis' in window;
        this.recognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        
        this.currentUtterance = null;
        this.recognition = null;
        this.isListening = false;
        
        this.initializeVoiceCommands();
    }
    
    initializeVoiceCommands() {
        if (!this.speechSupported) {
            console.warn("Tarayıcınız seslendirme özelliğini desteklemiyor");
        }
        
        if (!this.recognitionSupported) {
            console.warn("Tarayıcınız ses tanıma özelliğini desteklemiyor");
            document.getElementById("start-voice-command").disabled = true;
            document.getElementById("voice-command-status").textContent = 
                "Tarayıcınız sesli komutları desteklemiyor. Chrome veya Edge kullanmanızı öneririz.";
        }
        
        // Seslendirme butonları
        d3.select("#speak-airport-info").on("click", () => this.speakAirportInfo());
        d3.select("#speak-route-info").on("click", () => this.speakRouteInfo());
        d3.select("#speak-network-info").on("click", () => this.speakNetworkInfo());
        d3.select("#stop-speech").on("click", () => this.stopSpeech());
        d3.select("#start-voice-command").on("click", () => this.startVoiceRecognition());
    }
    
    // Geliştirilmiş şehir-IATA eşleştirme sözlüğü
    cityToIATA = {
        "adana": "ADA", "ankara": "ESB", "antalya": "AYT", "alanya": "GZP", "gazipaşa": "GZP", "gazipasa": "GZP",
        "balıkesir": "EDO", "balikesir": "EDO", "bursa": "YEI", "çanakkale": "CKZ", "canakkale": "CKZ",
        "denizli": "DNZ", "diyarbakır": "DIY", "diyarbakir": "DIY", "elazığ": "EZS", "elazig": "EZS",
        "erzurum": "ERZ", "eskişehir": "AOE", "eskisehir": "AOE", "gaziantep": "GZT", "hatay": "HTY",
        "isparta": "ISE", "istanbul": "IST", "sabiha": "SAW", "gökçen": "SAW", "gokcen": "SAW",
        "izmir": "ADB", "kars": "KSY", "kayseri": "ASR", "konya": "KYA", "kütahya": "KZR", "kutahya": "KZR",
        "malatya": "MLX", "muğla": "DLM", "mugla": "DLM", "dalaman": "DLM", "bodrum": "BJV", "milas": "BJV",
        "mersin": "COV", "çukurova": "COV", "cukurova": "COV", "nevşehir": "NAV", "nevsehir": "NAV",
        "kapadokya": "NAV", "ordu": "OGU", "giresun": "OGU", "rize": "RZV", "artvin": "RZV", "samsun": "SZF",
        "sinop": "NOP", "sivas": "VAS", "şanlıurfa": "GNY", "sanliurfa": "GNY", "tekirdağ": "TEQ", "tekirdag": "TEQ",
        "trabzon": "TZX", "van": "VAN", "zonguldak": "ONQ", "hakkari": "YKO", "siirt": "SXZ",
        "şırnak": "NKT", "sirnak": "NKT", "bingöl": "BGG", "bingol": "BGG", "batman": "BAL", "amasya": "MZH",
        "erzincan": "ERC", "tokat": "TJK", "kahramanmaraş": "KCM", "kahramanmaras": "KCM", "maras": "KCM"
    };
    
    // Metni seslendirme fonksiyonu
    speakText(text, rate = 1.0) {
        if (!this.speechSupported) {
            console.log("Seslendirme: " + text);
            return;
        }
        
        // Önceki seslendirmeyi durdur
        if (this.currentUtterance) {
            window.speechSynthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'tr-TR';
        utterance.rate = rate;
        
        this.currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    }
    
    // Seslendirmeyi durdur
    stopSpeech() {
        if (this.speechSupported) {
            window.speechSynthesis.cancel();
        }
        this.currentUtterance = null;
    }
    
    // Ses tanımayı başlat
    startVoiceRecognition() {
        if (!this.recognitionSupported) return;
        
        if (this.recognition && this.isListening) {
            this.stopVoiceRecognition();
            return;
        }
        
        // SpeechRecognition nesnesini oluştur
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Türkçe dilini kullan
        this.recognition.lang = 'tr-TR';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        
        this.recognition.onstart = () => {
            this.isListening = true;
            document.getElementById("start-voice-command").classList.add("active");
            document.getElementById("start-voice-command").textContent = "Dinleniyor...";
            document.getElementById("voice-command-status").textContent = 
                "Dinleniyor... Örnek: 'İstanbul'dan Konya'ya gitmek istiyorum'";
        };
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            document.getElementById("voice-command-status").textContent = 
                "Anlaşıldı: " + transcript;
            
            // Komutu işle
            this.processVoiceCommand(transcript);
        };
        
        this.recognition.onerror = (event) => {
            console.error("Ses tanıma hatası:", event.error);
            document.getElementById("voice-command-status").textContent = 
                "Hata: " + event.error + ". Tekrar deneyin.";
            this.stopVoiceRecognition();
        };
        
        this.recognition.onend = () => {
            this.stopVoiceRecognition();
        };
        
        this.recognition.start();
    }
    
    // Ses tanımayı durdur
    stopVoiceRecognition() {
        if (this.recognition) {
            this.recognition.stop();
        }
        this.isListening = false;
        document.getElementById("start-voice-command").classList.remove("active");
        document.getElementById("start-voice-command").textContent = "Sesli Komut Başlat";
    }
    
    // Sesli komutu işle
    processVoiceCommand(command) {
        console.log("Ham komut:", command);
        
        const cleanedCommand = cleanText(command);
        console.log("Temizlenmiş komut:", cleanedCommand);
        
        let fromCity = null;
        let toCity = null;
        
        // Geliştirilmiş desen eşleştirme
        const patterns = [
            /(.+?)\s*(?:dan|den|tan|ten)\s*(.+?)\s*(?:ya|ye|a|e)\s*(?:gitmek|uçmak|git|uç|istiyorum|istediğim)/i,
            /(.+?)\s*ile\s*(.+?)\s*(?:arasında|arasi|arasina)/i,
            /(.+?)\s*ve\s*(.+?)\s*(?:arası|arasi)/i,
            /(.+?)\s*(?:dan|den)\s*(.+?)\s*(?:varış|varis|gidiş|gidis)/i,
            /(.+?)\s*(?:kalkış|kalkis)\s*(.+?)\s*(?:varış|varis)/i
        ];
        
        for (const pattern of patterns) {
            const match = cleanedCommand.match(pattern);
            if (match && match[1] && match[2]) {
                fromCity = match[1].trim();
                toCity = match[2].trim();
                console.log("Eşleşen şehirler:", fromCity, "->", toCity);
                break;
            }
        }
        
        // Alternatif yaklaşım - kelime bazlı analiz
        if (!fromCity || !toCity) {
            const words = cleanedCommand.split(/\s+/);
            const keywords = ['dan', 'den', 'tan', 'ten', 'ile', 've', 'kalkış', 'kalkis', 'varış', 'varis'];
            
            let fromIndex = -1;
            let toIndex = -1;
            
            // "dan", "den" gibi ayraçları bul
            for (let i = 0; i < words.length; i++) {
                if (keywords.includes(words[i])) {
                    if (fromIndex === -1) {
                        fromIndex = i;
                    } else {
                        toIndex = i;
                        break;
                    }
                }
            }
            
            if (fromIndex > 0) {
                fromCity = words.slice(0, fromIndex).join(' ');
                if (toIndex > fromIndex) {
                    toCity = words.slice(fromIndex + 1, toIndex).join(' ');
                } else {
                    toCity = words.slice(fromIndex + 1).join(' ');
                    // "ya", "ye", "a", "e" gibi ekleri kaldır
                    toCity = toCity.replace(/\s+(ya|ye|a|e|gitmek|uçmak|git|uç|istiyorum)$/, '');
                }
            }
        }
        
        console.log("Bulunan şehirler:", fromCity, "->", toCity);
        
        // Şehir isimlerini IATA kodlarına çevir
        if (fromCity && toCity) {
            const fromIATA = this.findIATACode(fromCity);
            const toIATA = this.findIATACode(toCity);
            
            console.log("IATA kodları:", fromIATA, "->", toIATA);
            
            if (fromIATA && toIATA) {
                // Rotayı göster
                d3.select("#from-airport").property("value", fromIATA);
                d3.select("#to-airport").property("value", toIATA);
                this.flightFilter.showRoute();
                
                // Sesli onay
                const fromAirport = this.flightNetwork.getAirportByIata(fromIATA);
                const toAirport = this.flightNetwork.getAirportByIata(toIATA);
                this.speakText(`Tamam, ${fromAirport.city} şehrinden ${toAirport.city} şehrine olan rotayı gösteriyorum.`);
                return;
            }
        }
        
        // Hata durumu
        let errorMsg = "Komutu anlayamadım. ";
        if (!fromCity) errorMsg += "Kalkış şehrini bulamadım. ";
        if (!toCity) errorMsg += "Varış şehrini bulamadım. ";
        errorMsg += "Lütfen 'İstanbul'dan Konya'ya gitmek istiyorum' gibi bir komut söyleyin.";
        
        this.speakText(errorMsg);
        document.getElementById("voice-command-status").textContent = "Komut anlaşılamadı: " + command;
    }
    
    // Geliştirilmiş IATA kodu bulma fonksiyonu
    findIATACode(cityName) {
        const cleanedCity = cleanText(cityName);
        console.log("Aranan şehir:", cleanedCity);
        
        // Doğrudan eşleşme
        if (this.cityToIATA[cleanedCity]) {
            console.log("Doğrudan eşleşme:", this.cityToIATA[cleanedCity]);
            return this.cityToIATA[cleanedCity];
        }
        
        // Kısmi eşleşme - tüm olasılıkları kontrol et
        for (const [city, iata] of Object.entries(this.cityToIATA)) {
            if (cleanedCity.includes(city) || city.includes(cleanedCity)) {
                console.log("Kısmi eşleşme:", city, "->", iata);
                return iata;
            }
        }
        
        // Havalimanı verilerinde ara
        const airport = this.flightNetwork.airportData.find(a => {
            const cleanAirportCity = cleanText(a.city);
            return cleanAirportCity.includes(cleanedCity) || cleanedCity.includes(cleanAirportCity);
        });
        
        if (airport) {
            console.log("Havalimanı verisinde bulundu:", airport.iata);
            return airport.iata;
        }
        
        console.log("Şehir bulunamadı:", cleanedCity);
        return null;
    }
    
    // Seslendirme fonksiyonları
    speakAirportInfo() {
        if (!this.flightFilter.visualization.activeAirport) {
            alert("Lütfen önce bir havalimanı seçin.");
            return;
        }
        
        const airport = this.flightFilter.visualization.activeAirport;
        const destinations = airport.flights ? airport.flights.split(';').filter(dest => dest && this.flightNetwork.airportCoords[dest]) : [];
        
        let text = `${airport.name}, ${airport.city} şehrinde bulunuyor. `;
        text += `IATA kodu ${airport.iata}, ICAO kodu ${airport.icao}. `;
        text += `${airport.type} havalimanı. `;
        if (airport.year) {
            text += `${airport.year} yılında açılmış. `;
        }
        text += `${this.flightNetwork.flightCounts[airport.iata]} doğrudan uçuş noktası bulunuyor. `;
        
        if (destinations.length > 0) {
            text += `Doğrudan uçuş yapılan şehirler: `;
            destinations.forEach((dest, index) => {
                const distance = calculateDistance(
                    airport.lat, airport.lon,
                    this.flightNetwork.airportCoords[dest].lat, this.flightNetwork.airportCoords[dest].lon
                );
                text += `${this.flightNetwork.airportCoords[dest].city}, ${distance.toFixed(0)} kilometre uzaklıkta. `;
                if (index === 2 && destinations.length > 3) {
                    text += `ve ${destinations.length - 3} diğer şehir. `;
                    return;
                }
            });
        }
        
        this.speakText(text);
    }
    
    speakRouteInfo() {
        if (!this.flightFilter.currentRoute || this.flightFilter.currentRoute.length < 2) {
            alert("Gösterilen bir rota bulunmuyor.");
            return;
        }
        
        const fromAirport = this.flightNetwork.getAirportByIata(this.flightFilter.currentRoute[0]);
        const toAirport = this.flightNetwork.getAirportByIata(this.flightFilter.currentRoute[this.flightFilter.currentRoute.length - 1]);
        const totalDistance = calculateTotalDistance(this.flightFilter.currentRoute, this.flightNetwork.graph);
        
        let text = `Seçilen rota: ${fromAirport.city} şehrinden ${toAirport.city} şehrine. `;
        
        if (this.flightFilter.currentRoute.length === 2) {
            text += `Doğrudan uçuş mevcut. `;
        } else {
            const transfers = this.flightFilter.currentRoute.slice(1, -1);
            text += `Aktarmalı uçuş. Aktarma noktaları: `;
            transfers.forEach((transfer, index) => {
                text += `${this.flightNetwork.airportCoords[transfer].city}`;
                if (index < transfers.length - 1) {
                    text += `, `;
                }
            });
            text += `. `;
        }
        
        text += `Toplam mesafe: ${totalDistance.toFixed(0)} kilometre. `;
        text += `Toplam uçuş segmenti sayısı: ${this.flightFilter.currentRoute.length - 1}.`;
        
        this.speakText(text);
    }
    
    speakNetworkInfo() {
        const stats = this.flightNetwork.calculateNetworkStats();
        
        let text = `Türkiye uçuş ağı istatistikleri. `;
        text += `Toplam ${stats.totalAirports} havalimanı bulunuyor. `;
        text += `Toplam ${stats.totalConnections} bağlantı mevcut. `;
        text += `Toplam uçuş ağı uzunluğu ${stats.totalDistance.toFixed(0)} kilometre. `;
        text += `Ortalama bağlantı sayısı ${stats.averageConnections}. `;
        text += `En bağlantılı havalimanı ${stats.mostConnected.city}, ${this.flightNetwork.flightCounts[stats.mostConnected.iata]} bağlantı ile. `;
        text += `En az bağlantılı havalimanı ${stats.leastConnected.city}, ${this.flightNetwork.flightCounts[stats.leastConnected.iata]} bağlantı ile.`;
        
        this.speakText(text);
    }
}