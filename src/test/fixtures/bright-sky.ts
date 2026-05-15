/**
 * Fixture data for Bright Sky DWD API responses
 * Realistic sample for Berlin (52.52, 13.405)
 */

const nowStr = '2026-05-14T12:00:00+00:00';

const weatherEntries = Array.from({ length: 168 }, (_, i) => {
  const ts = new Date('2026-05-14T00:00:00Z');
  ts.setUTCHours(ts.getUTCHours() + i);
  return {
    timestamp: ts.toISOString(),
    source_id: 6007,
    precipitation: i % 24 < 6 ? 0.0 : (i % 72 > 60 ? 0.3 : 0.0),
    pressure_msl: 1015.2 + Math.sin(i / 12) * 2,
    sunshine: i % 24 >= 8 && i % 24 < 18 ? 45 : 0,
    temperature: 12 + Math.sin((i - 6) / 12) * 6,
    wind_direction: 225,
    wind_speed: 15.5,
    cloud_cover: 45,
    dew_point: 6.5,
    relative_humidity: 62,
    visibility: 20000,
    wind_gust_direction: 225,
    wind_gust_speed: 28.0,
    condition: i % 72 > 60 ? 'rain' : 'partly-cloudy-day',
    icon: i % 72 > 60 ? 'rain' : 'partly-cloudy-day',
  };
});

export const brightSkyWeather = {
  weather: weatherEntries,
  sources: [
    {
      id: 6007,
      dwd_station_id: '00433',
      observation_type: 'forecast',
      lat: 52.5244,
      lon: 13.4105,
      height: 55.0,
      station_name: 'Berlin-Tempelhof',
      wmo_station_id: '10384',
      first_record: '2010-01-01T00:00:00+00:00',
      last_record: '2026-12-31T23:00:00+00:00',
      distance: 1421.3,
    },
  ],
};

export const brightSkyAlerts = {
  alerts: [
    {
      id: 123456,
      alert_id: 'dwd.de_ALERT_123456',
      effective: '2026-05-14T10:00:00+00:00',
      onset: '2026-05-14T14:00:00+00:00',
      expires: '2026-05-14T20:00:00+00:00',
      category: 'Met',
      response_type: 'Prepare',
      urgency: 'Expected',
      severity: 'Minor',
      certainty: 'Likely',
      event_code: 24,
      event_en: 'WIND GUSTS',
      event_de: 'WINDBÖEN',
      headline_en: 'Official WARNING of WIND GUSTS',
      headline_de: 'Amtliche WARNUNG vor WINDBÖEN',
      description_en: 'There is a risk of wind gusts (level 1 of 4).',
      description_de: 'Es besteht Gefahr von Windböen (Stufe 1 von 4).',
      instruction_en: 'Check the latest official weather warnings.',
      instruction_de: 'Beachten Sie die aktuellen amtlichen Warnmeldungen.',
    },
  ],
};
