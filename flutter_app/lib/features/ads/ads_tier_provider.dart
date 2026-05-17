/// Indirection layer between the ads feature and the global subscription
/// tier provider owned by another track (G3 / wave1 C4).
///
/// The ads code must NOT import the auth / subscription feature directly,
/// because those branches may not be merged at the same time as this one.
/// Instead, at app boot the orchestrator wires a real resolver via
/// [setIsProResolver]. Until that happens (and in tests by default) callers
/// see `isPro == false`, so they get the free-tier experience.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Signature of the function the orchestrator installs at app boot to map
/// the current Riverpod `WidgetRef` to a boolean "is this user Pro?".
typedef IsProFn = bool Function(WidgetRef ref);

/// Default resolver: treat everyone as a free-tier user.
bool _defaultResolver(WidgetRef ref) => false;

IsProFn _resolver = _defaultResolver;

/// Installs the production resolver. The orchestrator should call this once
/// during app startup, passing in something like:
///
/// ```dart
/// setIsProResolver((ref) => ref.read(tierProvider) == Tier.pro);
/// ```
void setIsProResolver(IsProFn resolver) {
  _resolver = resolver;
}

/// Restores the default (always-free) resolver. Intended for tests.
void resetIsProResolverForTesting() {
  _resolver = _defaultResolver;
}

/// Riverpod provider the ads feature reads to decide whether to show ads.
///
/// Other tracks can also read this if they want to react to tier changes
/// without depending on the underlying auth / RevenueCat plumbing.
final adsTierProvider = Provider<bool>((ref) {
  // We can't call the resolver here without a `WidgetRef`, so this provider
  // only exists as a stable identity. Use [isProForRef] from widgets.
  return false;
});

/// Convenience helper for widgets: returns `true` if the current user is on
/// the Pro tier (per the installed resolver).
bool isProForRef(WidgetRef ref) => _resolver(ref);
