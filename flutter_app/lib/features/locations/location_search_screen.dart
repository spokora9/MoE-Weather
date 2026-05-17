import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:moe_weather/api/models/geocode_result.dart';
import 'geocode_provider.dart';

class LocationSearchScreen extends ConsumerStatefulWidget {
  const LocationSearchScreen({super.key});

  @override
  ConsumerState<LocationSearchScreen> createState() =>
      _LocationSearchScreenState();
}

class _LocationSearchScreenState extends ConsumerState<LocationSearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onQueryChanged(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      ref.read(geocodeProvider.notifier).search(query);
    });
  }

  @override
  Widget build(BuildContext context) {
    final resultsAsync = ref.watch(geocodeProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Search location…',
            border: InputBorder.none,
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _controller.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: () {
                      _controller.clear();
                      ref.read(geocodeProvider.notifier).clear();
                    },
                  )
                : null,
          ),
          onChanged: _onQueryChanged,
        ),
      ),
      body: Column(
        children: [
          resultsAsync.isLoading
              ? LinearProgressIndicator(color: colorScheme.primary)
              : const SizedBox.shrink(),
          Expanded(
            child: resultsAsync.when(
              loading: () => const SizedBox.shrink(),
              error: (error, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'Error: $error',
                    style: TextStyle(color: colorScheme.error),
                  ),
                ),
              ),
              data: (results) {
                if (results.isEmpty) {
                  return const SizedBox.shrink();
                }
                return ListView.builder(
                  itemCount: results.length,
                  itemBuilder: (context, index) {
                    final result = results[index];
                    final subtitle = [result.state, result.country]
                        .whereType<String>()
                        .join(', ');
                    return ListTile(
                      leading: const Icon(Icons.location_on),
                      title: Text(result.name),
                      subtitle: subtitle.isNotEmpty ? Text(subtitle) : null,
                      onTap: () => Navigator.pop(context, result),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
