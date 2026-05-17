import 'dart:math' as math;

import 'package:flutter/material.dart';

class WeatherAnimationWidget extends StatefulWidget {
  const WeatherAnimationWidget({super.key, required this.weatherCode});

  final int weatherCode;

  @override
  State<WeatherAnimationWidget> createState() => _WeatherAnimationWidgetState();
}

class _WeatherAnimationWidgetState extends State<WeatherAnimationWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      height: 200,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return CustomPaint(
            painter: _WeatherPainter(
              weatherCode: widget.weatherCode,
              progress: _controller.value,
            ),
          );
        },
      ),
    );
  }
}

class _WeatherPainter extends CustomPainter {
  _WeatherPainter({required this.weatherCode, required this.progress});

  final int weatherCode;
  final double progress;

  static final _random = math.Random(42);
  static final List<Offset> _rainParticles = List.generate(
    20,
    (i) => Offset(_random.nextDouble(), _random.nextDouble()),
  );
  static final List<Offset> _snowParticles = List.generate(
    15,
    (i) => Offset(_random.nextDouble(), _random.nextDouble()),
  );

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;

    if (weatherCode == 0) {
      _paintSunny(canvas, size, cx, cy);
    } else if (weatherCode >= 1 && weatherCode <= 3) {
      _paintCloudy(canvas, size, cx, cy);
    } else if ((weatherCode >= 51 && weatherCode <= 55) ||
        (weatherCode >= 61 && weatherCode <= 65) ||
        (weatherCode >= 80 && weatherCode <= 82)) {
      _paintRain(canvas, size, cx, cy);
    } else if ((weatherCode >= 71 && weatherCode <= 77) ||
        weatherCode == 85 ||
        weatherCode == 86) {
      _paintSnow(canvas, size, cx, cy);
    } else if (weatherCode >= 95 && weatherCode <= 99) {
      _paintThunderstorm(canvas, size, cx, cy);
    } else if (weatherCode == 45 || weatherCode == 48) {
      _paintFog(canvas, size, cx, cy);
    } else {
      _paintSpinner(canvas, size, cx, cy);
    }
  }

  void _paintSunny(Canvas canvas, Size size, double cx, double cy) {
    final pulse = 0.85 + 0.15 * math.sin(progress * 2 * math.pi);
    final radius = 36.0 * pulse;
    final paint = Paint()..color = const Color(0xFFFFD600);

    canvas.drawCircle(Offset(cx, cy), radius, paint);

    final rayPaint = Paint()
      ..color = const Color(0xFFFFD600)
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;

    final rotation = progress * 2 * math.pi;
    for (var i = 0; i < 8; i++) {
      final angle = rotation + i * math.pi / 4;
      final innerR = radius + 8;
      final outerR = radius + 22;
      canvas.drawLine(
        Offset(cx + innerR * math.cos(angle), cy + innerR * math.sin(angle)),
        Offset(cx + outerR * math.cos(angle), cy + outerR * math.sin(angle)),
        rayPaint,
      );
    }
  }

  void _paintCloudy(Canvas canvas, Size size, double cx, double cy) {
    final drift = 8.0 * math.sin(progress * 2 * math.pi);

    final paintWhite = Paint()..color = const Color(0xFFFFFFFF);
    final paintGrey = Paint()..color = const Color(0xFFB0BEC5);

    canvas.drawCircle(Offset(cx - 18 + drift, cy + 10), 30, paintGrey);
    canvas.drawCircle(Offset(cx + 20 + drift * 0.6, cy + 14), 24, paintGrey);
    canvas.drawCircle(Offset(cx - 10 - drift * 0.4, cy - 4), 34, paintWhite);
    canvas.drawCircle(Offset(cx + 22 - drift * 0.3, cy + 2), 26, paintWhite);
    canvas.drawCircle(Offset(cx + 2 + drift * 0.2, cy - 12), 30, paintWhite);
  }

  void _paintRain(Canvas canvas, Size size, double cx, double cy) {
    final cloudPaint = Paint()..color = const Color(0xFF90A4AE);
    canvas.drawCircle(Offset(cx - 20, cy - 30), 28, cloudPaint);
    canvas.drawCircle(Offset(cx + 16, cy - 26), 22, cloudPaint);
    canvas.drawCircle(Offset(cx, cy - 22), 32, cloudPaint);

    final dropPaint = Paint()
      ..color = const Color(0xFF42A5F5)
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;

    for (var i = 0; i < _rainParticles.length; i++) {
      final p = _rainParticles[i];
      final yFrac = (p.dy + progress) % 1.0;
      final x = cx - 60 + p.dx * 120;
      final y = cy - 10 + yFrac * 80;
      canvas.drawLine(
        Offset(x, y),
        Offset(x - 3, y + 10),
        dropPaint,
      );
    }
  }

  void _paintSnow(Canvas canvas, Size size, double cx, double cy) {
    final cloudPaint = Paint()..color = const Color(0xFFB0BEC5);
    canvas.drawCircle(Offset(cx - 20, cy - 36), 26, cloudPaint);
    canvas.drawCircle(Offset(cx + 16, cy - 32), 20, cloudPaint);
    canvas.drawCircle(Offset(cx, cy - 28), 30, cloudPaint);

    final flakePaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;

    for (var i = 0; i < _snowParticles.length; i++) {
      final p = _snowParticles[i];
      final yFrac = (p.dy + progress * 0.6) % 1.0;
      final sway = 6.0 * math.sin(progress * 2 * math.pi + i * 0.8);
      final x = cx - 55 + p.dx * 110 + sway;
      final y = cy - 10 + yFrac * 80;

      for (var arm = 0; arm < 6; arm++) {
        final angle = arm * math.pi / 3;
        canvas.drawLine(
          Offset(x, y),
          Offset(x + 5 * math.cos(angle), y + 5 * math.sin(angle)),
          flakePaint,
        );
      }
    }
  }

  void _paintThunderstorm(Canvas canvas, Size size, double cx, double cy) {
    final cloudPaint = Paint()..color = const Color(0xFF546E7A);
    canvas.drawCircle(Offset(cx - 24, cy - 38), 30, cloudPaint);
    canvas.drawCircle(Offset(cx + 18, cy - 34), 24, cloudPaint);
    canvas.drawCircle(Offset(cx - 4, cy - 30), 36, cloudPaint);

    final boltOpacity = progress < 0.4 || (progress >= 0.8 && progress < 1.0)
        ? 1.0
        : 0.0;

    if (boltOpacity > 0) {
      final boltColor = Color.fromRGBO(255, 238, 88, boltOpacity);
      final boltPaint = Paint()
        ..color = boltColor
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;

      final path = Path()
        ..moveTo(cx + 4, cy - 14)
        ..lineTo(cx - 10, cy + 8)
        ..lineTo(cx, cy + 8)
        ..lineTo(cx - 6, cy + 32)
        ..lineTo(cx + 14, cy + 4)
        ..lineTo(cx + 4, cy + 4)
        ..close();

      canvas.drawPath(path, boltPaint);
      canvas.drawPath(
        path,
        Paint()
          ..color = boltColor
          ..style = PaintingStyle.fill,
      );
    }
  }

  void _paintFog(Canvas canvas, Size size, double cx, double cy) {
    final bandPaint = Paint()
      ..color = const Color(0xFF90A4AE)
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;

    final offsets = [0.0, 0.25, 0.5, 0.75];
    for (var i = 0; i < offsets.length; i++) {
      final x = ((progress + offsets[i]) % 1.0) * size.width - size.width * 0.2;
      final y = cy - 40 + i * 30.0;
      final bandWidth = size.width * 0.7;
      canvas.drawLine(
        Offset(x, y),
        Offset(x + bandWidth, y),
        bandPaint,
      );
    }
  }

  void _paintSpinner(Canvas canvas, Size size, double cx, double cy) {
    final bg = Paint()
      ..color = Colors.grey.shade300
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke;
    final fg = Paint()
      ..color = Colors.blue
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(Offset(cx, cy), 40, bg);
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: 40),
      progress * 2 * math.pi,
      math.pi * 0.75,
      false,
      fg,
    );
  }

  @override
  bool shouldRepaint(_WeatherPainter old) =>
      old.progress != progress || old.weatherCode != weatherCode;
}
