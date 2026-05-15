/**
 * Fixture data for NWS API responses
 * Realistic sample for New York City (40.7128, -74.0060)
 */

export const nwsPoints = {
  '@context': [
    'https://geojson.org/geojson-ld/geojson-context.jsonld',
    {
      '@version': '1.1',
      wx: 'https://api.weather.gov/ontology#',
    },
  ],
  id: 'https://api.weather.gov/points/40.7128,-74.006',
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-74.006, 40.7128],
  },
  properties: {
    '@id': 'https://api.weather.gov/points/40.7128,-74.006',
    '@type': 'wx:Point',
    cwa: 'OKX',
    forecastOffice: 'https://api.weather.gov/offices/OKX',
    gridId: 'OKX',
    gridX: 33,
    gridY: 37,
    forecast: 'https://api.weather.gov/gridpoints/OKX/33,37/forecast',
    forecastHourly: 'https://api.weather.gov/gridpoints/OKX/33,37/forecast/hourly',
    forecastGridData: 'https://api.weather.gov/gridpoints/OKX/33,37',
    observationStations:
      'https://api.weather.gov/gridpoints/OKX/33,37/stations',
    relativeLocation: {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-74.0059731, 40.7143528],
      },
      properties: {
        city: 'New York',
        state: 'NY',
        distance: {
          unitCode: 'wmoUnit:m',
          value: 158.8490891521,
        },
        bearing: {
          unitCode: 'wmoUnit:degree_(angle)',
          value: 165,
        },
      },
    },
    forecastZone: 'https://api.weather.gov/zones/forecast/NYZ072',
    county: 'https://api.weather.gov/zones/county/NYC061',
    timeZone: 'America/New_York',
    radarStation: 'KOKX',
  },
};

export const nwsStations = {
  '@context': ['https://geojson.org/geojson-ld/geojson-context.jsonld'],
  type: 'FeatureCollection',
  features: [
    {
      id: 'https://api.weather.gov/stations/KNYC',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-74.0045, 40.7771],
      },
      properties: {
        '@id': 'https://api.weather.gov/stations/KNYC',
        '@type': 'wx:ObservationStation',
        elevation: {
          unitCode: 'wmoUnit:m',
          value: 47,
        },
        stationIdentifier: 'KNYC',
        name: 'New York, Central Park',
        timeZone: 'America/New_York',
        forecast: 'https://api.weather.gov/zones/forecast/NYZ072',
        county: 'https://api.weather.gov/zones/county/NYC061',
        fireWeatherZone: 'https://api.weather.gov/zones/fire/NYZ212',
      },
    },
  ],
};

export const nwsObservation = {
  '@context': ['https://geojson.org/geojson-ld/geojson-context.jsonld'],
  id: 'https://api.weather.gov/stations/KNYC/observations/2026-05-14T12:54:00+00:00',
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-74.0045, 40.7771],
  },
  properties: {
    '@id': 'https://api.weather.gov/stations/KNYC/observations/2026-05-14T12:54:00+00:00',
    '@type': 'wx:ObservationStation',
    station: 'https://api.weather.gov/stations/KNYC',
    timestamp: '2026-05-14T12:54:00+00:00',
    rawMessage: 'KNYC 141254Z 22010KT 10SM FEW060 18/08 A3001',
    textDescription: 'Mostly Clear',
    icon: 'https://api.weather.gov/icons/land/day/few?size=medium',
    temperature: {
      unitCode: 'wmoUnit:degC',
      value: 18.3,
      qualityControl: 'V',
    },
    dewpoint: {
      unitCode: 'wmoUnit:degC',
      value: 8.0,
      qualityControl: 'V',
    },
    windDirection: {
      unitCode: 'wmoUnit:degree_(angle)',
      value: 220,
      qualityControl: 'V',
    },
    windSpeed: {
      unitCode: 'wmoUnit:km_h-1',
      value: 18.52,
      qualityControl: 'V',
    },
    windGust: {
      unitCode: 'wmoUnit:km_h-1',
      value: null,
      qualityControl: 'Z',
    },
    barometricPressure: {
      unitCode: 'wmoUnit:Pa',
      value: 101627.46,
      qualityControl: 'V',
    },
    seaLevelPressure: {
      unitCode: 'wmoUnit:Pa',
      value: 101627.46,
      qualityControl: 'V',
    },
    visibility: {
      unitCode: 'wmoUnit:m',
      value: 16093.44,
      qualityControl: 'V',
    },
    relativeHumidity: {
      unitCode: 'wmoUnit:percent',
      value: 48.71,
      qualityControl: 'C',
    },
    windChill: {
      unitCode: 'wmoUnit:degC',
      value: null,
      qualityControl: 'V',
    },
    heatIndex: {
      unitCode: 'wmoUnit:degC',
      value: null,
      qualityControl: 'V',
    },
    cloudLayers: [
      {
        base: {
          unitCode: 'wmoUnit:m',
          value: 1828.8,
        },
        amount: 'FEW',
      },
    ],
    presentWeather: [],
  },
};

