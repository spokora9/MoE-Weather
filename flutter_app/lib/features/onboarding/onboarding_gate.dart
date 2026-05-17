import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'onboarding_screen.dart';
import 'onboarding_state.dart';

class OnboardingGate extends ConsumerWidget {
  const OnboardingGate({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final complete = ref.watch(onboardingCompleteProvider);
    return complete ? child : const OnboardingScreen();
  }
}
