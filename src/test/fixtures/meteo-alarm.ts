/**
 * Test fixtures for MeteoAlarm adapter
 */

/** A minimal MeteoAlarm Atom feed with one Severe wind alert entry. */
export const meteoAlarmFeedWithAlert = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
  <title>MeteoAlarm - GB</title>
  <id>https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-gb</id>
  <updated>2026-05-14T10:00:00Z</updated>
  <entry>
    <id>urn:uuid:test-alert-001</id>
    <title>Severe wind warning for southern England</title>
    <summary>Gusts of up to 90 km/h expected. Travel disruption likely.</summary>
    <category term="Wind"/>
    <cap:event>Wind</cap:event>
    <cap:severity>Severe</cap:severity>
    <cap:urgency>Expected</cap:urgency>
    <cap:onset>2026-05-14T12:00:00Z</cap:onset>
    <cap:expires>2026-05-14T20:00:00Z</cap:expires>
    <updated>2026-05-14T10:00:00Z</updated>
  </entry>
</feed>`;

/** An empty MeteoAlarm Atom feed with no entries. */
export const meteoAlarmFeedEmpty = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
  <title>MeteoAlarm - GB</title>
  <id>https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-gb</id>
  <updated>2026-05-14T10:00:00Z</updated>
</feed>`;
