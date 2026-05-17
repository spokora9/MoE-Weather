import 'package:flutter/foundation.dart';
import 'package:workmanager/workmanager.dart';

const _uniqueTaskName = 'moe_weather_widget_refresh';
const _taskName = 'widgetRefresh';

Future<void> scheduleWidgetRefresh() async {
  if (kIsWeb ||
      defaultTargetPlatform == TargetPlatform.iOS ||
      defaultTargetPlatform == TargetPlatform.macOS) {
    return;
  }
  await Workmanager().registerPeriodicTask(
    _uniqueTaskName,
    _taskName,
    frequency: const Duration(hours: 1),
    constraints: Constraints(networkType: NetworkType.connected),
    existingWorkPolicy: ExistingWorkPolicy.keep,
  );
}

Future<void> cancelWidgetRefresh() async {
  if (kIsWeb) return;
  await Workmanager().cancelByUniqueName(_uniqueTaskName);
}
