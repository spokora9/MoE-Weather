package com.moeweather.app.widgets

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.Color
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.ContentScale
import androidx.glance.layout.fillMaxSize
import androidx.glance.background
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

private const val IMAGE_KEY = "widget_snapshot_medium"

class WeatherWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val file = context.filesDir.resolve("$IMAGE_KEY.png")
        val bitmap = if (file.exists()) BitmapFactory.decodeFile(file.absolutePath) else null

        provideContent {
            if (bitmap != null) {
                Image(
                    provider = ImageProvider(bitmap),
                    contentDescription = "MoE Weather",
                    contentScale = ContentScale.Crop,
                    modifier = GlanceModifier.fillMaxSize(),
                )
            } else {
                Box(
                    modifier = GlanceModifier.fillMaxSize().background(Color(0xFF0D1B2A)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "MoE Weather",
                        style = TextStyle(color = ColorProvider(Color.White)),
                    )
                }
            }
        }
    }
}
