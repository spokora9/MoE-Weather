import WidgetKit

struct WeatherProvider: TimelineProvider {
    private let ud = UserDefaults(suiteName: "group.com.moeweather.app")

    func placeholder(in context: Context) -> WeatherEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        completion(Timeline(entries: [readEntry()], policy: .after(next)))
    }

    private func readEntry() -> WeatherEntry {
        WeatherEntry(
            date: Date(),
            temperature: ud?.double(forKey: "widget_temperature") ?? 0,
            feelsLike: ud?.double(forKey: "widget_feels_like") ?? 0,
            description: ud?.string(forKey: "widget_description") ?? "—",
            weatherCode: ud?.integer(forKey: "widget_weather_code") ?? 0,
            locationName: ud?.string(forKey: "widget_location_name") ?? "—",
            humidity: ud?.double(forKey: "widget_humidity") ?? 0,
            windSpeed: ud?.double(forKey: "widget_wind_speed") ?? 0,
            highTemp: ud?.object(forKey: "widget_high_temp") as? Double,
            lowTemp: ud?.object(forKey: "widget_low_temp") as? Double,
            lastUpdated: (ud?.string(forKey: "widget_last_updated")).flatMap {
                ISO8601DateFormatter().date(from: $0)
            },
            unitLabel: ud?.string(forKey: "widget_unit_label") ?? "°C"
        )
    }
}
