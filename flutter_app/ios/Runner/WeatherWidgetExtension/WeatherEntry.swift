import WidgetKit

struct WeatherEntry: TimelineEntry {
    let date: Date

    static let placeholder = WeatherEntry(date: Date())
}
