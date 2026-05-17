import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:moe_weather/features/auth/sign_in_screen.dart';
import 'package:moe_weather/features/auth/supabase_auth.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

class _MockSupabaseAuthService extends Mock implements SupabaseAuthService {}

class _FakeAuthResponse extends Fake implements sb.AuthResponse {}

void main() {
  setUpAll(() {
    registerFallbackValue(_FakeAuthResponse());
  });

  testWidgets(
    'SignInScreen calls SupabaseAuthService.signInWithEmail on submit',
    (tester) async {
      final mockService = _MockSupabaseAuthService();
      when(
        () => mockService.signInWithEmail(
          email: any(named: 'email'),
          password: any(named: 'password'),
        ),
      ).thenAnswer((_) async => _FakeAuthResponse());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            supabaseAuthServiceProvider.overrideWithValue(mockService),
          ],
          child: const MaterialApp(home: SignInScreen()),
        ),
      );

      await tester.enterText(
        find.byKey(const Key('signin_email_field')),
        'user@example.com',
      );
      await tester.enterText(
        find.byKey(const Key('signin_password_field')),
        'hunter2hunter2',
      );
      await tester.tap(find.byKey(const Key('signin_submit_button')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      verify(
        () => mockService.signInWithEmail(
          email: 'user@example.com',
          password: 'hunter2hunter2',
        ),
      ).called(1);
    },
  );

  testWidgets(
    'SignInScreen shows validation errors when fields are empty',
    (tester) async {
      final mockService = _MockSupabaseAuthService();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            supabaseAuthServiceProvider.overrideWithValue(mockService),
          ],
          child: const MaterialApp(home: SignInScreen()),
        ),
      );

      await tester.tap(find.byKey(const Key('signin_submit_button')));
      await tester.pump();

      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
      verifyNever(
        () => mockService.signInWithEmail(
          email: any(named: 'email'),
          password: any(named: 'password'),
        ),
      );
    },
  );
}
