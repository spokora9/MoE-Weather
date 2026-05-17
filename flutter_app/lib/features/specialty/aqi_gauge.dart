import 'dart:math' as math;

import 'package:flutter/material.dart';

class AqiGauge extends StatelessWidget {
  const AqiGauge({super.key, required this.aqi, this.size = 160.0});

  final int aqi;
  final double size;

  @override
  Widget build(BuildContext context) {
    final category = _categoryLabel(aqi);
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _AqiGaugePainter(aqi: aqi, category: category),
      ),
    );
  }

  static String _categoryLabel(int aqi) {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }
}

class _AqiGaugePainter extends CustomPainter {
  _AqiGaugePainter({required this.aqi, required this.category});

  final int aqi;
  final String category;

  // EPA standard AQI colors
  static const Color _green = Color(0xFF00E400);
  static const Color _yellow = Color(0xFFFFFF00);
  static const Color _orange = Color(0xFFFF7E00);
  static const Color _red = Color(0xFFFF0000);
  static const Color _purple = Color(0xFF8F3F97);
  static const Color _maroon = Color(0xFF7E0023);

  // Gauge spans 240 degrees: starts at 150° (bottom-left), sweeps clockwise to 390° (bottom-right)
  static const double _startAngle = 150.0;
  static const double _totalSweep = 240.0;

  // AQI breakpoints for the 5 visible segments (0-50, 51-100, 101-150, 151-200, 201-300+)
  // Each segment is 240/5 = 48 degrees wide
  static const double _segmentDeg = _totalSweep / 5;

  Color _colorForAqi(int value) {
    if (value <= 50) return _green;
    if (value <= 100) return _yellow;
    if (value <= 150) return _orange;
    if (value <= 200) return _red;
    if (value <= 300) return _purple;
    return _maroon;
  }

  double _aqiToAngle(int value) {
    // Map AQI 0-300 onto the 240-degree sweep; cap at 300 for display
    final clamped = value.clamp(0, 300);
    return _startAngle + (clamped / 300.0) * _totalSweep;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width / 2) * 0.75;

    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 16
      ..strokeCap = StrokeCap.round;

    // Segment colors and their AQI ranges
    final segments = <({Color color, int from, int to})>[
      (color: _green, from: 0, to: 50),
      (color: _yellow, from: 51, to: 100),
      (color: _orange, from: 101, to: 150),
      (color: _red, from: 151, to: 200),
      (color: _purple, from: 201, to: 300),
    ];

    for (var i = 0; i < segments.length; i++) {
      final startDeg = _startAngle + i * _segmentDeg;
      trackPaint.color = segments[i].color.withOpacity(0.35);
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        _deg2rad(startDeg),
        _deg2rad(_segmentDeg),
        false,
        trackPaint,
      );
    }

    // Draw filled arc up to current AQI position
    final fillSweep = ((aqi.clamp(0, 300) / 300.0) * _totalSweep);
    if (fillSweep > 0) {
      final fillPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 16
        ..strokeCap = StrokeCap.round
        ..color = _colorForAqi(aqi);
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        _deg2rad(_startAngle),
        _deg2rad(fillSweep),
        false,
        fillPaint,
      );
    }

    // Draw needle
    final needleAngle = _deg2rad(_aqiToAngle(aqi));
    final needlePaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final needleTip = Offset(
      center.dx + (radius - 8) * math.cos(needleAngle),
      center.dy + (radius - 8) * math.sin(needleAngle),
    );
    final needleBase = Offset(
      center.dx + (radius * 0.3) * math.cos(needleAngle + math.pi),
      center.dy + (radius * 0.3) * math.sin(needleAngle + math.pi),
    );
    canvas.drawLine(needleBase, needleTip, needlePaint);

    // Center dot
    canvas.drawCircle(
      center,
      5,
      Paint()..color = Colors.white,
    );

    // AQI number
    final aqiPainter = TextPainter(
      text: TextSpan(
        text: '$aqi',
        style: TextStyle(
          color: _colorForAqi(aqi),
          fontSize: size.width * 0.22,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    aqiPainter.paint(
      canvas,
      center.translate(
        -aqiPainter.width / 2,
        -aqiPainter.height / 2 - size.height * 0.05,
      ),
    );

    // Category label
    final catPainter = TextPainter(
      text: TextSpan(
        text: category,
        style: TextStyle(
          color: Colors.white70,
          fontSize: size.width * 0.09,
          fontWeight: FontWeight.w500,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: size.width * 0.9);
    catPainter.paint(
      canvas,
      center.translate(
        -catPainter.width / 2,
        aqiPainter.height / 2 - size.height * 0.05 + 4,
      ),
    );
  }

  @override
  bool shouldRepaint(_AqiGaugePainter old) =>
      old.aqi != aqi || old.category != category;

  double _deg2rad(double deg) => deg * math.pi / 180.0;
}
