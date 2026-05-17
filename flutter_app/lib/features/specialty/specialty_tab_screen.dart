import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:moe_weather/api/models/weather_response.dart';

import 'air_quality_screen.dart';
import 'astronomy_screen.dart';
import 'marine_screen.dart';

class SpecialtyTabScreen extends ConsumerStatefulWidget {
  const SpecialtyTabScreen({
    super.key,
    required this.lat,
    required this.lon,
    required this.days,
  });

  final double lat;
  final double lon;
  final List<DailyForecast> days;

  @override
  ConsumerState<SpecialtyTabScreen> createState() => _SpecialtyTabScreenState();
}

class _SpecialtyTabScreenState extends ConsumerState<SpecialtyTabScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Specialty'),
        backgroundColor: cs.surface,
        foregroundColor: cs.onSurface,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.nights_stay), text: 'Astronomy'),
            Tab(icon: Icon(Icons.air), text: 'Air Quality'),
            Tab(icon: Icon(Icons.waves), text: 'Marine'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          AstronomyScreen(days: widget.days),
          AirQualityScreen(lat: widget.lat, lon: widget.lon),
          MarineScreen(lat: widget.lat, lon: widget.lon),
        ],
      ),
    );
  }
}
