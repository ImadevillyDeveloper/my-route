import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.moymarshrut.app',
  appName: 'Мой.Маршрут',
  webDir: 'dist',
  // Интерфейс упакован в APK (собран с VITE_API_URL на бэкенд Render) — сайт
  // на Cloudflare Pages приложению не нужен вообще. Минус: после каждого
  // обновления фронтенда APK нужно пересобирать заново, а не только сайт.
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#FF6600',
    },
  },
};

export default config;
