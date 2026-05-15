/**
 * Fixture data for Pirate Weather (DarkSky-compatible) API responses.
 * Realistic sample for London (51.5074, -0.1278).
 */

export const pirateWeatherResponse = {
  currently: {
    temperature: 20.5,
    apparentTemperature: 19.0,
    humidity: 0.65,
    pressure: 1013.0,
    windSpeed: 5.0,
    windBearing: 180,
    uvIndex: 3,
    cloudCover: 0.3,
    visibility: 16.1,
    icon: 'partly-cloudy-day',
  },
  hourly: {
    data: [
      {
        time: 1700000000,
        temperature: 20.5,
        precipProbability: 0.1,
        windSpeed: 5,
        windBearing: 180,
        icon: 'rain',
      },
      {
        time: 1700003600,
        temperature: 19.8,
        precipProbability: 0.15,
        windSpeed: 4.5,
        windBearing: 175,
        icon: 'rain',
      },
    ],
  },
  daily: {
    data: [
      {
        time: 1700000000,
        temperatureHigh: 25.0,
        temperatureLow: 15.0,
        precipProbability: 0.2,
        windSpeed: 8,
        icon: 'cloudy',
      },
    ],
  },
  alerts: [
    {
      title: 'Wind Advisory',
      severity: 'advisory',
      time: 1700000000,
      expires: 1700040000,
      description: 'Strong winds expected throughout the day.',
    },
  ],
};
