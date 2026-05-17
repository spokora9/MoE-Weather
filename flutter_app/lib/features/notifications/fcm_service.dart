import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {}

class FcmService {
  FcmService({
    required FirebaseMessaging messaging,
    required void Function(RemoteMessage) onMessage,
    required void Function(String) onTokenRefresh,
  })  : _messaging = messaging,
        _onMessage = onMessage,
        _onTokenRefresh = onTokenRefresh;

  final FirebaseMessaging _messaging;
  final void Function(RemoteMessage) _onMessage;
  final void Function(String) _onTokenRefresh;

  StreamSubscription<RemoteMessage>? _foregroundSub;
  StreamSubscription<String>? _tokenSub;

  Future<void> initialize() async {
    if (kIsWeb) return;

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    final settings = await _messaging.requestPermission(
      alert: true, badge: true, sound: true, provisional: false,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    _foregroundSub = FirebaseMessaging.onMessage.listen(_onMessage);
    _tokenSub = _messaging.onTokenRefresh.listen(_onTokenRefresh);

    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true, badge: true, sound: true,
    );
  }

  Future<String?> getToken() => _messaging.getToken();

  Future<void> subscribeToTopic(String topic) =>
      _messaging.subscribeToTopic(topic);

  Future<void> unsubscribeFromTopic(String topic) =>
      _messaging.unsubscribeFromTopic(topic);

  void dispose() {
    _foregroundSub?.cancel();
    _tokenSub?.cancel();
  }
}
