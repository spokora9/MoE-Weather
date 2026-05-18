import 'package:flutter/material.dart';
import 'package:moe_weather/features/forecast/weather_code_icon.dart';
import 'widget_data.dart';

enum WidgetRenderSize { small, medium, large }

const _bg = Color(0xFF0D1B2A);
const _white = Color(0xFFFFFFFF);
const _secondary = Color(0xFFB0B8CC);
const _divider = Color(0xFF1E2E3E);
const _alertBg = Color(0xFF7A3000);
const _alertText = Color(0xFFFFCC80);

class WeatherWidgetCanvas extends StatelessWidget {
  const WeatherWidgetCanvas({
    super.key,
    required this.snapshot,
    this.renderSize = WidgetRenderSize.medium,
  });

  final WidgetSnapshot snapshot;
  final WidgetRenderSize renderSize;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _bg,
      child: switch (renderSize) {
        WidgetRenderSize.small => _SmallCanvas(s: snapshot),
        WidgetRenderSize.medium => _MediumCanvas(s: snapshot),
        WidgetRenderSize.large => _LargeCanvas(s: snapshot),
      },
    );
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

String _temp(double v, String unit) => '${v.round()}$unit';

String _timeLabel(DateTime dt) {
  final h = dt.hour;
  if (h == 0) return '12AM';
  if (h < 12) return '${h}AM';
  if (h == 12) return '12PM';
  return '${h - 12}PM';
}

String _clockTime(DateTime dt) {
  final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
  final m = dt.minute.toString().padLeft(2, '0');
  final period = dt.hour < 12 ? 'AM' : 'PM';
  return '$h:$m $period';
}

Duration _remaining(DateTime end) {
  final diff = end.difference(DateTime.now());
  if (diff.inHours >= 1) return Duration(hours: diff.inHours);
  return Duration(minutes: diff.inMinutes.clamp(0, 59));
}

String _remainingLabel(DateTime end) {
  final r = _remaining(end);
  if (r.inHours >= 1) return '${r.inHours}h left';
  return '${r.inMinutes}m left';
}

Widget _weatherIcon(int code, {double size = 16, Color color = _secondary}) {
  return Icon(weatherCodeIcon(code), size: size, color: color);
}

// ─── Alert band (shared by medium + large) ───────────────────────────────────

class _AlertBand extends StatelessWidget {
  const _AlertBand({required this.text, this.end});
  final String text;
  final DateTime? end;

  @override
  Widget build(BuildContext context) {
    final suffix = end != null ? '  ·  ${_remainingLabel(end!)}' : '';
    return Container(
      width: double.infinity,
      color: _alertBg,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, size: 13, color: _alertText),
          const SizedBox(width: 5),
          Expanded(
            child: Text(
              '$text$suffix',
              style: const TextStyle(
                  fontSize: 11, color: _alertText, fontWeight: FontWeight.w600),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Hourly strip (shared by medium + large) ──────────────────────────────────

class _HourlyStrip extends StatelessWidget {
  const _HourlyStrip({required this.hourly, required this.unitLabel, this.maxItems = 6});
  final List<HourlyWidgetEntry> hourly;
  final String unitLabel;
  final int maxItems;

  @override
  Widget build(BuildContext context) {
    final items = hourly.take(maxItems).toList();
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: items.map((h) => _HourlyCell(entry: h, unitLabel: unitLabel)).toList(),
    );
  }
}

class _HourlyCell extends StatelessWidget {
  const _HourlyCell({required this.entry, required this.unitLabel});
  final HourlyWidgetEntry entry;
  final String unitLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          _timeLabel(entry.time),
          style: const TextStyle(fontSize: 10, color: _secondary),
        ),
        const SizedBox(height: 3),
        _weatherIcon(entry.weatherCode, size: 14, color: _white),
        const SizedBox(height: 3),
        Text(
          _temp(entry.temperature, unitLabel),
          style: const TextStyle(fontSize: 12, color: _white, fontWeight: FontWeight.w600),
        ),
        Text(
          _temp(entry.feelsLike, unitLabel),
          style: const TextStyle(fontSize: 10, color: _secondary),
        ),
      ],
    );
  }
}

