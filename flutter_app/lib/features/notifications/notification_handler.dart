sealed class NotificationRoute {
  const NotificationRoute();
  const factory NotificationRoute.forecast({required double lat, required double lon}) = ForecastRoute;
  const factory NotificationRoute.alert({required String alertId}) = AlertRoute;
}

final class ForecastRoute extends NotificationRoute {
  const ForecastRoute({required this.lat, required this.lon});
  final double lat;
  final double lon;
}

final class AlertRoute extends NotificationRoute {
  const AlertRoute({required this.alertId});
  final String alertId;
}

/// Parses `/forecast/{lat}/{lon}` or `/alert/{id}` payload into a typed route.
NotificationRoute? parseNotificationPayload(String? payload) {
  if (payload == null || payload.isEmpty) return null;
  final uri = Uri.tryParse(payload);
  if (uri == null) return null;
  final segs = uri.pathSegments;
  if (segs.length >= 3 && segs[0] == 'forecast') {
    final lat = double.tryParse(segs[1]);
    final lon = double.tryParse(segs[2]);
    if (lat != null && lon != null) return NotificationRoute.forecast(lat: lat, lon: lon);
  }
  if (segs.length >= 2 && segs[0] == 'alert') {
    return NotificationRoute.alert(alertId: segs[1]);
  }
  return null;
}
