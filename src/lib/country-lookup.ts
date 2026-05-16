/**
 * Lat/Lon → ISO 3166-1 alpha-2 country code lookup using bounding boxes
 * Used by the MeteoAlarm adapter to determine EU coverage
 */

// Supported MeteoAlarm countries with approximate bounding boxes
const COUNTRY_BOXES: Array<{
  code: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}> = [
  { code: 'AT', minLat: 46.4, maxLat: 49.0, minLon: 9.5,   maxLon: 17.2 },  // Austria
  { code: 'BE', minLat: 49.5, maxLat: 51.5, minLon: 2.5,   maxLon: 6.4  },  // Belgium
  { code: 'HR', minLat: 42.4, maxLat: 46.6, minLon: 13.5,  maxLon: 19.5 },  // Croatia
  { code: 'CZ', minLat: 48.5, maxLat: 51.1, minLon: 12.1,  maxLon: 18.9 },  // Czech Republic
  { code: 'DK', minLat: 54.5, maxLat: 57.8, minLon: 8.0,   maxLon: 15.2 },  // Denmark
  { code: 'FI', minLat: 59.8, maxLat: 70.1, minLon: 20.5,  maxLon: 31.6 },  // Finland
  { code: 'FR', minLat: 41.3, maxLat: 51.1, minLon: -5.2,  maxLon: 9.6  },  // France
  { code: 'DE', minLat: 47.3, maxLat: 55.1, minLon: 5.9,   maxLon: 15.0 },  // Germany
  { code: 'GR', minLat: 35.0, maxLat: 41.8, minLon: 19.4,  maxLon: 28.2 },  // Greece
  { code: 'HU', minLat: 45.7, maxLat: 48.6, minLon: 16.1,  maxLon: 22.9 },  // Hungary
  { code: 'IE', minLat: 51.4, maxLat: 55.4, minLon: -10.5, maxLon: -6.0 },  // Ireland
  { code: 'IT', minLat: 36.6, maxLat: 47.1, minLon: 6.6,   maxLon: 18.5 },  // Italy
  { code: 'LU', minLat: 49.4, maxLat: 50.2, minLon: 5.7,   maxLon: 6.5  },  // Luxembourg
  { code: 'NL', minLat: 50.8, maxLat: 53.5, minLon: 3.3,   maxLon: 7.2  },  // Netherlands
  { code: 'NO', minLat: 57.9, maxLat: 71.2, minLon: 4.5,   maxLon: 31.2 },  // Norway
  { code: 'PL', minLat: 49.0, maxLat: 54.9, minLon: 14.1,  maxLon: 24.2 },  // Poland
  { code: 'PT', minLat: 36.8, maxLat: 42.2, minLon: -9.5,  maxLon: -6.2 },  // Portugal
  { code: 'RO', minLat: 43.6, maxLat: 48.3, minLon: 20.3,  maxLon: 30.0 },  // Romania
  { code: 'RS', minLat: 41.9, maxLat: 46.2, minLon: 18.8,  maxLon: 23.0 },  // Serbia
  { code: 'SK', minLat: 47.7, maxLat: 49.6, minLon: 16.8,  maxLon: 22.6 },  // Slovakia
  { code: 'SI', minLat: 45.4, maxLat: 46.9, minLon: 13.4,  maxLon: 16.6 },  // Slovenia
  { code: 'ES', minLat: 36.0, maxLat: 43.8, minLon: -9.3,  maxLon: 4.3  },  // Spain
  { code: 'SE', minLat: 55.3, maxLat: 69.1, minLon: 11.1,  maxLon: 24.2 },  // Sweden
  { code: 'CH', minLat: 45.8, maxLat: 47.8, minLon: 5.9,   maxLon: 10.5 },  // Switzerland
  { code: 'GB', minLat: 49.9, maxLat: 60.9, minLon: -8.2,  maxLon: 1.8  },  // UK
];

/**
 * Returns the ISO 3166-1 alpha-2 country code for a lat/lon position,
 * or null if the position is not inside any supported MeteoAlarm country.
 */
export function getCountryCode(lat: number, lon: number): string | null {
  for (const box of COUNTRY_BOXES) {
    if (
      lat >= box.minLat &&
      lat <= box.maxLat &&
      lon >= box.minLon &&
      lon <= box.maxLon
    ) {
      return box.code;
    }
  }
  return null;
}

/**
 * Returns true if the given lat/lon falls within any MeteoAlarm-supported country.
 */
export function isEULocation(lat: number, lon: number): boolean {
  return getCountryCode(lat, lon) !== null;
}
