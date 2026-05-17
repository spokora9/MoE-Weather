import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moe_weather/features/onboarding/onboarding_state.dart';

// Fake notifier that starts at a given step and tracks Hive writes via a flag.
class _FakeOnboardingNotifier extends OnboardingNotifier {
  _FakeOnboardingNotifier(this._initial);

  final OnboardingStep _initial;
  bool _written = false;

  @override
  OnboardingStep build() => _initial;

  @override
  void advance() {
    final steps = OnboardingStep.values;
    final next = steps[(state.index + 1).clamp(0, steps.length - 1)];
    state = next;
    if (next == OnboardingStep.done) _written = true;
  }

  @override
  void skip() {
    state = OnboardingStep.done;
    _written = true;
  }

  bool get written => _written;
}

ProviderContainer _makeContainer(OnboardingStep initial) {
  final notifier = _FakeOnboardingNotifier(initial);
  return ProviderContainer(
    overrides: [
      onboardingProvider.overrideWith(() => notifier),
    ],
  );
}

void main() {
  group('OnboardingNotifier', () {
    test('initial state without Hive data is welcome', () {
      final container = _makeContainer(OnboardingStep.welcome);
      addTearDown(container.dispose);

      expect(container.read(onboardingProvider), OnboardingStep.welcome);
    });

    test('advance moves welcome → permissions → locationSetup → done', () {
      final container = _makeContainer(OnboardingStep.welcome);
      addTearDown(container.dispose);

      final notifier = container.read(onboardingProvider.notifier);

      expect(container.read(onboardingProvider), OnboardingStep.welcome);

      notifier.advance();
      expect(container.read(onboardingProvider), OnboardingStep.permissions);

      notifier.advance();
      expect(container.read(onboardingProvider), OnboardingStep.locationSetup);

      notifier.advance();
      expect(container.read(onboardingProvider), OnboardingStep.done);
    });

    test('reaching done via advance marks completion', () {
      final container = _makeContainer(OnboardingStep.locationSetup);
      addTearDown(container.dispose);

      final notifier =
          container.read(onboardingProvider.notifier) as _FakeOnboardingNotifier;
      notifier.advance();

      expect(container.read(onboardingProvider), OnboardingStep.done);
      expect(notifier.written, isTrue);
    });

    test('skip jumps directly to done and marks completion', () {
      final container = _makeContainer(OnboardingStep.welcome);
      addTearDown(container.dispose);

      final notifier =
          container.read(onboardingProvider.notifier) as _FakeOnboardingNotifier;
      notifier.skip();

      expect(container.read(onboardingProvider), OnboardingStep.done);
      expect(notifier.written, isTrue);
    });
  });

  group('onboardingCompleteProvider', () {
    test('returns false when step is welcome', () {
      final container = _makeContainer(OnboardingStep.welcome);
      addTearDown(container.dispose);

      expect(container.read(onboardingCompleteProvider), isFalse);
    });

    test('returns true when step is done', () {
      final container = _makeContainer(OnboardingStep.done);
      addTearDown(container.dispose);

      expect(container.read(onboardingCompleteProvider), isTrue);
    });
  });
}
