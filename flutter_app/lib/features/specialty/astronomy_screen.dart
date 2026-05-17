import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:moe_weather/api/models/weather_response.dart';

class AstronomyScreen extends ConsumerWidget {
  const AstronomyScreen({super.key, required this.days});

  final List<DailyForecast> days;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (days.isEmpty) {
      return const Center(child: Text('No forecast data'));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: days.length,
      itemBuilder: (context, index) => _DayCard(day: days[index]),
    );
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({required this.day});

  final DailyForecast day;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final dayLength = day.sunset.difference(day.sunrise);
    final hours = dayLength.inHours;
    final minutes = dayLength.inMinutes % 60;
    final dateLabel = _formatDate(day.date);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: ExpansionTile(
        title: Text(
          dateLabel,
          style: theme.textTheme.titleMedium?.copyWith(
            color: cs.onSurface,
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(
          '${_formatTime(day.sunrise)} – ${_formatTime(day.sunset)}',
          style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: CustomPaint(
                    size: const Size(220, 110),
                    painter: _SunArcPainter(
                      sunrise: day.sunrise,
                      sunset: day.sunset,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                _InfoRow(label: 'Sunrise', value: _formatTime(day.sunrise)),
                _InfoRow(label: 'Sunset', value: _formatTime(day.sunset)),
                _InfoRow(
                  label: 'Day length',
                  value: '${hours}h ${minutes}m',
                ),
                if (day.uvIndex != null)
                  _InfoRow(
                    label: 'UV Index',
                    value: day.uvIndex!.toStringAsFixed(1),
                    valueColor: _uvColor(day.uvIndex!),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _uvColor(double uv) {
    if (uv <= 2) return const Color(0xFF4CAF50);
    if (uv <= 5) return const Color(0xFFFFEB3B);
    if (uv <= 7) return const Color(0xFFFF9800);
    if (uv <= 10) return const Color(0xFFF44336);
    return const Color(0xFF9C27B0);
  }

  String _formatDate(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final weekday = days[dt.weekday - 1];
    return '$weekday, ${months[dt.month - 1]} ${dt.day}';
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: cs.onSurfaceVariant,
            ),
          ),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: valueColor ?? cs.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _SunArcPainter extends CustomPainter {
  const _SunArcPainter({required this.sunrise, required this.sunset});

  final DateTime sunrise;
  final DateTime sunset;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height);
    final radius = size.width / 2 - 8;

    // Track arc: 180 degrees (left to right, above horizon)
    final trackPaint = Paint()
      ..color = Colors.amber.withOpacity(0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      math.pi,
      math.pi,
      false,
      trackPaint,
    );

    // Horizon line
    final horizonPaint = Paint()
      ..color = Colors.amber.withOpacity(0.4)
      ..strokeWidth = 1.5;
    canvas.drawLine(
      Offset(4, size.height),
      Offset(size.width - 4, size.height),
      horizonPaint,
    );

    // Sun position based on current time
    final now = DateTime.now();
    double fraction;
    if (now.isBefore(sunrise)) {
      fraction = 0.0;
    } else if (now.isAfter(sunset)) {
      fraction = 1.0;
    } else {
      final total = sunset.difference(sunrise).inSeconds;
      final elapsed = now.difference(sunrise).inSeconds;
      fraction = total > 0 ? elapsed / total : 0.5;
    }

    final sunAngle = math.pi + fraction * math.pi;
    final sunPos = Offset(
      center.dx + radius * math.cos(sunAngle),
      center.dy + radius * math.sin(sunAngle),
    );

    // Glow
    canvas.drawCircle(
      sunPos,
      10,
      Paint()..color = Colors.amber.withOpacity(0.25),
    );
    // Sun
    canvas.drawCircle(
      sunPos,
      7,
      Paint()..color = Colors.amber,
    );

    // Sunrise / sunset labels
    final labelStyle = const TextStyle(
      color: Colors.amber,
      fontSize: 10,
      fontWeight: FontWeight.w500,
    );

    final risePainter = TextPainter(
      text: TextSpan(
        text: '${sunrise.hour.toString().padLeft(2, '0')}:${sunrise.minute.toString().padLeft(2, '0')}',
        style: labelStyle,
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    risePainter.paint(canvas, Offset(2, size.height - risePainter.height - 2));

    final setPainter = TextPainter(
      text: TextSpan(
        text: '${sunset.hour.toString().padLeft(2, '0')}:${sunset.minute.toString().padLeft(2, '0')}',
        style: labelStyle,
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    setPainter.paint(
      canvas,
      Offset(size.width - setPainter.width - 2, size.height - setPainter.height - 2),
    );
  }

  @override
  bool shouldRepaint(_SunArcPainter old) =>
      old.sunrise != sunrise || old.sunset != sunset;
}
