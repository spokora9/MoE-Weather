import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';
import 'widget_data.dart';

const _appGroupId = 'group.com.moeweather.app';
const _iOSWidgetName = 'MoEWeatherWidget';
const _androidWidgetClass = 'com.moeweather.app.widgets.WeatherWidgetReceiver';

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
      HomeWidget.saveWidgetData<double>(WidgetDataKeys.temperature, snapshot.temperature),
      HomeWidget.saveWidgetData<double>(WidgetDataKeys.feelsLike, snapshot.feelsLike),
      HomeWidget.saveWidgetData<String>(WidgetDataKeys.description, snapshot.description),
      HomeWidget.saveWidgetData<int>(WidgetDataKeys.weatherCode, snapshot.weatherCode),
      HomeWidget.saveWidgetData<String>(WidgetDataKeys.locationName, snapshot.locationName),
      HomeWidget.saveWidgetData<double>(WidgetDataKeys.humidity, snapshot.humidity),
      HomeWidget.saveWidgetData<double>(WidgetDataKeys.windSpeed, snapshot.windSpeed),
      if (snapshot.highTemp != null)
        HomeWidget.saveWidgetData<double>(WidgetDataKeys.highTemp, snapshot.highTemp!),
      if (snapshot.lowTemp != null)
        HomeWidget.saveWidgetData<double>(WidgetDataKeys.lowTemp, snapshot.lowTemp!),
      HomeWidget.saveWidgetData<String>(
          WidgetDataKeys.lastUpdated, snapshot.lastUpdated.toIso8601String()),
      HomeWidget.saveWidgetData<String>(WidgetDataKeys.unitLabel, snapshot.unitLabel),
    ]);
    await HomeWidget.updateWidget(
      iOSName: _iOSWidgetName,
      androidName: _androidWidgetClass,
    );
  }
}

final widgetDataServiceProvider = Provider<WidgetDataService>((_) => WidgetDataService());
