import SwiftUI
import WidgetKit

@main
struct MoEWeatherWidget: Widget {
    let kind = "MoEWeatherWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherProvider()) { entry in
            WeatherWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("MoE Weather")
        .description("Current conditions at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct WeatherWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: WeatherEntry
    var body: some View {
        switch family {
        case .systemSmall: WeatherWidgetSmallView(entry: entry)
        case .systemMedium: WeatherWidgetMediumView(entry: entry)
        default: WeatherWidgetLargeView(entry: entry)
        }
    }
}