export const nwsForecast = {
  '@context': ['https://geojson.org/geojson-ld/geojson-context.jsonld'],
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[]],
  },
  properties: {
    updated: '2026-05-14T11:21:38+00:00',
    units: 'us:customary',
    forecastGenerator: 'BaselineForecastGenerator',
    generatedAt: '2026-05-14T12:55:25+00:00',
    updateTime: '2026-05-14T11:21:38+00:00',
    validTimes: '2026-05-14T05:00:00+00:00/P7DT20H',
    elevation: {
      unitCode: 'wmoUnit:m',
      value: 47,
    },
    periods: [
      {
        number: 1,
        name: 'Today',
        startTime: '2026-05-14T08:00:00-04:00',
        endTime: '2026-05-14T18:00:00-04:00',
        isDaytime: true,
        temperature: 68,
        temperatureUnit: 'F',
        temperatureTrend: null,
        probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 10 },
        dewpoint: { value: 8.0, unitCode: 'wmoUnit:degC' },
        relativeHumidity: { unitCode: 'wmoUnit:percent', value: 48 },
        windSpeed: '10 mph',
        windDirection: 'SW',
        icon: 'https://api.weather.gov/icons/land/day/few?size=medium',
        shortForecast: 'Mostly Clear',
        detailedForecast:
          'Mostly clear, with a high near 68. Southwest wind around 10 mph.',
      },
      {
        number: 2,
        name: 'Tonight',
        startTime: '2026-05-14T18:00:00-04:00',
        endTime: '2026-05-15T06:00:00-04:00',
        isDaytime: false,
        temperature: 55,
        temperatureUnit: 'F',
        temperatureTrend: null,
        probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 5 },
        dewpoint: { value: 7.0, unitCode: 'wmoUnit:degC' },
        relativeHumidity: { unitCode: 'wmoUnit:percent', value: 55 },
        windSpeed: '5 mph',
        windDirection: 'SW',
        icon: 'https://api.weather.gov/icons/land/night/few?size=medium',
        shortForecast: 'Mostly Clear',
        detailedForecast:
          'Mostly clear, with a low around 55. Southwest wind around 5 mph.',
      },
      {
        number: 3,
        name: 'Wednesday',
        startTime: '2026-05-15T06:00:00-04:00',
        endTime: '2026-05-15T18:00:00-04:00',
        isDaytime: true,
        temperature: 72,
        temperatureUnit: 'F',
        temperatureTrend: null,
        probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 20 },
        dewpoint: { value: 9.0, unitCode: 'wmoUnit:degC' },
        relativeHumidity: { unitCode: 'wmoUnit:percent', value: 52 },
        windSpeed: '10 to 15 mph',
        windDirection: 'S',
        icon: 'https://api.weather.gov/icons/land/day/sct?size=medium',
        shortForecast: 'Partly Sunny',
        detailedForecast: 'Partly sunny, with a high near 72.',
      },
      {
        number: 4,
        name: 'Wednesday Night',
        startTime: '2026-05-15T18:00:00-04:00',
        endTime: '2026-05-16T06:00:00-04:00',
        isDaytime: false,
        temperature: 58,
        temperatureUnit: 'F',
        temperatureTrend: null,
        probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 30 },
        dewpoint: { value: 10.0, unitCode: 'wmoUnit:degC' },
        relativeHumidity: { unitCode: 'wmoUnit:percent', value: 60 },
        windSpeed: '5 mph',
        windDirection: 'S',
        icon: 'https://api.weather.gov/icons/land/night/rain_showers?size=medium',
        shortForecast: 'Slight Chance Rain Showers',
        detailedForecast:
          'A slight chance of rain showers after midnight. Mostly cloudy.',
      },
    ],
  },
};

export const nwsHourlyForecast = {
  '@context': ['https://geojson.org/geojson-ld/geojson-context.jsonld'],
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[]],
  },
  properties: {
    updated: '2026-05-14T11:21:38+00:00',
    units: 'us:customary',
    forecastGenerator: 'HourlyForecastGenerator',
    generatedAt: '2026-05-14T12:55:25+00:00',
    updateTime: '2026-05-14T11:21:38+00:00',
    validTimes: '2026-05-14T12:00:00+00:00/P7DT',
    elevation: { unitCode: 'wmoUnit:m', value: 47 },
    periods: Array.from({ length: 48 }, (_, i) => {
      const start = new Date('2026-05-14T13:00:00-04:00');
      start.setUTCHours(start.getUTCHours() + i);
      const end = new Date(start);
      end.setUTCHours(end.getUTCHours() + 1);
      return {
        number: i + 1,
        name: '',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        isDaytime: i % 24 < 12,
        temperature: 65 + Math.round(Math.sin(i / 6) * 8),
        temperatureUnit: 'F',
        temperatureTrend: null,
        probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 10 },
        dewpoint: { value: 8.0, unitCode: 'wmoUnit:degC' },
        relativeHumidity: { unitCode: 'wmoUnit:percent', value: 50 },
        windSpeed: '10 mph',
        windDirection: 'SW',
        icon: 'https://api.weather.gov/icons/land/day/few?size=small',
        shortForecast: 'Mostly Clear',
        detailedForecast: '',
      };
    }),
  },
};
