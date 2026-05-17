import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:moe_weather/api/api_client.dart';

import 'fcm_service.dart';
import 'local_notification_service.dart';
import 'notification_models.dart';

class FcmTokenNotifier extends Notifier<String?> {
  @override
  String? build() => null;
  void setToken(String? t) => state = t;
}

final fcmTokenProvider = NotifierProvider<FcmTokenNotifier, String?>(FcmTokenNotifier.new);

class NotificationPrefsNotifier extends Notifier<NotificationPreferences> {
  @override
  NotificationPreferences build() => const NotificationPreferences();
  void update(NotificationPreferences p) => state = p;
}

final notificationPrefsProvider =
    NotifierProvider<NotificationPrefsNotifier, NotificationPreferences>(
      NotificationPrefsNotifier.new,
    );

/// Read from app root to activate FCM + local notification bridge.
final notificationBridgeProvider = Provider<void>((ref) {
  final apiClient = ref.watch(apiClientProvider);

  final fcm = FcmService(
    messaging: FirebaseMessaging.instance,
    onMessage: (message) {
      final n = message.notification;
      if (n != null) {
        ref.read(localNotificationServiceProvider).showWeatherAlert(
          title: n.title ?? 'Weather Alert',
          body: n.body ?? '',
          payload: message.data['deepLink'] as String?,
        );
      }
    },
    onTokenRefresh: (token) {
      ref.read(fcmTokenProvider.notifier).setToken(token);
      _registerToken(apiClient, token);
    },
  );

  fcm.initialize().then((_) async {
    final token = await fcm.getToken();
    if (token != null) {
      ref.read(fcmTokenProvider.notifier).setToken(token);
      _registerToken(apiClient, token);
    }
  });

  ref.onDispose(fcm.dispose);
});

void _registerToken(ApiClient client, String token) {
  client.dio
      .post<void>('/api/push-subscriptions', data: {'token': token, 'platform': 'fcm'})
      .ignore();
}
