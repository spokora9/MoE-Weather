import 'package:flutter/material.dart';

IconData weatherCodeIcon(int code) {
  if (code == 0) return Icons.wb_sunny;
  if (code >= 1 && code <= 3) return Icons.wb_cloudy;
  if (code == 45 || code == 48) return Icons.cloud; // foggy fallback
  if (const {51, 53, 55, 61, 63, 65, 80, 81, 82}.contains(code)) return Icons.grain;
  if (const {71, 73, 75, 77, 85, 86}.contains(code)) return Icons.ac_unit;
  if (const {95, 96, 99}.contains(code)) return Icons.thunderstorm;
  return Icons.cloud;
}

Color weatherCodeColor(int code, ColorScheme cs) {
  if (code == 0) return cs.tertiary;
  if (const {51, 53, 55, 61, 63, 65, 80, 81, 82}.contains(code)) return cs.primary;
  if (const {71, 73, 75, 77, 85, 86}.contains(code)) return cs.secondary;
  if (const {95, 96, 99}.contains(code)) return cs.error;
  return cs.onSurface;
}
