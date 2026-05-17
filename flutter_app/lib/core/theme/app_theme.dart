import 'package:flutter/material.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF1565C0),
        brightness: Brightness.light,
        textTheme: _textTheme,
        cardTheme: _cardTheme,
        appBarTheme: _appBarTheme,
        filledButtonTheme: _filledButtonTheme,
      );

  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF42A5F5),
        brightness: Brightness.dark,
        textTheme: _textTheme,
        cardTheme: _cardTheme,
        appBarTheme: _appBarTheme,
        filledButtonTheme: _filledButtonTheme,
      );

  static const TextTheme _textTheme = TextTheme(
    displayLarge: TextStyle(fontSize: 48, fontWeight: FontWeight.bold),
    titleLarge: TextStyle(fontSize: 22, fontWeight: FontWeight.w500),
  );

  static final CardTheme _cardTheme = CardTheme(
    elevation: 2,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
    ),
  );

  static const AppBarTheme _appBarTheme = AppBarTheme(
    centerTitle: true,
    elevation: 0,
  );

  static final FilledButtonThemeData _filledButtonTheme = FilledButtonThemeData(
    style: FilledButton.styleFrom(),
  );
}
