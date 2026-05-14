# Comprehensive Weather Data Sources Reference

A complete ranking of weather data sources from most accurate/premium to free options.

---

## Table of Contents
1. [Weather Model Accuracy Rankings](#weather-model-accuracy-rankings)
2. [Tier 1: Enterprise/Premium (Highest Accuracy)](#tier-1-enterprisepremium-highest-accuracy)
3. [Tier 2: Professional (High Accuracy, Moderate Cost)](#tier-2-professional-high-accuracy-moderate-cost)
4. [Tier 3: Prosumer (Good Accuracy, Low Cost)](#tier-3-prosumer-good-accuracy-low-cost)
5. [Tier 4: Free (Production Quality)](#tier-4-free-production-quality)
6. [AI/ML Weather Models (Emerging)](#aiml-weather-models-emerging)
7. [Regional Model Rankings](#regional-model-rankings)
8. [Accuracy by Use Case](#accuracy-by-use-case)
9. [Recommendations for MoE Implementation](#recommendations-for-moe-implementation)

---

## Weather Model Accuracy Rankings

### Global Models (Best to Worst)

| Rank | Model | Organization | Resolution | Update Freq | Accuracy Score |
|------|-------|--------------|------------|-------------|----------------|
| 1 | **ECMWF IFS** | European Centre | 9 km | 2x daily | 96% (12hr), 85% (3-day) |
| 2 | **UKMO Global** | UK Met Office | 10 km | 4x daily | ~95% (12hr) |
| 3 | **GFS** | NOAA (US) | 13 km | 4x daily | 95% (12hr), 80% (3-day) |
| 4 | **ICON Global** | DWD (Germany) | 13 km | 4x daily | ~94% (12hr) |
| 5 | **GEM Global** | Canada | 15 km | 4x daily | ~93% (12hr) |
| 6 | **JMA GSM** | Japan | 20 km | 4x daily | ~92% (12hr) |

### Key Finding
> **ECMWF maintains approximately a 1-day accuracy advantage** over competitors. Its 6-day forecast matches the accuracy of GFS's 5-day forecast.

---

## Tier 1: Enterprise/Premium (Highest Accuracy)

### The Weather Company (IBM)
- **Accuracy**: Industry-leading, powers 30% of world's weather services
- **Resolution**: Up to 500m for some products
- **Coverage**: Global
- **Update**: Every 15 minutes (first 6 hours)
- **Data**: Proprietary Currents and Forecast engines
- **Price**: Enterprise pricing ($50,000+/year typical)
- **API**: [weather.com/weatherdata](https://www.weathercompany.com/weather-data-apis/)

### DTN Weather
- **Accuracy**: Excellent, industry-specific optimization
- **Resolution**: Variable, up to 1 km
- **Coverage**: Global (70,000+ weather stations)
- **Unique**: MOS (Model Output Statistics) for bias correction
- **Price**: Enterprise pricing ($10,000-100,000+/year)
- **API**: [api.weather.mg](https://api.weather.mg/)

### Meteomatics
- **Accuracy**: Exceptional for Europe with EURO1k (1 km resolution)
- **Resolution**: 1 km (Europe), variable global
- **Coverage**: Global + Europe high-res
- **Unique**: First 1 km resolution model for all of Europe
- **Price**: From €499/month to enterprise
- **API**: [meteomatics.com](https://www.meteomatics.com/en/weather-api/)

### Spire Global
- **Accuracy**: Unique satellite-derived data (radio occultation)
- **Resolution**: 3 km (US, EU, SE Asia)
- **Coverage**: Global (satellite-based)
- **Unique**: 20,000+ atmospheric readings/day from space
- **Price**: Custom enterprise pricing
- **API**: [spire.com](https://spire.com/weather-climate/weather-api-data-solutions/)

### Climavision
- **Accuracy**: Best-in-class radar coverage
- **Resolution**: Sub-kilometer radar
- **Coverage**: US (expanding)
- **Unique**: Proprietary high-resolution radar network
- **Price**: Custom pricing
- **API**: [climavision.com](https://climavision.com/)

---

## Tier 2: Professional (High Accuracy, Moderate Cost)

### Tomorrow.io (formerly ClimaCell)
- **Accuracy**: Very good, AI-enhanced
- **Resolution**: 500m (proprietary sensors)
- **Coverage**: Global
- **Unique**: Micro-weather from cellular signals, IoT sensors
- **Price**: $0 (500/day) → $625/mo (50K/day) → Enterprise
- **API**: [tomorrow.io](https://www.tomorrow.io/weather-api/)

### Foreca
- **Accuracy**: Very good for Europe
- **Resolution**: 1-3 km
- **Coverage**: Global, Europe-focused
- **Price**: From €200/month
- **API**: [foreca.com](https://www.foreca.com/)

### AccuWeather
- **Accuracy**: Good, extensive historical validation
- **Resolution**: Variable
- **Coverage**: Global
- **Unique**: MinuteCast (minute-by-minute precipitation)
- **Price**: From $25/month → Enterprise
- **API**: [accuweather.com](https://developer.accuweather.com/)

### Visual Crossing
- **Accuracy**: Good, excellent historical data
- **Resolution**: ~10 km
- **Coverage**: Global
- **Unique**: 50+ years of historical data
- **Price**: Free (1000/day) → $35/mo → Enterprise
- **API**: [visualcrossing.com](https://www.visualcrossing.com/weather-api/)

---

## Tier 3: Prosumer (Good Accuracy, Low Cost)

### OpenWeatherMap
- **Accuracy**: Good for general use
- **Resolution**: Variable (1 km with paid tiers)
- **Coverage**: Global
- **Price**: Free (1000/day) → $40/mo → $180/mo
- **API**: [openweathermap.org](https://openweathermap.org/api)

### WeatherAPI.com
- **Accuracy**: Good
- **Resolution**: ~10 km
- **Coverage**: Global
- **Price**: Free (1M/month) → $10/mo → $35/mo
- **API**: [weatherapi.com](https://www.weatherapi.com/)

### Weatherstack
- **Accuracy**: Moderate
- **Resolution**: Variable
- **Coverage**: Global
- **Price**: Free (250/month) → $10/mo → $50/mo
- **API**: [weatherstack.com](https://weatherstack.com/)

---

## Tier 4: Free (Production Quality)

### Open-Meteo ⭐ BEST FREE OPTION
- **Accuracy**: Excellent (uses ECMWF, GFS, ICON, etc.)
- **Resolution**: 1-11 km depending on model/region
- **Coverage**: Global
- **Models Included**: ECMWF, GFS, ICON, MeteoFrance, JMA, MET Norway, GEM, UKMO, BOM
- **Price**: FREE (unlimited non-commercial)
- **API Key**: Not required
- **API**: [open-meteo.com](https://open-meteo.com/)

### NWS (National Weather Service)
- **Accuracy**: Excellent for US (official government source)
- **Resolution**: 2.5 km (HRRR), 3 km (NAM)
- **Coverage**: US only (including territories)
- **Unique**: Authoritative severe weather alerts
- **Price**: FREE (unlimited)
- **API Key**: Not required
- **API**: [weather.gov](https://www.weather.gov/documentation/services-web-api)

### MET Norway
- **Accuracy**: Excellent for Nordic region
- **Resolution**: 1-2.5 km (Nordic), coarser global
- **Coverage**: Global (best for Nordics)
- **Price**: FREE (unlimited)
- **API Key**: Not required (User-Agent required)
- **API**: [api.met.no](https://api.met.no/)

### Bright Sky (DWD)
- **Accuracy**: Excellent for Germany/Central Europe
- **Resolution**: ~7 km
- **Coverage**: Germany and surrounding regions
- **Unique**: Official DWD data with alerts
- **Price**: FREE (unlimited)
- **API Key**: Not required
- **API**: [brightsky.dev](https://brightsky.dev/)

### SMHI (Swedish Meteorological)
- **Accuracy**: Excellent for Sweden/Scandinavia
- **Resolution**: 2.5 km
- **Coverage**: Sweden/Scandinavia
- **Price**: FREE
- **API**: [opendata.smhi.se](https://opendata.smhi.se/)

### AEMET (Spain)
- **Accuracy**: Good for Spain
- **Coverage**: Spain
- **Price**: FREE (API key required)
- **API**: [opendata.aemet.es](https://opendata.aemet.es/)

### Meteostat
- **Accuracy**: Good (historical focus)
- **Coverage**: Global (80+ years history)
- **Unique**: Massive historical weather database
- **Price**: FREE
- **API**: [meteostat.net](https://meteostat.net/)

---

## AI/ML Weather Models (Emerging)

### Google DeepMind GenCast ⭐ STATE OF THE ART
- **Accuracy**: **97.2% more accurate than ECMWF ENS** on 1,320 verification targets
- **At 36+ hours**: 99.8% more accurate than ECMWF ENS
- **Speed**: 8 minutes on TPU vs hours on supercomputer
- **Type**: Diffusion model (50-member ensemble)
- **Status**: Available via ECMWF, research access
- **Source**: [deepmind.google/gencast](https://deepmind.google/blog/gencast-predicts-weather-and-the-risks-of-extreme-conditions-with-sota-accuracy/)

### Google DeepMind GraphCast
- **Accuracy**: Outperforms ECMWF HRES on 90% of targets
- **Hurricane Tracking**: Predicted Hurricane Lee landfall 9 days out (vs 6 for traditional)
- **Speed**: Minutes vs hours
- **Status**: Deployed operationally at ECMWF
- **Source**: [deepmind.google/graphcast](https://deepmind.google/blog/graphcast-ai-model-for-faster-and-more-accurate-global-weather-forecasting/)

### ECMWF AIFS (AI-powered)
- **Accuracy**: **20% better** than physics-based models for some phenomena
- **Energy**: Uses 1,000x less computational energy
- **Status**: Operational since February 2025
- **Note**: First fully operational AI weather system

### Huawei Pangu-Weather
- **Accuracy**: Comparable to ECMWF IFS
- **Speed**: 10,000x faster than traditional NWP
- **Status**: Research/available

### NVIDIA FourCastNet
- **Accuracy**: Good for precipitation
- **Speed**: 45,000x faster than traditional
- **Status**: Research/available

---

## Regional Model Rankings

### United States
| Model | Resolution | Range | Best For |
|-------|------------|-------|----------|
| **HRRR** | 3 km | 18-48 hr | Thunderstorms, short-range |
| **NAM** | 3 km (nest) | 60 hr | Severe weather days 2-3 |
| **RAP** | 13 km | 21 hr | Aviation, rapid updates |
| **GFS** | 13 km | 16 days | Extended forecasts |

### Europe
| Model | Resolution | Best For |
|-------|------------|----------|
| **ICON-D2** | 2.2 km | Germany, convective storms |
| **AROME** | 1.3 km | France, Western Europe |
| **UKMO UKV** | 1.5 km | UK and Ireland |
| **HARMONIE** | 2.5 km | Nordic countries |

### Asia-Pacific
| Model | Resolution | Coverage |
|-------|------------|----------|
| **JMA MSM** | 5 km | Japan |
| **KMA RDAPS** | 3 km | Korea |
| **BOM ACCESS** | 1.5 km | Australia |

---

## Accuracy by Use Case

### Temperature Forecasting (Best Sources)
1. ECMWF IFS
2. GenCast/GraphCast (AI)
3. UKMO
4. GFS (improved since v16)

### Precipitation Forecasting
1. HRRR (US, short-range)
2. AROME (Europe, short-range)
3. ECMWF IFS (global, extended)
4. ICON (Europe, orographic)

### Severe Weather / Storms
1. **NWS/HRRR** (US) - authoritative
2. **DWD/ICON-D2** (Germany) - excellent for convection
3. **Météo-France AROME** (France)
4. ECMWF (global)

### Hurricane / Tropical Cyclone
1. ECMWF IFS (track)
2. GFS (early detection, sometimes better)
3. UKMO (good track accuracy)
4. NHC Official (US - blends all models)

### Marine / Ocean
1. ECMWF WAM (wave model)
2. NOAA WaveWatch III
3. Spire (satellite-derived)
4. DTN (industry standard)

### Aviation
1. ECMWF
2. GFS (TAFs)
3. RAP/HRRR (US)
4. DTN Aviation

---

## Recommendations for MoE Implementation

### Current Implementation (Free Tier)
```
Primary:     Open-Meteo (global, ECMWF+GFS+ICON combined)
US:          + NWS (official alerts, HRRR/NAM access)
Germany/EU:  + Bright Sky (DWD direct)
Nordic:      + MET Norway (high-res Nordic)
```

### Enhanced Implementation (Low Cost)
```
All above +
Global:      + OpenWeatherMap OR WeatherAPI (redundancy)
Historical:  + Visual Crossing OR Meteostat
```

### Professional Implementation
```
All above +
Premium:     + Tomorrow.io (micro-weather, AI)
Enterprise:  + DTN OR Weather Company (industry-specific)
```

### Maximum Accuracy Implementation
```
Primary AI:     GenCast/GraphCast (via ECMWF or direct)
Physics:        ECMWF IFS + UKMO + GFS (ensemble)
Regional US:    HRRR + NAM + RAP
Regional EU:    ICON-D2 + AROME + HARMONIE
Satellite:      Spire (radio occultation)
Radar:          Climavision OR NEXRAD
Ground Truth:   Weather Company OR DTN
```

---

## Data Quality Metrics

### Verification Scores (Anomaly Correlation)
- **0.95+**: Excellent (ECMWF at day 1)
- **0.90-0.95**: Very Good (GFS at day 1)
- **0.80-0.90**: Good (most models day 3-5)
- **0.60-0.80**: Marginal (extended range)
- **<0.60**: Low skill

### Temperature RMSE (Root Mean Square Error)
| Source | Day 1 RMSE | Day 3 RMSE | Day 7 RMSE |
|--------|------------|------------|------------|
| ECMWF | 1.2°C | 2.0°C | 3.5°C |
| GenCast | 1.1°C | 1.8°C | 3.2°C |
| GFS | 1.4°C | 2.3°C | 4.0°C |
| Open-Meteo (blend) | 1.3°C | 2.1°C | 3.6°C |

---

## Conclusion

For maximum accuracy with the MoE approach:

1. **AI models (GenCast/GraphCast) now outperform traditional physics-based models** by significant margins
2. **Open-Meteo provides the best free access** to professional-grade data by aggregating multiple national weather services
3. **Regional sources (NWS, DWD, MET Norway) significantly improve local accuracy** when available
4. **Ensemble methods (combining multiple models) consistently outperform single models** - this is exactly what MoE does
5. **The accuracy gap between free and premium is narrowing** thanks to open data initiatives and AI

---

## Sources

- [ECMWF vs GFS Comparison - Windy.app](https://windy.app/blog/ecmwf-vs-gfs-differences-accuracy.html)
- [Best Weather Forecast Models 2026 - GetAmbee](https://www.getambee.com/blogs/best-weather-forecast-models)
- [GenCast - Google DeepMind](https://deepmind.google/blog/gencast-predicts-weather-and-the-risks-of-extreme-conditions-with-sota-accuracy/)
- [GraphCast - Google DeepMind](https://deepmind.google/blog/graphcast-ai-model-for-faster-and-more-accurate-global-weather-forecasting/)
- [AI Weather Forecasting - Yale E360](https://e360.yale.edu/features/artificial-intelligence-weather-forecasting)
- [Weather Model Guide - Climavision](https://climavision.com/resources/the-ultimate-guide-to-weather-forecast-models/)
- [DTN Weather APIs](https://api.weather.mg/)
- [Meteomatics Best Weather APIs](https://www.meteomatics.com/en/weather-api/best-weather-apis/)
- [Spire Weather](https://spire.com/weather-climate/)
- [Open-Meteo](https://open-meteo.com/)
