enum TemperatureUnit { celsius, fahrenheit }

enum WindSpeedUnit { ms, kmh, mph, knots }

enum PressureUnit { hpa, inhg, mmhg }

class AppSettings {
  const AppSettings({
    this.temperatureUnit = TemperatureUnit.celsius,
    this.windSpeedUnit = WindSpeedUnit.ms,
    this.pressureUnit = PressureUnit.hpa,
    this.use24HourClock = true,
    this.showAlerts = true,
  });

  final TemperatureUnit temperatureUnit;
  final WindSpeedUnit windSpeedUnit;
  final PressureUnit pressureUnit;
  final bool use24HourClock;
  final bool showAlerts;

  AppSettings copyWith({
    TemperatureUnit? temperatureUnit,
    WindSpeedUnit? windSpeedUnit,
    PressureUnit? pressureUnit,
    bool? use24HourClock,
    bool? showAlerts,
  }) {
    return AppSettings(
      temperatureUnit: temperatureUnit ?? this.temperatureUnit,
      windSpeedUnit: windSpeedUnit ?? this.windSpeedUnit,
      pressureUnit: pressureUnit ?? this.pressureUnit,
      use24HourClock: use24HourClock ?? this.use24HourClock,
      showAlerts: showAlerts ?? this.showAlerts,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'temperatureUnit': temperatureUnit.name,
        'windSpeedUnit': windSpeedUnit.name,
        'pressureUnit': pressureUnit.name,
        'use24HourClock': use24HourClock,
        'showAlerts': showAlerts,
      };

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    return AppSettings(
      temperatureUnit: TemperatureUnit.values.firstWhere(
        (e) => e.name == json['temperatureUnit'],
        orElse: () => TemperatureUnit.celsius,
      ),
      windSpeedUnit: WindSpeedUnit.values.firstWhere(
        (e) => e.name == json['windSpeedUnit'],
        orElse: () => WindSpeedUnit.ms,
      ),
      pressureUnit: PressureUnit.values.firstWhere(
        (e) => e.name == json['pressureUnit'],
        orElse: () => PressureUnit.hpa,
      ),
      use24HourClock: (json['use24HourClock'] as bool?) ?? true,
      showAlerts: (json['showAlerts'] as bool?) ?? true,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AppSettings &&
          other.temperatureUnit == temperatureUnit &&
          other.windSpeedUnit == windSpeedUnit &&
          other.pressureUnit == pressureUnit &&
          other.use24HourClock == use24HourClock &&
          other.showAlerts == showAlerts;

  @override
  int get hashCode => Object.hash(
        runtimeType,
        temperatureUnit,
        windSpeedUnit,
        pressureUnit,
        use24HourClock,
        showAlerts,
      );
}

double convertTemperature(double celsius, TemperatureUnit unit) {
  return switch (unit) {
    TemperatureUnit.celsius => celsius,
    TemperatureUnit.fahrenheit => celsius * 9 / 5 + 32,
  };
}

String temperatureLabel(TemperatureUnit unit) {
  return switch (unit) {
    TemperatureUnit.celsius => '°C',
    TemperatureUnit.fahrenheit => '°F',
  };
}

double convertWindSpeed(double ms, WindSpeedUnit unit) {
  return switch (unit) {
    WindSpeedUnit.ms => ms,
    WindSpeedUnit.kmh => ms * 3.6,
    WindSpeedUnit.mph => ms * 2.237,
    WindSpeedUnit.knots => ms * 1.944,
  };
}

String windSpeedLabel(WindSpeedUnit unit) {
  return switch (unit) {
    WindSpeedUnit.ms => 'm/s',
    WindSpeedUnit.kmh => 'km/h',
    WindSpeedUnit.mph => 'mph',
    WindSpeedUnit.knots => 'kn',
  };
}

