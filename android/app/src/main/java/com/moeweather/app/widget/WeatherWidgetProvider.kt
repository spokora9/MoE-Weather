package com.moeweather.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.app.PendingIntent
import com.moeweather.app.R
import com.moeweather.app.MainActivity
import kotlinx.coroutines.*
import java.net.URL
import org.json.JSONObject

/**
 * MoE Weather Widget Provider
 * Displays current weather on the home screen
 */
class WeatherWidgetProvider : AppWidgetProvider() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Update each widget instance
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        // Widget added for the first time
    }

    override fun onDisabled(context: Context) {
        // Last widget removed
        scope.cancel()
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        // Create the RemoteViews object
        val views = RemoteViews(context.packageName, R.layout.weather_widget)

        // Set click intent to open the app
        val intent = Intent(context, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

        // Show loading state
        views.setTextViewText(R.id.widget_location, "Loading...")
        views.setTextViewText(R.id.widget_temperature, "--°")
        views.setTextViewText(R.id.widget_condition, "Tap to open app")
        views.setTextViewText(R.id.widget_highlow, "")

        // Update the widget
        appWidgetManager.updateAppWidget(appWidgetId, views)

        // Fetch weather data in background
        scope.launch {
            try {
                val weatherData = fetchWeatherData(context)
                withContext(Dispatchers.Main) {
                    updateWidgetWithData(context, appWidgetManager, appWidgetId, weatherData)
                }
            } catch (e: Exception) {
                // Handle error - show error state
                withContext(Dispatchers.Main) {
                    views.setTextViewText(R.id.widget_condition, "Tap to refresh")
                    appWidgetManager.updateAppWidget(appWidgetId, views)
                }
            }
        }
    }

    private suspend fun fetchWeatherData(context: Context): WeatherData {
        // Get saved location from SharedPreferences
        val prefs = context.getSharedPreferences("moe_weather_prefs", Context.MODE_PRIVATE)
        val lat = prefs.getFloat("lat", 0f)
        val lon = prefs.getFloat("lon", 0f)
        val locationName = prefs.getString("location_name", "Unknown") ?: "Unknown"
        val units = prefs.getString("units", "metric") ?: "metric"

        if (lat == 0f && lon == 0f) {
            return WeatherData(
                location = "Set location in app",
                temperature = "--",
                condition = "Open app to configure",
                high = "--",
                low = "--"
            )
        }

        // Fetch from API (using your Vercel backend or Open-Meteo directly)
        val apiUrl = "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto"

        val response = URL(apiUrl).readText()
        val json = JSONObject(response)
        val current = json.getJSONObject("current")
        val daily = json.getJSONObject("daily")

        val temp = current.getDouble("temperature_2m")
        val weatherCode = current.getInt("weather_code")
        val highTemp = daily.getJSONArray("temperature_2m_max").getDouble(0)
        val lowTemp = daily.getJSONArray("temperature_2m_min").getDouble(0)

        // Convert to Fahrenheit if needed
        val tempDisplay = if (units == "imperial") {
            "${((temp * 9/5) + 32).toInt()}°F"
        } else {
            "${temp.toInt()}°C"
        }

        val highDisplay = if (units == "imperial") {
            "${((highTemp * 9/5) + 32).toInt()}°"
        } else {
            "${highTemp.toInt()}°"
        }

        val lowDisplay = if (units == "imperial") {
            "${((lowTemp * 9/5) + 32).toInt()}°"
        } else {
            "${lowTemp.toInt()}°"
        }

        return WeatherData(
            location = locationName,
            temperature = tempDisplay,
            condition = getWeatherDescription(weatherCode),
            high = highDisplay,
            low = lowDisplay
        )
    }

    private fun updateWidgetWithData(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        data: WeatherData
    ) {
        val views = RemoteViews(context.packageName, R.layout.weather_widget)

        views.setTextViewText(R.id.widget_location, data.location)
        views.setTextViewText(R.id.widget_temperature, data.temperature)
        views.setTextViewText(R.id.widget_condition, data.condition)
        views.setTextViewText(R.id.widget_highlow, "H: ${data.high} L: ${data.low}")

        // Set click intent
        val intent = Intent(context, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun getWeatherDescription(code: Int): String {
        return when (code) {
            0 -> "Clear sky"
            1, 2, 3 -> "Partly cloudy"
            45, 48 -> "Foggy"
            51, 53, 55 -> "Drizzle"
            61, 63, 65 -> "Rain"
            66, 67 -> "Freezing rain"
            71, 73, 75 -> "Snow"
            77 -> "Snow grains"
            80, 81, 82 -> "Rain showers"
            85, 86 -> "Snow showers"
            95 -> "Thunderstorm"
            96, 99 -> "Thunderstorm with hail"
            else -> "Unknown"
        }
    }

    data class WeatherData(
        val location: String,
        val temperature: String,
        val condition: String,
        val high: String,
        val low: String
    )
}
