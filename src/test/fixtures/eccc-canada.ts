/**
 * Fixture data for ECCC MSC GeoMet API responses
 * Realistic sample for Toronto, ON (43.65, -79.38)
 */

export const ecccForecastResponse = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'hrdps.20260514T00Z.001',
      geometry: {
        type: 'Point',
        coordinates: [-79.38, 43.65],
      },
      properties: {
        datetime: '2026-05-14T12:00:00Z',
        TMP: 15.2,    // temperature °C
        WSPD: 20.0,   // wind speed km/h
        WDIR: 180,    // wind direction degrees
        RH: 65,       // relative humidity %
        PRMSL: 101300, // pressure Pa
      },
    },
  ],
  numberMatched: 1,
  numberReturned: 1,
};

export const ecccForecastNoData = {
  type: 'FeatureCollection',
  features: [],
  numberMatched: 0,
  numberReturned: 0,
};

export const ecccAlertsResponse = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'eccc-alert-wind-warning-2026',
      geometry: null,
      properties: {
        headline: 'Wind warning in effect',
        severity: 'Moderate',
        event: 'WIND WARNING',
        effective: '2026-05-14T10:00:00Z',
        expires: '2026-05-14T22:00:00Z',
        description: 'Strong winds expected. Gusts up to 90 km/h.',
        urgency: 'Expected',
      },
    },
  ],
  numberMatched: 1,
  numberReturned: 1,
};

export const ecccAlertsEmpty = {
  type: 'FeatureCollection',
  features: [],
  numberMatched: 0,
  numberReturned: 0,
};
