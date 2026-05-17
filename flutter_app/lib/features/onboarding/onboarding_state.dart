import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

enum OnboardingStep { welcome, permissions, locationSetup, done }

class OnboardingNotifier extends Notifier<OnboardingStep> {
  static const _boxName = 'onboarding';
  static const _completeKey = 'complete';

  @override
  OnboardingStep build() {
    final box = Hive.box<bool>(_boxName);
    final complete = box.get(_completeKey, defaultValue: false) ?? false;
    return complete ? OnboardingStep.done : OnboardingStep.welcome;
  }

  void advance() {
    final steps = OnboardingStep.values;
    final next = steps[(state.index + 1).clamp(0, steps.length - 1)];
    state = next;
    if (next == OnboardingStep.done) {
      Hive.box<bool>(_boxName).put(_completeKey, true);
    }
  }

  void skip() {
    state = OnboardingStep.done;
    Hive.box<bool>(_boxName).put(_completeKey, true);
  }
}

final onboardingProvider =
    NotifierProvider<OnboardingNotifier, OnboardingStep>(OnboardingNotifier.new);

final onboardingCompleteProvider = Provider<bool>(
  (ref) => ref.watch(onboardingProvider) == OnboardingStep.done,
);
