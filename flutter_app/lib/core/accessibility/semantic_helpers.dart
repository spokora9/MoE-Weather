import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

class SemanticWeatherValue extends StatelessWidget {
  const SemanticWeatherValue({
    super.key,
    required this.label,
    required this.value,
    required this.child,
  });

  final String label;
  final String value;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$label: $value',
      child: ExcludeSemantics(child: child),
    );
  }
}

void announceToScreenReader(BuildContext context, String message) {
  SemanticsService.announce(message, TextDirection.ltr);
}
