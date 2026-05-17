import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'current_conditions_card.dart';
import 'daily_forecast_list.dart';
import 'forecast_provider.dart';
import 'hourly_forecast_list.dart';
import 'shimmer_loading.dart';
import 'weather_animation.dart';

class ForecastScreen extends ConsumerStatefulWidget {
  const ForecastScreen({
    super.key,
    required this.lat,
    required this.lon,
    required this.locationName,
  });

  final double lat;
  final double lon;
  final String locationName;

  @override
  ConsumerState<ForecastScreen> createState() => _ForecastScreenState();
}

class _ForecastScreenState extends ConsumerState<ForecastScreen> {
  @override
  void initState() {
    super.initState();
    // Kick off the initial load after the first frame so ref is ready
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(forecastProvider.notifier).load((lat: widget.lat, lon: widget.lon));
    });
  }

  @override
  Widget build(BuildContext context) {
    final forecast = ref.watch(forecastProvider);
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return forecast.when(
      loading: () => Scaffold(
        body: ListView(
          children: const [
            ShimmerCard(),
            ShimmerCard(),
            ShimmerCard(),
            ShimmerCard(),
            ShimmerCard(),
            ShimmerListItem(),
            ShimmerListItem(),
            ShimmerListItem(),
            ShimmerListItem(),
            ShimmerListItem(),
            ShimmerListItem(),
            ShimmerListItem(),
            ShimmerListItem(),
            ShimmerListItem(),
            ShimmerListItem(),
          ],
        ),
      ),
      error: (e, _) => Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off, size: 48),
                const SizedBox(height: 16),
                Text('Failed to load weather', style: tt.titleMedium),
                const SizedBox(height: 8),
                Text(e.toString(), style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => ref.read(forecastProvider.notifier).refresh(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      ),
      data: (weather) {
        // Still loading (initial null state)
        if (weather == null) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        return Scaffold(
          body: Semantics(
            label: 'Pull to refresh forecast',
            child: RefreshIndicator(
              onRefresh: () => ref.read(forecastProvider.notifier).refresh(),
              child: CustomScrollView(
                slivers: [
                  SliverAppBar(
                    title: Text(widget.locationName),
                    floating: true,
                    snap: true,
                  ),
                  // Alert banner — show when alerts exist
                  if (weather.alerts.isNotEmpty)
                    SliverToBoxAdapter(
                      child: _AlertBanner(
                        headline: weather.alerts.first.headline,
                        count: weather.alerts.length,
                      ),
                    ),
                  // Current conditions
                  if (weather.current != null)
                    SliverToBoxAdapter(
                      child: Semantics(
                        label: 'Current weather conditions',
                        child: Hero(
                          tag: 'current_conditions',
                          child: CurrentConditionsCard(
                            current: weather.current!,
                            locationName: widget.locationName,
                            animationWidget: WeatherAnimationWidget(
                              weatherCode: weather.current!.weatherCode,
                            ),
                          ),
                        ),
                      ),
                    )
                  else
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        'Current conditions unavailable.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ),
                // Hourly forecast
                if (weather.hourly.isNotEmpty)
                  SliverToBoxAdapter(
                    child: HourlyForecastList(hours: weather.hourly),
                  ),
                // Daily forecast
                if (weather.daily.isNotEmpty)
                  SliverToBoxAdapter(
                    child: DailyForecastList(days: weather.daily),
                  ),
                  // Bottom padding
                  const SliverToBoxAdapter(child: SizedBox(height: 24)),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _AlertBanner extends StatelessWidget {
  const _AlertBanner({required this.headline, required this.count});
  final String headline;
  final int count;

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return Container(
      color: Colors.amber.shade700,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              count > 1 ? '$headline (+${count - 1} more)' : headline,
              style: tt.bodyMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w600),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
