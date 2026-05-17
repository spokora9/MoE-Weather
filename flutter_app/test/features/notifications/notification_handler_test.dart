import 'package:flutter_test/flutter_test.dart';
import 'package:moe_weather/features/notifications/notification_handler.dart';

void main() {
  group('parseNotificationPayload', () {
    test('returns null for null', () => expect(parseNotificationPayload(null), isNull));
    test('returns null for empty', () => expect(parseNotificationPayload(''), isNull));
    test('parses forecast route', () {
      final r = parseNotificationPayload('/forecast/51.5/-0.12');
      expect(r, isA<ForecastRoute>());
      expect((r as ForecastRoute).lat, closeTo(51.5, 0.001));
      expect(r.lon, closeTo(-0.12, 0.001));
    });
    test('parses alert route', () {
      final r = parseNotificationPayload('/alert/abc123');
      expect(r, isA<AlertRoute>());
      expect((r as AlertRoute).alertId, 'abc123');
    });
    test('returns null for unknown route', () =>
        expect(parseNotificationPayload('/unknown/path'), isNull));
    test('returns null for malformed URI', () =>
        expect(parseNotificationPayload('not a uri !!!'), isNull));
  });
}
