import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'air_quality_model.dart';
import 'marine_model.dart';
import 'specialty_repository.dart';

typedef _LatLon = ({double lat, double lon});

class AirQualityNotifier extends AsyncNotifier<AirQualityResponse?> {
  _LatLon? _params;

  @override
  AirQualityResponse? build() => null;

  Future<void> load(double lat, double lon) async {
    _params = (lat: lat, lon: lon);
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(specialtyRepositoryProvider).getAirQuality(lat, lon),
    );
  }

  Future<void> refresh() async {
    final p = _params;
    if (p == null) return;
    await load(p.lat, p.lon);
  }
}

final airQualityProvider =
    AsyncNotifierProvider<AirQualityNotifier, AirQualityResponse?>(
  AirQualityNotifier.new,
);

class MarineNotifier extends AsyncNotifier<MarineResponse?> {
  _LatLon? _params;

  @override
  MarineResponse? build() => null;

  Future<void> load(double lat, double lon) async {
    _params = (lat: lat, lon: lon);
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(specialtyRepositoryProvider).getMarine(lat, lon),
    );
  }

  Future<void> refresh() async {
    final p = _params;
    if (p == null) return;
    await load(p.lat, p.lon);
  }
}

final marineProvider =
    AsyncNotifierProvider<MarineNotifier, MarineResponse?>(MarineNotifier.new);
