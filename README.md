# MoE Weather

**Mixture of Experts Weather Application** - A weather aggregation system that combines data from multiple free weather APIs to provide the most accurate forecasts possible.

## Features

- **Multi-Source Aggregation**: Combines data from Open-Meteo, NWS, OpenWeatherMap, WeatherAPI, and more
- **Intelligent Consensus**: Uses weighted averaging and outlier detection for accurate results
- **Confidence Scoring**: Shows how much the sources agree on predictions
- **Zero Cost to Start**: Works completely free using Open-Meteo and NWS (US)
- **Smart Caching**: Multi-tier caching to minimize API calls
- **Automatic Failover**: Gracefully handles API failures
- **Weather Alerts**: Aggregates severe weather warnings from multiple sources

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Request                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Weather Orchestrator                          │
│  • Route requests to appropriate providers                       │
│  • Manage caching and rate limits                                │
│  • Handle failover                                               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
    ┌───────────┐       ┌───────────┐       ┌───────────┐
    │Open-Meteo │       │    NWS    │       │OpenWeather│
    │  Adapter  │       │  Adapter  │       │  Adapter  │
    └─────┬─────┘       └─────┬─────┘       └─────┬─────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Consensus Engine                              │
│  • Normalize data from all sources                               │
│  • Detect and remove outliers                                    │
│  • Calculate weighted averages                                   │
│  • Determine confidence scores                                   │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Get Weather
```
GET /api/weather?lat={latitude}&lon={longitude}

Query Parameters:
- lat: Latitude (-90 to 90)
- lon: Longitude (-180 to 180)
- units: "metric" or "imperial" (default: metric)
- hourly: Hours of hourly forecast (1-168, default: 48)
- daily: Days of daily forecast (1-14, default: 7)
- alerts: Include weather alerts (default: true)
```

### Geocode Location
```
GET /api/geocode?q={query}

Query Parameters:
- q: Location search query (e.g., "New York")
```

### Health Check
```
GET /api/health

Returns status of all weather providers and cache statistics.
```

## Configuration

Copy `.env.example` to `.env` and add your API keys:

```env
# Optional - enables additional data sources
OPENWEATHERMAP_API_KEY=your_key
WEATHERAPI_KEY=your_key
TOMORROW_IO_API_KEY=your_key
```

The app works without any API keys using:
- **Open-Meteo**: Unlimited free tier, no key required
- **NWS**: Free US government API, no key required

## Free Weather APIs

| API | Free Tier | Key Required | Coverage |
|-----|-----------|--------------|----------|
| Open-Meteo | Unlimited | No | Global |
| NWS | Unlimited | No | US Only |
| OpenWeatherMap | 1,000/day | Yes | Global |
| WeatherAPI | 1M/month | Yes | Global |
| Tomorrow.io | 500/day | Yes | Global |

## Scaling Guide

### Phase 1: MVP (0-1,000 users)
- Single server
- In-memory caching
- Free APIs only
- **Cost: $0/month**

### Phase 2: Growth (1,000-10,000 users)
- Load balancer
- Redis caching
- Mix of free/paid APIs
- **Cost: $20-50/month**

### Phase 3: Scale (10,000-100,000 users)
- Kubernetes/serverless
- Redis cluster
- CDN for static assets
- **Cost: $100-300/month**

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run tests
npm test

# Lint code
npm run lint
```

## Project Structure

```
moe-weather/
├── src/
│   ├── adapters/         # Weather API adapters
│   │   ├── base.ts       # Base adapter class
│   │   ├── open-meteo.ts # Open-Meteo integration
│   │   ├── nws.ts        # NWS integration
│   │   ├── openweathermap.ts
│   │   └── weatherapi.ts
│   ├── engine/           # Core MoE engine
│   │   ├── consensus.ts  # Consensus algorithm
│   │   ├── cache.ts      # Caching layer
│   │   └── orchestrator.ts
│   ├── types/            # TypeScript types
│   │   └── weather.ts
│   └── server.ts         # Express server
├── public/
│   └── index.html        # Frontend SPA
├── package.json
├── tsconfig.json
└── ARCHITECTURE.md       # Detailed architecture docs
```

## How MoE Consensus Works

1. **Fetch**: Request data from all available providers in parallel
2. **Normalize**: Convert all responses to standard format
3. **Detect Outliers**: Use IQR method to identify anomalies
4. **Weight**: Apply provider-specific weights based on historical accuracy
5. **Aggregate**: Calculate weighted average excluding outliers
6. **Score**: Determine confidence based on source agreement

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [Open-Meteo](https://open-meteo.com/) for their excellent free API
- [National Weather Service](https://www.weather.gov/) for public weather data
- All the weather API providers who offer free tiers