// ─── Sunrise / sunset compact row ─────────────────────────────────────────────

class _SunriseSunsetRow extends StatelessWidget {
  const _SunriseSunsetRow({required this.sunrise, required this.sunset});
  final DateTime sunrise;
  final DateTime sunset;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.wb_twilight, size: 11, color: Color(0xFFFFB74D)),
        const SizedBox(width: 3),
        Text(_clockTime(sunrise),
            style: const TextStyle(fontSize: 10, color: _secondary)),
        const SizedBox(width: 8),
        const Icon(Icons.nights_stay_outlined, size: 11, color: Color(0xFF90CAF9)),
        const SizedBox(width: 3),
        Text(_clockTime(sunset),
            style: const TextStyle(fontSize: 10, color: _secondary)),
      ],
    );
  }
}

// ─── Daylight progress bar (large only) ──────────────────────────────────────

class _DaylightBar extends StatelessWidget {
  const _DaylightBar({required this.sunrise, required this.sunset});
  final DateTime sunrise;
  final DateTime sunset;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final total = sunset.difference(sunrise).inMinutes;
    final elapsed = now.difference(sunrise).inMinutes;
    final fraction = total > 0 ? (elapsed / total).clamp(0.0, 1.0) : 0.0;

    return Row(
      children: [
        const Icon(Icons.wb_twilight, size: 13, color: Color(0xFFFFB74D)),
        const SizedBox(width: 6),
        Text(_clockTime(sunrise),
            style: const TextStyle(fontSize: 10, color: _secondary)),
        const SizedBox(width: 8),
        Expanded(
          child: Stack(
            alignment: Alignment.centerLeft,
            children: [
              Container(height: 4, decoration: BoxDecoration(
                color: _divider,
                borderRadius: BorderRadius.circular(2),
              )),
              FractionallySizedBox(
                widthFactor: fraction,
                child: Container(height: 4, decoration: BoxDecoration(
                  color: const Color(0xFFFFCC02),
                  borderRadius: BorderRadius.circular(2),
                )),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text(_clockTime(sunset),
            style: const TextStyle(fontSize: 10, color: _secondary)),
        const SizedBox(width: 6),
        const Icon(Icons.nights_stay_outlined, size: 13, color: Color(0xFF90CAF9)),
      ],
    );
  }
}

// ─── Small (160 × 160) ────────────────────────────────────────────────────────

class _SmallCanvas extends StatelessWidget {
  const _SmallCanvas({required this.s});
  final WidgetSnapshot s;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Location + weather icon
          Row(
            children: [
              Expanded(
                child: Text(
                  s.locationName,
                  style: const TextStyle(fontSize: 11, color: _secondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              _weatherIcon(s.weatherCode, size: 18, color: _white),
            ],
          ),
          const Spacer(),
          // Temperature + feels like
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                _temp(s.temperature, s.unitLabel),
                style: const TextStyle(
                    fontSize: 44, fontWeight: FontWeight.bold, color: _white,
                    height: 1.0),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('feels like',
                      style: TextStyle(fontSize: 9, color: _secondary)),
                  Text(
                    _temp(s.feelsLike, s.unitLabel),
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w600, color: _white),
                  ),
                ],
              ),
            ],
          ),
          const Spacer(),
          // Wind + humidity
          Row(
            children: [
              const Icon(Icons.air, size: 11, color: _secondary),
              const SizedBox(width: 3),
              Text('${s.windSpeed.round()} km/h',
                  style: const TextStyle(fontSize: 10, color: _secondary)),
              const SizedBox(width: 10),
              const Icon(Icons.water_drop_outlined, size: 11, color: _secondary),
              const SizedBox(width: 3),
              Text('${s.humidity.round()}%',
                  style: const TextStyle(fontSize: 10, color: _secondary)),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Medium (329 × 155) ───────────────────────────────────────────────────────

class _MediumCanvas extends StatelessWidget {
  const _MediumCanvas({required this.s});
  final WidgetSnapshot s;

  @override
  Widget build(BuildContext context) {
    final hasAlert = s.alertText != null;
    final showHours = hasAlert ? 5 : 6;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (hasAlert)
          _AlertBand(text: s.alertText!, end: s.alertEnd),

        // Header row
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: Row(
            children: [
              // Location + temp + feels
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s.locationName,
                        style: const TextStyle(fontSize: 10, color: _secondary),
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(_temp(s.temperature, s.unitLabel),
                            style: const TextStyle(
                                fontSize: 28, fontWeight: FontWeight.bold,
                                color: _white, height: 1.1)),
                        const SizedBox(width: 6),
                        Text('feels ${_temp(s.feelsLike, s.unitLabel)}',
                            style: const TextStyle(fontSize: 11, color: _secondary)),
                      ],
                    ),
                  ],
                ),
              ),
              // Sunrise + sunset (top right)
              if (s.sunrise != null && s.sunset != null)
                _SunriseSunsetRow(sunrise: s.sunrise!, sunset: s.sunset!),
            ],
          ),
        ),

        const SizedBox(height: 6),
        Container(height: 1, color: _divider),
        const SizedBox(height: 6),

        // Hourly strip
        if (s.hourly.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: _HourlyStrip(
                hourly: s.hourly, unitLabel: s.unitLabel, maxItems: showHours),
          ),
        const Spacer(),
      ],
    );
  }
}

