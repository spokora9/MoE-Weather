import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/models/geocode_result.dart';

class GeocodeNotifier extends AsyncNotifier<List<GeocodeResult>> {
  @override
  List<GeocodeResult> build() => const [];

  Future<void> search(String query) async {
    if (query.trim().length < 2) {
      state = const AsyncData([]);
      return;
    }
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final response = await ref.read(apiClientProvider).dio.get<List<dynamic>>(
        '/api/geocode',
        queryParameters: {'q': query},
      );
      return (response.data ?? [])
          .map((e) => GeocodeResult.fromJson(e as Map<String, dynamic>))
          .toList();
    });
  }

  void clear() => state = const AsyncData([]);
}

final geocodeProvider =
    AsyncNotifierProvider<GeocodeNotifier, List<GeocodeResult>>(
        GeocodeNotifier.new);
