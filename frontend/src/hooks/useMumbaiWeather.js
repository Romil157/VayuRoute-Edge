import { useEffect, useState } from 'react';

const OWM_API_KEY = 'd982ded315176b5b380ff29fb0ef6cfa';

/**
 * Fetches real-time Mumbai weather from OpenWeatherMap.
 * Polls every 5 minutes.
 *
 * @returns {{ condition: string, temperature: number, rain_mm: number, humidity: number, wind_kmh: number, weatherCode: number, loading: boolean, error: string|null }}
 */
export function useMumbaiWeather() {
  const [weather, setWeather] = useState({
    condition: '',
    temperature: 0,
    rain_mm: 0,
    humidity: 0,
    wind_kmh: 0,
    weatherCode: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function fetchWeather() {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=19.07&lon=72.87&appid=${OWM_API_KEY}&units=metric`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();

        if (!cancelled) {
          setWeather({
            condition: json.weather?.[0]?.main || 'Clear',
            temperature: Math.round(json.main?.temp || 0),
            rain_mm: json.rain?.['1h'] || 0,
            humidity: json.main?.humidity || 0,
            wind_kmh: Math.round((json.wind?.speed || 0) * 3.6),
            weatherCode: json.weather?.[0]?.id || 0,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setWeather((prev) => ({
            ...prev,
            loading: false,
            error: err.message,
          }));
        }
      }
    }

    fetchWeather();
    timer = setInterval(fetchWeather, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return weather;
}
