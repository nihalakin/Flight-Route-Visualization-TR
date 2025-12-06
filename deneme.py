import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

np.random.seed(42)
random.seed(42)

airlines = ["Turkish Airlines", "Pegasus", "AnadoluJet", "SunExpress", "AJet"]
cancellation_reasons = [
    "Yolcu isteği", "Sağlık sorunu", "Uçuş iptali", "Yanlış tarih seçimi",
    "Plan değişikliği", "Non-refundable bilet", "Hava koşulları", "Vize sorunu"
]

data = []
start_date = datetime(2023, 1, 1)
end_date = datetime(2027, 11, 30)

def random_pnr():
    return ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=6))

for _ in range(10):
    pnr = random_pnr()
    havayolu = random.choice(airlines)
    bilet_tutari = round(random.uniform(400, 8000), 2)
    
    if random.random() < 0.3:
        iade_tutari = 0.0
        iptal_nedeni = "Non-refundable bilet"
    else:
        iade_tutari = round(bilet_tutari * random.uniform(0.5, 1.0), 2)
        iptal_nedeni = random.choice([r for r in cancellation_reasons if r != "Non-refundable bilet"])
    
    # İade tarihini rastgele belirle
    random_days = random.randint(0, (end_date - start_date).days)
    iade_tarihi_dt = start_date + timedelta(days=random_days)
    iade_tarihi = iade_tarihi_dt.strftime("%Y-%m-%d")
    
    # Son kullanım tarihi: iade tarihinden 0 ila 365 gün sonrası
    # (örneğin kredi bakiyesinin son kullanım tarihi gibi)
    max_future_days = 365
    son_kullanim_gun = random.randint(0, max_future_days)
    son_kullanim_tarihi_dt = iade_tarihi_dt + timedelta(days=son_kullanim_gun)
    son_kullanim_tarihi = son_kullanim_tarihi_dt.strftime("%Y-%m-%d")
    
    data.append([
        pnr, 
        havayolu, 
        bilet_tutari, 
        iade_tutari, 
        iade_tarihi, 
        iptal_nedeni,
        son_kullanim_tarihi
    ])

df = pd.DataFrame(data, columns=[
    "pnr_kodu", 
    "havayolu", 
    "bilet_tutari_tl",
    "iade_edilen_tutar_tl", 
    "iade_tarihi", 
    "iptal_nedeni",
    "son_kullanim_tarihi"
])

df.to_csv("sentetik_iade_biletleri_turkiye.csv", index=False, encoding="utf-8-sig")
print("CSV dosyası oluşturuldu: sentetik_iade_biletleri_turkiye.csv")