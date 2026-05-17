# Wave 3 / G3 — Auth + RevenueCat + Global Tier

This feature owns sign-in, sign-up, paywall, and the global subscription tier
state. The orchestrator is responsible for wiring it into `lib/main.dart`
(this agent intentionally did not modify `main.dart`).

## Public surface

- `authStateProvider` — `AsyncNotifierProvider<AuthStateNotifier, AuthState>`.
  Use `ref.watch(authStateProvider)` for the union state.
- `tierProvider` — `Provider<SubscriptionTier>`. Use
  `ref.watch(tierProvider)` anywhere to know if the user is `anonymous`,
  `free`, or `pro`.
- `supabaseUserProvider` — `StreamProvider<AuthUser?>`. Convenience for
  widgets that only need to know the currently authenticated user.
- `supabaseAuthServiceProvider` — `Provider<SupabaseAuthService>` for sign-in,
  sign-up, Google, and sign-out.
- `revenueCatServiceProvider` — `Provider<RevenueCatService>` for offerings,
  purchases, and restores.
- `customerInfoProvider` — `StateProvider<CustomerInfo?>`. Updated after each
  purchase / restore / auth bridge fetch.

## Screens

- `SignInScreen`
- `SignUpScreen`
- `PaywallScreen`
- `AccountScreen`

## Wiring (for orchestrator in `main.dart`)

1. Read the four secrets from `--dart-define`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `RC_API_KEY_IOS`
   - `RC_API_KEY_ANDROID`
2. In `main()` (before `runApp`):

   ```dart
   WidgetsFlutterBinding.ensureInitialized();
   await SupabaseAuthService.initializeSupabase(
     url: const String.fromEnvironment('SUPABASE_URL'),
     anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),
   );
   await RevenueCatService.initializeRevenueCat(
     apiKeyIos: const String.fromEnvironment('RC_API_KEY_IOS'),
     apiKeyAndroid: const String.fromEnvironment('RC_API_KEY_ANDROID'),
   );
   runApp(const ProviderScope(child: MoEWeatherApp()));
   ```

3. Near the root of the widget tree, read `revenueCatAuthBridgeProvider`
   once so the Supabase user is forwarded to `Purchases.logIn` / `logOut`:

   ```dart
   class _AuthBridge extends ConsumerWidget {
     const _AuthBridge({required this.child});
     final Widget child;

     @override
     Widget build(BuildContext context, WidgetRef ref) {
       ref.watch(revenueCatAuthBridgeProvider);
       return child;
     }
   }
   ```

4. Route to `SignInScreen` when `tierProvider` is `anonymous`, and to
   `PaywallScreen` when a `pro` gate is hit. Use `AccountScreen` from the
   settings drawer.

## Secrets

API keys are **never** hardcoded. They are read from `--dart-define` env at
build/run time:

```
flutter run \
  --dart-define=SUPABASE_URL=... \
  --dart-define=SUPABASE_ANON_KEY=... \
  --dart-define=RC_API_KEY_IOS=... \
  --dart-define=RC_API_KEY_ANDROID=...
```
