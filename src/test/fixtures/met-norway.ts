/**
 * Fixture data for MET Norway Locationforecast 2.0 API responses
 * Realistic sample for Oslo (59.9139, 10.7522)
 */

const timeseries = Array.from({ length: 90 }, (_, i) => {
  const t = new Date('2026-05-14T12:00:00Z');
  t.setUTCHours(t.getUTCHours() + i);
  const isDay = t.getUTCHours() >= 5 && t.getUTCHours() < 21;
  const symbolSuffix = isDay ? '_day' : '_night';

  return {
    time: t.toISOString(),
    data: {
      instant: {
        details: {
          air_pressure_at_sea_level: 1013.5 + Math.sin(i / 12) * 2,
          air_temperature: 14 + Math.sin((i - 6) / 12) * 5,
          cloud_area_fraction: 35 + Math.sin(i / 8) * 20,
          relative_humidity: 60 + Math.sin(i / 10) * 10,
          wind_from_direction: 225,
          wind_speed: 5.5,
          wind_speed_of_gust: 10.2,
          ultraviolet_index_clear_sky: isDay ? 2.5 : 0,
        },
      },
      ...(i % 6 === 0
        ? {
            next_6_hours: {
              summary: { symbol_code: `partlycloudy${symbolSuffix}` },
              details: {
                precipitation_amount: i % 24 > 18 ? 0.8 : 0.0,
                air_temperature_max: 16 + Math.sin((i - 6) / 12) * 4,
                air_temperature_min: 11 + Math.sin((i - 6) / 12) * 3,
              },
            },
          }
        : {}),
      next_1_hours: {
        summary: { symbol_code: `partlycloudy${symbolSuffix}` },
        details: { precipitation_amount: i % 24 > 18 ? 0.1 : 0.0 },
      },
      next_12_hours: {
        summary: { symbol_code: `partlycloudy${symbolSuffix}` },
        details: { probability_of_precipitation: 20 },
      },
    },
  };
});

export const metNorwayResponse = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [10.7522, 59.9139, 15],
  },
  properties: {
    meta: {
      updated_at: '2026-05-14T11:38:37Z',
      units: {
        air_pressure_at_sea_level: 'hPa',
        air_temperature: 'celsius',
        cloud_area_fraction: '%',
        precipitation_amount: 'mm',
        relative_humidity: '%',
        wind_from_direction: 'degrees',
        wind_speed: 'm/s',
      },
    },
    timeseries,
  },
};
