import 'package:flutter_test/flutter_test.dart';
import 'package:moe_weather/features/notifications/notification_models.dart';

void main() {
  group('NotificationPreferences', () {
    test('defaults', () {
      const p = NotificationPreferences();
      expect(p.weatherAlerts, isTrue);
      expect(p.dailyBriefing, isFalse);
    });
    test('copyWith', () {
      final p = const NotificationPreferences().copyWith(dailyBriefing: true);
      expect(p.dailyBriefing, isTrue);
      expect(p.weatherAlerts, isTrue);
    });
    test('json round-trip', () {
      const p = NotificationPreferences(
        weatherAlerts: false, dailyBriefing: true,
        dailyBriefingHour: 8, dailyBriefingMinute: 30,
      );
      final decoded = NotificationPreferences.fromJson(p.toJson());
      expect(decoded.weatherAlerts, isFalse);
      expect(decoded.dailyBriefingHour, 8);
      });
  });
}
