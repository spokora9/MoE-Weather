import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'onboarding_state.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  late final PageController _pageController;

  static const _pageMap = {
    OnboardingStep.welcome: 0,
    OnboardingStep.permissions: 1,
    OnboardingStep.locationSetup: 2,
  };

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(onboardingProvider);

    ref.listen<OnboardingStep>(onboardingProvider, (_, next) {
      final page = _pageMap[next];
      if (page != null && _pageController.hasClients) {
        _pageController.animateToPage(
          page,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
        );
      }
    });

    final pageCount = _pageMap.length;

    return Scaffold(
      body: PageView.builder(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: pageCount,
        itemBuilder: (context, index) {
          return switch (index) {
            0 => const _WelcomePage(),
            1 => const _PermissionsPage(),
            2 => const _LocationSetupPage(),
            _ => const SizedBox.shrink(),
          };
        },
      ),
    );
  }
}

class _WelcomePage extends ConsumerWidget {
  const _WelcomePage();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            colorScheme.primary,
            colorScheme.primaryContainer.withValues(alpha: 0.85),
          ],
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: colorScheme.primary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.cloud_queue,
                  color: Colors.white,
                  size: 48,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'MoE Weather',
                style: textTheme.displayLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Text(
                'Hyper-local forecasts for every adventure',
                style: textTheme.titleMedium?.copyWith(color: Colors.white70),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () =>
                      ref.read(onboardingProvider.notifier).advance(),
                  child: const Text('Get Started'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PermissionsPage extends ConsumerWidget {
  const _PermissionsPage();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.notifications_outlined, size: 64),
            const SizedBox(height: 24),
            Text('Stay Informed', style: textTheme.headlineMedium),
            const SizedBox(height: 24),
            Text(
              'Enable notifications to get severe weather alerts and daily briefings.',
              style: textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () =>
                    ref.read(onboardingProvider.notifier).advance(),
                child: const Text('Enable Notifications'),
              ),
            ),
            const SizedBox(height: 24),
            TextButton(
              onPressed: () =>
                  ref.read(onboardingProvider.notifier).advance(),
              child: const Text('Skip'),
            ),
          ],
        ),
      ),
    );
  }
}

class _LocationSetupPage extends ConsumerWidget {
  const _LocationSetupPage();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.location_on_outlined, size: 64),
            const SizedBox(height: 24),
            Text('Find Your Weather', style: textTheme.headlineMedium),
            const SizedBox(height: 24),
            Text(
              'Search for your city or use your current location.',
              style: textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () =>
                    ref.read(onboardingProvider.notifier).advance(),
                child: const Text('Search for a location'),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () =>
                    ref.read(onboardingProvider.notifier).advance(),
                child: const Text('Use Current Location'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
