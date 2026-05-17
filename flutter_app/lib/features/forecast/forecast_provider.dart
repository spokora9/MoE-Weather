import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:moe_weather/api/models/weather_response.dart';
import 'weather_repository.dart';

typedef ForecastParams = ({double lat, double lon});

class ForecastNotifier extends AsyncNotifier<WeatherResponse?> {
  ForecastParams? _params;

  @override
  WeatherResponse? build() => null;

  Future<void> load(ForecastParams params) async {
    _params = params;
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(weatherRepositoryProvider).getWeather(params.lat, params.lon),
    );
  }

  Future<void> refresh() async {
    final p = _params;
    if (p == null) return;
    await load(p);
  }
}

final forecastProvider =
    AsyncNotifierProvider<ForecastNotifier, WeatherResponse?>(ForecastNotifier.new);
