package com.moeweather.app.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import kotlin.math.roundToInt

private const val PREFS_NAME = "FlutterSharedPreferences"
private const val KEY_PREFIX = "flutter."

class WeatherWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        fun float(key: String, default: Float = 0f) =
            prefs.getFloat("$KEY_PREFIX$key", default)

        fun str(key: String, default: String = "—") =
            prefs.getString("$KEY_PREFIX$key", default) ?: default

        val temperature = float("widget_temperature")
        val feelsLike = float("widget_feels_like")
        val description = str("widget_description")
        val locationName = str("widget_location_name")
        val humidity = float("widget_humidity")
        val windSpeed = float("widget_wind_speed")
        val unitLabel = str("widget_unit_label", "°C")

        // High/low are optional — only present if key exists
        val highTemp: Float? = if (prefs.contains("${KEY_PREFIX}widget_high_temp"))
            float("widget_high_temp") else null
        val lowTemp: Float? = if (prefs.contains("${KEY_PREFIX}widget_low_temp"))
            float("widget_low_temp") else null

        provideContent {
            WeatherWidgetContent(
                temperature = temperature,
                feelsLike = feelsLike,
                description = description,
                locationName = locationName,
                humidity = humidity,
                windSpeed = windSpeed,
                unitLabel = unitLabel,
                highTemp = highTemp,
                lowTemp = lowTemp,
            )
        }
    }
}

@Composable
private fun WeatherWidgetContent(
    temperature: Float,
    feelsLike: Float,
    description: String,
    locationName: String,
    humidity: Float,
    windSpeed: Float,
    unitLabel: String,
    highTemp: Float?,
    lowTemp: Float?,
) {
    val bgColor = Color(0xFF1A1A2E)
    val white = Color.White
    val secondary = Color(0xFFB0B0CC)

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(bgColor)
            .padding(12.dp),
        verticalAlignment = Alignment.Vertical.Top,
        horizontalAlignment = Alignment.Horizontal.Start,
    ) {
        // Location name
        Text(
            text = locationName,
            style = TextStyle(color = secondary, fontSize = 12.sp),
            maxLines = 1,
        )

        Spacer(modifier = GlanceModifier.height(4.dp))

        // Temperature
        Text(
            text = "${temperature.roundToInt()}$unitLabel",
            style = TextStyle(
                color = white,
                fontSize = 40.sp,
                fontWeight = FontWeight.Bold,
            ),
            maxLines = 1,
        )

        // Description
        Text(
            text = description,
            style = TextStyle(color = secondary, fontSize = 13.sp),
            maxLines = 1,
        )

        Spacer(modifier = GlanceModifier.height(6.dp))

        // H/L row (only if both available)
        if (highTemp != null && lowTemp != null) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically,
            ) {
                Text(
                    text = "H:${highTemp.roundToInt()}$unitLabel",
                    style = TextStyle(color = white, fontSize = 12.sp),
                )
                Text(
                    text = "  L:${lowTemp.roundToInt()}$unitLabel",
                    style = TextStyle(color = secondary, fontSize = 12.sp),
                )
            }
            Spacer(modifier = GlanceModifier.height(4.dp))
        }

        Spacer(modifier = GlanceModifier.defaultWeight())

        // Bottom row: humidity + wind
        Row(
            modifier = GlanceModifier.fillMaxWidth(),
            verticalAlignment = Alignment.Vertical.CenterVertically,
        ) {
            Text(
                text = "${humidity.roundToInt()}% humidity",
                style = TextStyle(color = secondary, fontSize = 11.sp),
            )
            Text(
                text = "  \u2022  ${windSpeed.roundToInt()} km/h wind",
                style = TextStyle(color = secondary, fontSize = 11.sp),
            )
        }
    }
}
