import SwiftUI
import WidgetKit

private let kAppGroupId = "group.com.moeweather.app"

private func loadImage(key: String) -> UIImage? {
    guard let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: kAppGroupId
    ) else { return nil }
    guard let data = try? Data(contentsOf: container.appendingPathComponent("\(key).png")) else { return nil }
    return UIImage(data: data)
}

private struct RenderedView: View {
    let key: String
    var body: some View {
        Group {
            if let img = loadImage(key: key) {
                Image(uiImage: img)
                    .resizable()
                    .scaledToFill()
            } else {
                Text("MoE Weather")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct WeatherWidgetSmallView: View {
    let entry: WeatherEntry
    var body: some View { RenderedView(key: "widget_snapshot_small") }
}

struct WeatherWidgetMediumView: View {
    let entry: WeatherEntry
    var body: some View { RenderedView(key: "widget_snapshot_medium") }
}

struct WeatherWidgetLargeView: View {
    let entry: WeatherEntry
    var body: some View { RenderedView(key: "widget_snapshot_large") }
}
