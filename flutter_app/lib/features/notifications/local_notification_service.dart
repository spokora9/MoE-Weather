import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

class LocalNotificationService {
  final _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  void Function(String? payload)? onNotificationTap;

  Future<void> initialize() async {
    if (_initialized) return;
    tz.initializeTimeZones();

    await _plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (r) => onNotificationTap?.call(r.payload),
    );

    final androidPlugin = _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
      'weather_alerts', 'Weather Alerts',
      description: 'Severe weather warnings', importance: Importance.max,
    ));
    await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
      'daily_briefing', 'Daily Briefing',
      description: 'Daily forecast summary',
    ));

    _initialized = true;
  }

  Future<void> showWeatherAlert({
    required String title,
    required String body,
    String? payload,
  }) async {
    await initialize();
    await _plugin.show(
      DateTime.now().millisecondsSinceEpoch & 0xFFFF,
      title, body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'weather_alerts', 'Weather Alerts',
          importance: Importance.max, priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(presentAlert: true, presentSound: true),
      ),
      payload: payload,
    );
  }

  Future<void> scheduleDailyBriefing({
    required int hour,
    required int minute,
    required String title,
    required String body,
  }) async {
    await initialize();
    await _plugin.cancel(0);

    final now = tz.TZDateTime.now(tz.local);
    var scheduled = tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);
    if (scheduled.isBefore(now)) scheduled = scheduled.add(const Duration(days: 1));

    await _plugin.zonedSchedule(
      0, title, body, scheduled,
      const NotificationDetails(
        android: AndroidNotificationDetails('daily_briefing', 'Daily Briefing'),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      matchDateTimeComponents: DateTimeComponents.time,
    );
  }

  Future<void> cancelAll() => _plugin.cancelAll();
}

final localNotificationServiceProvider = Provider<LocalNotificationService>(
  (_) => LocalNotificationService(),
);
