/**
 * Fixture data for WeatherAPI.com API responses
 * Realistic sample for London (51.5074, -0.1278)
 */

const forecastDays = Array.from({ length: 7 }, (_, dayIndex) => {
  const date = new Date('2026-05-14');
  date.setUTCDate(date.getUTCDate() + dayIndex);
  const dateStr = date.toISOString().split('T')[0];

  return {
    date: dateStr,
    date_epoch: Math.floor(date.getTime() / 1000),
    day: {
      maxtemp_c: 20.1 + dayIndex * 0.3,
      mintemp_c: 11.5 + dayIndex * 0.2,
      avgtemp_c: 16.0 + dayIndex * 0.2,
      maxwind_mph: 12.5,
      maxwind_kph: 20.1,
      totalprecip_mm: dayIndex === 2 ? 5.4 : 0.0,
      totalprecip_in: dayIndex === 2 ? 0.21 : 0.0,
      totalsnow_cm: 0.0,
      avgvis_km: 10.0,
      avgvis_miles: 6.0,
      avghumidity: 62,
      daily_will_it_rain: dayIndex === 2 ? 1 : 0,
      daily_chance_of_rain: dayIndex === 2 ? 80 : 10,
      daily_will_it_snow: 0,
      daily_chance_of_snow: 0,
      condition: {
        text: dayIndex === 2 ? 'Moderate rain' : 'Partly cloudy',
        icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
        code: dayIndex === 2 ? 1189 : 1003,
      },
      uv: 4.0,
    },
    astro: {
      sunrise: '05:15 AM',
      sunset: '08:45 PM',
      moonrise: '12:30 PM',
      moonset: '01:15 AM',
      moon_phase: 'Waxing Crescent',
      moon_illumination: 22,
    },
    hour: Array.from({ length: 24 }, (_, h) => {
      const hourDate = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00`);
      return {
        time_epoch: Math.floor(hourDate.getTime() / 1000),
        time: `${dateStr} ${String(h).padStart(2, '0')}:00`,
        temp_c: 14 + Math.sin(h / 4) * 5,
        temp_f: 57.2 + Math.sin(h / 4) * 9,
        is_day: h >= 6 && h < 20 ? 1 : 0,
        condition: {
          text: 'Partly cloudy',
          icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
          code: 1003,
        },
        wind_mph: 8.9,
        wind_kph: 14.4,
        wind_degree: 220,
        wind_dir: 'SW',
        pressure_mb: 1018.0,
        pressure_in: 30.07,
        precip_mm: 0.0,
        precip_in: 0.0,
        humidity: 62,
        cloud: 45,
        feelslike_c: 13.1,
        feelslike_f: 55.6,
        windchill_c: 13.1,
        heatindex_c: 14.0,
        dewpoint_c: 7.2,
        will_it_rain: 0,
        chance_of_rain: 10,
        will_it_snow: 0,
        chance_of_snow: 0,
        vis_km: 10.0,
        vis_miles: 6.0,
        gust_mph: 12.3,
        gust_kph: 19.8,
        uv: h >= 9 && h < 17 ? 3.0 : 0.0,
      };
    }),
  };
});

export const weatherApiResponse = {
  location: {
    name: 'London',
    region: 'City of London, Greater London',
    country: 'United Kingdom',
    lat: 51.52,
    lon: -0.11,
    tz_id: 'Europe/London',
    localtime_epoch: 1747224000,
    localtime: '2026-05-14 13:00',
  },
  current: {
    last_updated_epoch: 1747224000,
    last_updated: '2026-05-14 13:00',
    temp_c: 18.4,
    temp_f: 65.1,
    is_day: 1,
    condition: {
      text: 'Partly cloudy',
      icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
      code: 1003,
    },
    wind_mph: 8.9,
    wind_kph: 14.4,
    wind_degree: 220,
    wind_dir: 'SW',
    pressure_mb: 1018.0,
    pressure_in: 30.07,
    precip_mm: 0.0,
    precip_in: 0.0,
    humidity: 62,
    cloud: 45,
    feelslike_c: 17.1,
    feelslike_f: 62.8,
    vis_km: 10.0,
    vis_miles: 6.0,
    uv: 4.0,
    gust_mph: 12.3,
    gust_kph: 19.8,
  },
  forecast: {
    forecastday: forecastDays,
  },
  alerts: {
    alert: [],
  },
};
