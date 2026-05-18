import WidgetKit

struct WeatherProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        completion(.placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        completion(Timeline(entries: [WeatherEntry(date: Date())], policy: .after(next)))
    }
}
