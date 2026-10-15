import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../constants/theme';

// v2.0 FR-3.4 — customer live map. Uses Leaflet + OpenStreetMap inside a WebView:
// free, no API key, no billing, and works in Expo Go (no native build needed).
interface Props {
  lat?: number | null;
  lng?: number | null;
  etaSeconds?: number | null;
  delayed?: boolean;
}

// CIT-U campus (drop-off reference point).
const SCHOOL = { lat: 10.294734124980659, lng: 123.88112327116433 };

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; background: #e8e8e8; }
    .pin { font-size: 24px; line-height: 24px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var school = [${SCHOOL.lat}, ${SCHOOL.lng}];
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView(school, 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    var schoolIcon = L.divIcon({ html: '<div class="pin">🏫</div>', iconSize: [24,24], iconAnchor: [12,12] });
    L.marker(school, { icon: schoolIcon }).addTo(map).bindPopup('CIT-U');
    var dasherIcon = L.divIcon({ html: '<div class="pin">🚴</div>', iconSize: [24,24], iconAnchor: [12,12] });
    var dasher = null;
    window.setDasher = function (lat, lng) {
      var ll = [lat, lng];
      if (!dasher) { dasher = L.marker(ll, { icon: dasherIcon }).addTo(map); }
      else { dasher.setLatLng(ll); }
      map.fitBounds(L.latLngBounds([ll, school]).pad(0.4));
    };
  </script>
</body>
</html>`;

export default function LiveMapView({ lat, lng, etaSeconds, delayed }: Props) {
  const webRef = useRef<WebView>(null);
  const hasFix = lat != null && lng != null;
  const etaMin = etaSeconds != null ? Math.max(1, Math.round(etaSeconds / 60)) : null;

  // Move the dasher marker without reloading the map when a new location arrives.
  useEffect(() => {
    if (hasFix) {
      webRef.current?.injectJavaScript(`window.setDasher(${lat}, ${lng}); true;`);
    }
  }, [lat, lng, hasFix]);

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        style={styles.map}
        originWhitelist={['*']}
        source={{ html: MAP_HTML }}
        scrollEnabled={false}
        onLoadEnd={() => {
          if (hasFix) webRef.current?.injectJavaScript(`window.setDasher(${lat}, ${lng}); true;`);
        }}
      />
      <View style={styles.banner}>
        {!hasFix ? (
          <Text style={styles.waiting}>Waiting for the dasher's location…</Text>
        ) : delayed ? (
          <Text style={styles.delayed}>Location delayed — showing last known position</Text>
        ) : (
          <Text style={styles.eta}>
            {etaMin != null ? `Arriving in ~${etaMin} min` : 'Tracking your dasher'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.white, marginBottom: 16 },
  map: { height: 200, width: '100%' },
  banner: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  eta: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  delayed: { fontSize: 13, fontWeight: '600', color: '#B8860B' },
  waiting: { fontSize: 13, color: COLORS.textSecondary },
});
