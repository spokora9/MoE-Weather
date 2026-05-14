/**
 * Fixture data for Open-Meteo API responses
 * Realistic sample for London (51.5074, -0.1278)
 */

const times24h = Array.from({ length: 24 }, (_, i) => {
  const d = new Date('2026-05-14T00:00:00Z');
  d.setUTCHours(i);
  return d.toISOString();
});

const daily7 = Array.from({ length: 7 }, (_, i) => {
  const d = new Date('2026-05-14');
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().split('T')[0];
});

export const openMeteoFixture = {
  latitude: 51.5,
  longitude: -0.119999886,
  generationtime_ms: 0.7960796356201172,
  utc_offset_seconds: 3600,
  timezone: 'Europe/London',
  timezone_abbreviation: 'BST',
  elevation: 11.0,
  current: {
    time: '2026-05-14T12:00',
    interval: 900,
    temperature_2m: 18.4,
    relative_humidity_2m: 62,
    apparent_temperature: 17.1,
    is_day: 1,
    precipitation: 0.0,
    rain: 0.0,
    showers: 0.0,
    snowfall: 0.0,
    weather_code: 2,
    cloud_cover: 45,
    pressure_msl: 1018.3,
    surface_pressure: 1016.7,
    wind_speed_10m: 14.4,
    wind_direction_10m: 225,
    wind_gusts_10m: 25.2,
  },
  hourly: {
    time: times24h,
    temperature_2m: Array.from({ length: 24 }, (_, i) => 14 + Math.sin(i / 4) * 5),
    relative_humidity_2m: Array.from({ length: 24 }, () => 62),
    apparent_temperature: Array.from({ length: 24 }, (_, i) => 13 + Math.sin(i / 4) * 4),
    precipitation_probability: Array.from({ length: 24 }, () => 20),
    precipitation: Array.from({ length: 24 }, () => 0.0),
    rain: Array.from({ length: 24 }, () => 0.0),
    showers: Array.from({ length: 24 }, () => 0.0),
    snowfall: Array.from({ length: 24 }, () => 0.0),
    weather_code: Array.from({ length: 24 }, () => 2),
    cloud_cover: Array.from({ length: 24 }, () => 45),
    pressure_msl: Array.from({ length: 24 }, () => 1018.3),
    wind_speed_10m: Array.from({ length: 24 }, () => 14.4),
    wind_direction_10m: Array.from({ length: 24 }, () => 225),
    wind_gusts_10m: Array.from({ length: 24 }, () => 25.2),
    uv_index: Array.from({ length: 24 }, (_, i) => (i >= 8 && i <= 16 ? 3 : 0)),
    cape: Array.from({ length: 24 }, () => 0),
    visibility: Array.from({ length: 24 }, () => 24140),
    freezing_level_height: Array.from({ length: 24 }, () => 2500),
  },
  daily: {
    time: daily7,
    weather_code: [2, 3, 61, 61, 2, 1, 0],
    temperature_2m_max: [19.2, 17.5, 15.8, 16.3, 18.1, 20.4, 21.0],
    temperature_2m_min: [11.3, 12.1, 10.8, 11.5, 12.2, 13.1, 14.0],
    apparent_temperature_max: [18.0, 16.2, 14.5, 15.1, 17.0, 19.2, 20.0],
    apparent_temperature_min: [10.0, 11.0, 9.5, 10.3, 11.1, 12.0, 13.1],
    sunrise: daily7.map((d) => `${d}T05:15`),
    sunset: daily7.map((d) => `${d}T20:45`),
    uv_index_max: [4, 3, 2, 3, 4, 5, 5],
    precipitation_sum: [0.0, 0.2, 5.4, 3.1, 0.0, 0.0, 0.0],
    rain_sum: [0.0, 0.2, 5.4, 3.1, 0.0, 0.0, 0.0],
    showers_sum: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    snowfall_sum: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    precipitation_hours: [0, 1, 6, 4, 0, 0, 0],
    precipitation_probability_max: [10, 30, 80, 70, 15, 5, 5],
    wind_speed_10m_max: [18.0, 22.3, 30.1, 25.4, 15.2, 12.1, 10.5],
    wind_gusts_10m_max: [32.4, 38.2, 52.3, 44.1, 28.3, 22.0, 19.8],
    wind_direction_10m_dominant: [225, 230, 210, 215, 240, 260, 270],
  },
};
