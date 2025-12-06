from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# API anahtarları .env dosyasından alınacak
API_KEY = os.getenv('AMADEUS_API_KEY')
API_SECRET = os.getenv('AMADEUS_API_SECRET')

def get_access_token():
    """Amadeus API için access token al"""
    token_url = "https://test.api.amadeus.com/v1/security/oauth2/token"
    
    data = {
        "grant_type": "client_credentials",
        "client_id": API_KEY,
        "client_secret": API_SECRET
    }
    
    response = requests.post(token_url, data=data)
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        raise Exception(f"Token alma hatası: {response.status_code}")




@app.route('/api/flights', methods=['GET'])
def search_flights():
    """Uçuş arama endpoint'i"""
    try:
        # Query parametrelerini al
        origin = request.args.get('origin')
        destination = request.args.get('destination')
        departure_date = request.args.get('departureDate')
        adults = request.args.get('adults', 1)
        travel_class = request.args.get('travelClass', 'ECONOMY')  # Yeni parametre
        
        # Validasyon
        if not all([origin, destination, departure_date]):
            return jsonify({"error": "Eksik parametreler"}), 400
        
        # Access token al
        access_token = get_access_token()
        
        # Amadeus API'ye sorgu yap
        url = "https://test.api.amadeus.com/v2/shopping/flight-offers"
        headers = {"Authorization": f"Bearer {access_token}"}
        params = {
            "originLocationCode": origin,
            "destinationLocationCode": destination,
            "departureDate": departure_date,
            "adults": adults,
            "travelClass": travel_class,  # Yeni parametre
            "currencyCode": "TRY",
            "max": 10
        }
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({"error": f"API hatası: {response.status_code}"}), response.status_code
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint'i"""
    return jsonify({"status": "OK", "message": "Backend çalışıyor"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)