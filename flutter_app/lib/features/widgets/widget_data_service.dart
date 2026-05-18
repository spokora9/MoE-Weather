import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';
import 'weather_widget_canvas.dart';
import 'widget_data.dart';

const _appGroupId = 'group.com.moeweather.app';
const _iOSWidgetName = 'MoEWeatherWidget';
const _androidWidgetClass = 'com.moeweather.app.widgets.WeatherWidgetReceiver';

const _keySmall = 'widget_snapshot_small';
const _keyMedium = 'widget_snapshot_medium';

class WidgetDataService {
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized || kIsWeb) return;
    await HomeWidget.setAppGroupId(_appGroupId);
    _initialized = true;
  }

  Future<void> updateWidget(WidgetSnapshot snapshot) async {
    if (kIsWeb) return;
    await initialize();
    await Future.wait([
      HomeWidget.renderFlutterWidget(
        WeatherWidgetCanvas(snapshot: snapshot, renderSize: WidgetRenderSize.small),
        key: _keySmall,
        logicalSize: const Size(160, 160),
      ),
      HomeWidget.renderFlutterWidget(
        WeatherWidgetCanvas(snapshot: snapshot, renderSize: WidgetRenderSize.medium),
        key: _keyMedium,
        logicalSize: const Size(329, 155),
      ),
    ]);
    await HomeWidget.updateWidget(
      iOSName: _iOSWidgetName,
      androidName: _androidWidgetClass,
    );
  }
}

final widgetDataServiceProvider = Provider<WidgetDataService>((_) => WidgetDataService());
