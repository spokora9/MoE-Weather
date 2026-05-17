import 'package:flutter/material.dart';

enum NotificationChannel { weatherAlerts, dailyBriefing, precipitation }

class NotificationPreferences {
  const NotificationPreferences({
    this.weatherAlerts = true,
    this.dailyBriefing = false,
    this.precipitation = false,
    this.dailyBriefingHour = 7,
    this.dailyBriefingMinute = 0,
  });

  final bool weatherAlerts;
  final bool dailyBriefing;
  final bool precipitation;
  final int dailyBriefingHour;
  final int dailyBriefingMinute;

  NotificationPreferences copyWith({
    bool? weatherAlerts,
    bool? dailyBriefing,
    bool? precipitation,
    int? dailyBriefingHour,
    int? dailyBriefingMinute,
  }) => NotificationPreferences(
    weatherAlerts: weatherAlerts ?? this.weatherAlerts,
    dailyBriefing: dailyBriefing ?? this.dailyBriefing,
    precipitation: precipitation ?? this.precipitation,
    dailyBriefingHour: dailyBriefingHour ?? this.dailyBriefingHour,
    dailyBriefingMinute: dailyBriefingMinute ?? this.dailyBriefingMinute,
  );

  Map<String, dynamic> toJson() => {
    'weatherAlerts': weatherAlerts,
    'dailyBriefing': dailyBriefing,
    'precipitation': precipitation,
    'dailyBriefingHour': dailyBriefingHour,
    'dailyBriefingMinute': dailyBriefingMinute,
  };

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) =>
      NotificationPreferences(
        weatherAlerts: json['weatherAlerts'] as bool? ?? true,
        dailyBriefing: json['dailyBriefing'] as bool? ?? false,
        precipitation: json['precipitation'] as bool? ?? false,
        dailyBriefingHour: json['dailyBriefingHour'] as int? ?? 7,
        dailyBriefingMinute: json['dailyBriefingMinute'] as int? ?? 0,
      );
}
