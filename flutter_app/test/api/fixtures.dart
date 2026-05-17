/// Inline JSON fixtures used by API wrapper tests. Kept here rather than
/// per-file so each test reads the same shape.

final Map<String, dynamic> sampleWeatherJson = <String, dynamic>{
  'location': {
    'name': 'Berlin',
    'country': 'DE',
    'coordinates': {'latitude': 52.52, 'longitude': 13.41},
    'timezone': 'Europe/Berlin',
  },
  'current': {
    'temperature': 12.5,
    'feelsLike': 11.0,
    'humidity': 65.0,
    'pressure': 1013.0,
    'windSpeed': 4.5,
    'windDirection': 180.0,
    'visibility': 10000.0,
    'cloudCover': 30.0,
    'weatherCode': 1,
    'weatherDescription': 'Mainly clear',
    'timestamp': '2024-06-01T12:00:00.000Z',
  },
  'hourly': [
    {
      'time': '2024-06-01T13:00:00.000Z',
      'temperature': 13.0,
      'feelsLike': 12.0,
      'humidity': 60.0,
      'pressure': 1013.0,
      'windSpeed': 4.0,
      'windDirection': 180.0,
      'precipitation': 0.0,
      'precipitationProbability': 5.0,
      'weatherCode': 1,
      'weatherDescription': 'Mainly clear',
      'cloudCover': 25.0,
    }
  ],
  'daily': [
    {
      'date': '2024-06-01T00:00:00.000Z',
      'temperatureMax': 18.0,
      'temperatureMin': 8.0,
      'humidity': 60.0,
      'pressure': 1013.0,
      'windSpeed': 5.0,
      'windDirection': 180.0,
      'precipitation': 0.0,
      'precipitationProbability': 5.0,
      'weatherCode': 1,
      'weatherDescription': 'Mainly clear',
      'sunrise': '2024-06-01T04:50:00.000Z',
      'sunset': '2024-06-01T19:20:00.000Z',
    }
  ],
  'alerts': [
    {
      'id': 'al-1',
      'event': 'Thunderstorm',
      'headline': 'Severe storm',
      'description': 'Severe storm expected',
      'severity': 'severe',
      'urgency': 'expected',
      'start': '2024-06-01T15:00:00.000Z',
      'end': '2024-06-01T18:00:00.000Z',
      'source': 'DWD',
    }
  ],
  'units': {
    'locale': 'metric',
    'labels': {'temperature': '°C', 'wind': 'm/s'},
  },
};

final Map<String, dynamic> sampleNowcastJson = <String, dynamic>{
  'location': {'lat': 52.52, 'lon': 13.41},
  'nowcast': [
    {
      'time': '2024-06-01T12:00:00Z',
      'precipitationIntensity': 0.0,
      'precipitationProbability': 5.0,
    },
    {
      'time': '2024-06-01T12:01:00Z',
      'precipitationIntensity': 0.1,
      'precipitationProbability': 10.0,
    },
  ],
  'unit': 'mm/h',
  'fetchedAt': '2024-06-01T12:00:00.000Z',
};

final List<dynamic> sampleGeocodeJson = <dynamic>[
  {
    'name': 'Berlin',
    'country': 'DE',
    'state': 'Berlin',
    'latitude': 52.52,
    'longitude': 13.41,
    'population': 3645000,
  },
  {
    'name': 'Berlin',
    'country': 'US',
    'state': 'New Hampshire',
    'latitude': 44.47,
    'longitude': -71.18,
  },
];

final Map<String, dynamic> sampleAuthMeJson = <String, dynamic>{
  'id': 'user-123',
  'email': 'a@example.com',
  'tier': 'pro',
};

final List<dynamic> sampleLocationsJson = <dynamic>[
  {
    'id': 'loc-1',
    'user_id': 'user-123',
    'name': 'Home',
    'latitude': 52.52,
    'longitude': 13.41,
    'country': 'DE',
    'is_default': true,
    'display_order': 0,
    'created_at': '2024-06-01T12:00:00.000Z',
  },
];

final Map<String, dynamic> sampleLocationJson =
    Map<String, dynamic>.from(sampleLocationsJson.first as Map);

final Map<String, dynamic> sampleVapidJson = <String, dynamic>{
  'publicKey': 'BPxxx-vapid-public-key',
};

final Map<String, dynamic> samplePushSubscriptionJson = <String, dynamic>{
  'id': 'sub-1',
  'user_id': 'user-123',
  'endpoint': 'https://example.com/push/endpoint',
  'p256dh': 'p256',
  'auth': 'auth-token',
  'created_at': '2024-06-01T12:00:00.000Z',
};

final Map<String, dynamic> samplePushTestJson = <String, dynamic>{
  'sent': 1,
  'failed': 0,
  'total': 1,
};
