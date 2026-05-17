import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_state.dart';
import 'revenuecat_service.dart';
import 'supabase_auth.dart';

/// Account screen: email, tier badge, Manage Subscription deep link, Sign Out.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  static const _manageSubscriptionUrl =
      'https://apps.apple.com/account/subscriptions';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(supabaseUserProvider);
    final tier = ref.watch(tierProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: SafeArea(
        child: userAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(child: Text('Error: $err')),
          data: (user) {
            if (user == null) {
              return const Center(child: Text('Not signed in.'));
            }
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                ListTile(
                  key: const Key('account_email_tile'),
                  leading: const Icon(Icons.email_outlined),
                  title: const Text('Email'),
                  subtitle: Text(user.email),
                ),
                ListTile(
                  key: const Key('account_tier_tile'),
                  leading: const Icon(Icons.workspace_premium_outlined),
                  title: const Text('Tier'),
                  trailing: _TierBadge(tier: tier),
                ),
                ListTile(
                  key: const Key('account_manage_subscription_tile'),
                  leading: const Icon(Icons.open_in_new),
                  title: const Text('Manage Subscription'),
                  onTap: () async {
                    // Deep link is delegated to the orchestrator via clipboard
                    // copy here to avoid an extra url_launcher dependency in
                    // this feature slice.
                    await Clipboard.setData(
                      const ClipboardData(text: _manageSubscriptionUrl),
                    );
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Subscription management link copied to clipboard.',
                          ),
                        ),
                      );
                    }
                  },
                ),
                const Divider(),
                ListTile(
                  key: const Key('account_sign_out_tile'),
                  leading: const Icon(Icons.logout),
                  title: const Text('Sign out'),
                  onTap: () async {
                    final service = ref.read(supabaseAuthServiceProvider);
                    await service.signOut();
                  },
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TierBadge extends StatelessWidget {
  const _TierBadge({required this.tier});

  final SubscriptionTier tier;

  @override
  Widget build(BuildContext context) {
    final label = switch (tier) {
      SubscriptionTier.anonymous => 'Guest',
      SubscriptionTier.free => 'Free',
      SubscriptionTier.pro => 'Pro',
    };
    return Chip(label: Text(label));
  }
}
