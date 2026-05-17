/// A row from `saved_locations`. Matches the Supabase column layout used in
/// `src/routes/locations.ts`.
class SavedLocation {
  const SavedLocation({
    required this.id,
    required this.userId,
    required this.name,
    required this.latitude,
    required this.longitude,
    this.country,
    this.isDefault = false,
    this.displayOrder,
    this.createdAt,
  });

  factory SavedLocation.fromJson(Map<String, dynamic> json) => SavedLocation(
        id: json['id'] as String,
        userId: json['user_id'] as String,
        name: json['name'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        country: json['country'] as String?,
        isDefault: (json['is_default'] as bool?) ?? false,
        displayOrder: (json['display_order'] as num?)?.toInt(),
        createdAt: json['created_at'] is String
            ? DateTime.parse(json['created_at'] as String)
            : null,
      );

  final String id;
  final String userId;
  final String name;
  final double latitude;
  final double longitude;
  final String? country;
  final bool isDefault;
  final int? displayOrder;
  final DateTime? createdAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'user_id': userId,
        'name': name,
        'latitude': latitude,
        'longitude': longitude,
        if (country != null) 'country': country,
        'is_default': isDefault,
        if (displayOrder != null) 'display_order': displayOrder,
        if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SavedLocation &&
          other.id == id &&
          other.userId == userId &&
          other.name == name &&
          other.latitude == latitude &&
          other.longitude == longitude);

  @override
  int get hashCode =>
      Object.hash(runtimeType, id, userId, name, latitude, longitude);
}

/// Payload accepted by `POST /api/locations`. Stored separately from the
/// server row so we don't have to fabricate `id`/`user_id` on the client.
class SavedLocationInput {
  const SavedLocationInput({
    required this.name,
    required this.latitude,
    required this.longitude,
    this.country,
    this.isDefault = false,
  });

  final String name;
  final double latitude;
  final double longitude;
  final String? country;
  final bool isDefault;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'latitude': latitude,
        'longitude': longitude,
        if (country != null) 'country': country,
        'is_default': isDefault,
      };
}