// ─── Large (329 × 345) ────────────────────────────────────────────────────────

class _LargeCanvas extends StatelessWidget {
  const _LargeCanvas({required this.s});
  final WidgetSnapshot s;

  @override
  Widget build(BuildContext context) {
    final hasAlert = s.alertText != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (hasAlert)
          _AlertBand(text: s.alertText!, end: s.alertEnd),

        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Location + weather icon row
              Row(
                children: [
                  Expanded(
                    child: Text(s.locationName,
                        style: const TextStyle(fontSize: 12, color: _secondary),
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                  _weatherIcon(s.weatherCode, size: 20, color: _white),
                ],
              ),
              const SizedBox(height: 6),

              // Temperature + feels like
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(_temp(s.temperature, s.unitLabel),
                      style: const TextStyle(
                          fontSize: 52, fontWeight: FontWeight.bold,
                          color: _white, height: 1.0)),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('feels like',
                          style: TextStyle(fontSize: 10, color: _secondary)),
                      Text(_temp(s.feelsLike, s.unitLabel),
                          style: const TextStyle(
                              fontSize: 22, fontWeight: FontWeight.w600,
                              color: _white)),
                    ],
                  ),
                ],
              ),

              // Description + H/L
              Row(
                children: [
                  Text(s.description,
                      style: const TextStyle(fontSize: 12, color: _secondary)),
                  if (s.highTemp != null && s.lowTemp != null) ...[
                    const SizedBox(width: 8),
                    Text(
                      'H:${_temp(s.highTemp!, s.unitLabel)} '
                      'L:${_temp(s.lowTemp!, s.unitLabel)}',
                      style: const TextStyle(fontSize: 11, color: _secondary),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),

              // Wind + humidity
              Row(
                children: [
                  const Icon(Icons.air, size: 13, color: _secondary),
                  const SizedBox(width: 4),
                  Text('${s.windSpeed.round()} km/h',
                      style: const TextStyle(fontSize: 12, color: _secondary)),
                  const SizedBox(width: 16),
                  const Icon(Icons.water_drop_outlined, size: 13, color: _secondary),
                  const SizedBox(width: 4),
                  Text('${s.humidity.round()}%',
                      style: const TextStyle(fontSize: 12, color: _secondary)),
                ],
              ),
              const SizedBox(height: 10),

              // Daylight bar
              if (s.sunrise != null && s.sunset != null)
                _DaylightBar(sunrise: s.sunrise!, sunset: s.sunset!),
            ],
          ),
        ),

        const SizedBox(height: 8),
        Container(height: 1, color: _divider),
        const SizedBox(height: 8),

        // Hourly strip
        if (s.hourly.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: _HourlyStrip(hourly: s.hourly, unitLabel: s.unitLabel, maxItems: 7),
          ),

        const Spacer(),
      ],
    );
  }
}
