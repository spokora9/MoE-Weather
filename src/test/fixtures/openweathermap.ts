/**
 * Fixture data for OpenWeatherMap API responses
 * Realistic sample for London (51.5074, -0.1278)
 */

export const owmCurrentWeather = {
  coord: { lon: -0.1278, lat: 51.5074 },
  weather: [
    {
      id: 802,
      main: 'Clouds',
      description: 'scattered clouds',
      icon: '03d',
    },
  ],
  base: 'stations',
  main: {
    temp: 18.4,
    feels_like: 17.6,
    temp_min: 16.2,
    temp_max: 20.1,
    pressure: 1018,
    humidity: 62,
    sea_level: 1018,
    grnd_level: 1016,
  },
  visibility: 10000,
  wind: {
    speed: 4.12,
    deg: 220,
    gust: 7.2,
  },
  clouds: { all: 40 },
  dt: 1747224000,
  sys: {
    type: 2,
    id: 2019646,
    country: 'GB',
    sunrise: 1747188600,
    sunset: 1747244700,
  },
  timezone: 3600,
  id: 2643743,
  name: 'London',
  cod: 200,
};

export const owmForecast = {
  cod: '200',
  message: 0,
  cnt: 40,
  list: Array.from({ length: 40 }, (_, i) => {
    const dt = 1747224000 + i * 10800; // 3-hour intervals
    return {
      dt,
      main: {
        temp: 18 + Math.sin(i / 4) * 4,
        feels_like: 17 + Math.sin(i / 4) * 3,
        temp_min: 15 + Math.sin(i / 4) * 3,
        temp_max: 21 + Math.sin(i / 4) * 3,
        pressure: 1018,
        sea_level: 1018,
        grnd_level: 1016,
        humidity: 62,
        temp_kf: 0,
      },
      weather: [
        {
          id: 802,
          main: 'Clouds',
          description: 'scattered clouds',
          icon: '03d',
        },
      ],
      clouds: { all: 40 },
      wind: {
        speed: 4.12,
        deg: 220,
        gust: 7.2,
      },
      visibility: 10000,
      pop: 0.1,
      rain: undefined,
      snow: undefined,
      sys: { pod: i % 8 < 4 ? 'd' : 'n' },
      dt_txt: new Date(dt * 1000).toISOString().replace('T', ' ').slice(0, 19),
    };
  }),
  city: {
    id: 2643743,
    name: 'London',
    coord: { lat: 51.5074, lon: -0.1278 },
    country: 'GB',
    population: 1000000,
    timezone: 3600,
    sunrise: 1747188600,
    sunset: 1747244700,
  },
};
