import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:moe_weather/main.dart';

void main() {
  testWidgets('App renders with home shell', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: MoEWeatherApp()));
    expect(find.text('MoE Weather'), findsAtLeastNWidgets(1));
  });
}
