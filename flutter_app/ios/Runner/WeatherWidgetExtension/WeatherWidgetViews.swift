import SwiftUI
import WidgetKit

// MARK: - Shared helpers

private func tempString(_ value: Double, unit: String) -> String {
    "\(Int(value.rounded()))\(unit)"
}

private func hlRow(high: Double?, low: Double?, unit: String) -> some View {
    Group {
        if let h = high, let l = low {
            HStack(spacing: 6) {
                Label(tempString(h, unit: unit), systemImage: "arrow.up")
                    .font(.caption2)
                    .foregroundStyle(.primary)
                Label(tempString(l, unit: unit), systemImage: "arrow.down")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Small

struct WeatherWidgetSmallView: View {
    let entry: WeatherEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(entry.locationName)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            Text(tempString(entry.temperature, unit: entry.unitLabel))
                .font(.system(size: 42, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            Text(entry.description)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            Spacer()

            hlRow(high: entry.highTemp, low: entry.lowTemp, unit: entry.unitLabel)
        }
        .padding(12)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Medium

struct WeatherWidgetMediumView: View {
    let entry: WeatherEntry

    var body: some View {
        HStack(spacing: 0) {
            // Left column
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.locationName)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                Text(tempString(entry.temperature, unit: entry.unitLabel))
                    .font(.system(size: 42, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)

                Text(entry.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Divider().padding(.vertical, 4)

            // Right column
            VStack(alignment: .leading, spacing: 6) {
                if let h = entry.highTemp, let l = entry.lowTemp {
                    Label("H:\(tempString(h, unit: entry.unitLabel))  L:\(tempString(l, unit: entry.unitLabel))",
                          systemImage: "thermometer")
                        .font(.caption2)
                }
                Label("\(Int(entry.humidity.rounded()))%", systemImage: "humidity")
                    .font(.caption2)
                Label("\(Int(entry.windSpeed.rounded())) km/h", systemImage: "wind")
                    .font(.caption2)
                Label("Feels \(tempString(entry.feelsLike, unit: entry.unitLabel))",
                      systemImage: "thermometer.medium")
                    .font(.caption2)
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 10)
        }
        .padding(12)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Large

private struct StatCell: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Label(label, systemImage: icon)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption)
                .fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct WeatherWidgetLargeView: View {
    let entry: WeatherEntry

    private var updatedString: String {
        guard let date = entry.lastUpdated else { return "—" }
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return "Updated \(formatter.string(from: date))"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Top row
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.locationName)
                        .font(.headline)
                        .lineLimit(1)
                    Text(entry.description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer()
                Text(tempString(entry.temperature, unit: entry.unitLabel))
                    .font(.system(size: 56, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
            }

            Divider()

            // Stat grid
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                StatCell(icon: "thermometer.medium",
                         label: "Feels Like",
                         value: tempString(entry.feelsLike, unit: entry.unitLabel))
                StatCell(icon: "humidity",
                         label: "Humidity",
                         value: "\(Int(entry.humidity.rounded()))%")
                StatCell(icon: "wind",
                         label: "Wind",
                         value: "\(Int(entry.windSpeed.rounded())) km/h")
                if let high = entry.highTemp {
                    StatCell(icon: "arrow.up",
                             label: "High",
                             value: tempString(high, unit: entry.unitLabel))
                }
                if let low = entry.lowTemp {
                    StatCell(icon: "arrow.down",
                             label: "Low",
                             value: tempString(low, unit: entry.unitLabel))
                }
            }

            Spacer()

            // Timestamp footer
            Text(updatedString)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(12)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}
