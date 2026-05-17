import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:moe_weather/features/ads/ads_tier_provider.dart';

class _Probe extends ConsumerWidget {
  const _Probe({required this.onBuild});
  final void Function(bool isPro) onBuild;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    onBuild(isProForRef(ref));
    return const SizedBox.shrink();
  }
}

void main() {
  setUp(resetIsProResolverForTesting);
  tearDown(resetIsProResolverForTesting);

  testWidgets('default resolver treats everyone as free', (tester) async {
    bool? observed;
    await tester.pumpWidget(
      ProviderScope(
        child: _Probe(onBuild: (v) => observed = v),
      ),
    );
    expect(observed, isFalse);
  });

  testWidgets('setIsProResolver wires a real resolver', (tester) async {
    setIsProResolver((_) => true);
    bool? observed;
    await tester.pumpWidget(
      ProviderScope(
        child: _Probe(onBuild: (v) => observed = v),
      ),
    );
    expect(observed, isTrue);
  });

  testWidgets('resetIsProResolverForTesting restores defaults', (tester) async {
    setIsProResolver((_) => true);
    resetIsProResolverForTesting();
    bool? observed;
    await tester.pumpWidget(
      ProviderScope(
        child: _Probe(onBuild: (v) => observed = v),
      ),
    );
    expect(observed, isFalse);
  });
}
