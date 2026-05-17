import WidgetKit

struct WeatherEntry: TimelineEntry {
    let date: Date
    let temperature: Double
    let feelsLike: Double
    let description: String
    let weatherCode: Int
    let locationName: String
    let humidity: Double
    let windSpeed: Double
    let highTemp: Double?
    let lowTemp: Double?
    let lastUpdated: Date?
    let unitLabel: String

    static let placeholder = WeatherEntry(
        date: Date(), temperature: 20, feelsLike: 18,
        description: "Partly cloudy", weatherCode: 2,
        locationName: "Your City", humidity: 65, windSpeed: 12,
        highTemp: 24, lowTemp: 15, lastUpdated: Date(), unitLabel: "°C"
    )
}
