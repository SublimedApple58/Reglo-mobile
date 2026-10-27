// REG-638 Reglo Road: unica aggiunta dinamica alla config statica di app.json.
// react-native-maps su Android usa Google Maps e vuole la chiave nel manifest;
// la chiave NON sta nel repo: arriva dalla variabile d'ambiente
// GOOGLE_MAPS_ANDROID_API_KEY (EAS secret / env locale). Su iOS si usa Apple
// Maps, nessuna chiave. Tutto il resto resta in app.json.
module.exports = ({ config }) => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (!apiKey) return config;
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: { apiKey },
      },
    },
  };
};
