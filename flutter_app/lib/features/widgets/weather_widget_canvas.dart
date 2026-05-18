import 'package:flutter/material.dart';
import 'widget_data.dart';

enum WidgetRenderSize { small, medium }

const _bg = Color(0xFF0D1B2A);
const _white = Color(0xFFFFFFFF);
const _secondary = Color(0xFFB0B8CC);
const _divider = Color(0xFF2A3A4A);

class WeatherWidgetCanvas extends StatelessWidget {
  const WeatherWidgetCanvas({
    super.key,
    required this.snapshot,
    this.renderSize = WidgetRenderSize.medium,
  });

  final WidgetSnapshot snapshot;
  final WidgetRenderSize renderSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _bg,
      padding: const EdgeInsets.all(12),
      child: renderSize == WidgetRenderSize.small
          ? _SmallLayout(snapshot: snapshot)
          : _MediumLayout(snapshot: snapshot),
    );
  }
}

String _fmt(double v, String unit) => '${v.round()}$unit';

class _SmallLayout extends StatelessWidget {
  const _SmallLayout({required this.snapshot});
  final WidgetSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          snapshot.locationName,
          style: const TextStyle(fontSize: 11, color: _secondary),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        Text(
          _fmt(snapshot.temperature, snapshot.unitLabel),
          style: const TextStyle(fontSize: 46, fontWeight: FontWeight.bold, color: _white),
        ),
        Text(
          snapshot.description,
          style: const TextStyle(fontSize: 12, color: _secondary),
          maxLines: 1,
        ),
        const Spacer(),
        if (snapshot.highTemp != null && snapshot.lowTemp != null)
          Row(
            children: [
              Text(
                'H:${_fmt(snapshot.highTemp!, snapshot.unitLabel)}',
                style: const TextStyle(fontSize: 11, color: _white),
              ),
              const SizedBox(width: 6),
              Text(
                'L:${_fmt(snapshot.lowTemp!, snapshot.unitLabel)}',
                style: const TextStyle(fontSize: 11, color: _secondary),
              ),
            ],
          ),
      ],
    );
  }
}

class _MediumLayout extends StatelessWidget {
  const _MediumLayout({required this.snapshot});
  final WidgetSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                snapshot.locationName,
                style: const TextStyle(fontSize: 11, color: _secondary),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                _fmt(snapshot.temperature, snapshot.unitLabel),
                style: const TextStyle(
                    fontSize: 42, fontWeight: FontWeight.bold, color: _white),
              ),
              Text(
                snapshot.description,
                style: const TextStyle(fontSize: 12, color: _secondary),
                maxLines: 2,
              ),
            ],
          ),
        ),
        Container(
          width: 1,
          margin: const EdgeInsets.symmetric(vertical: 4),
          color: _divider,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              if (snapshot.highTemp != null && snapshot.lowTemp != null)
                _Stat(
                  'H:${_fmt(snapshot.highTemp!, snapshot.unitLabel)}  '
                  'L:${_fmt(snapshot.lowTemp!, snapshot.unitLabel)}',
                ),
              _Stat('${snapshot.humidity.round()}% humidity'),
              _Stat('${snapshot.windSpeed.round()} km/h wind'),
              _Stat('Feels ${_fmt(snapshot.feelsLike, snapshot.unitLabel)}'),
            ],
          ),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(fontSize: 11, color: _secondary),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}
