import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets, Thermometer, CloudSnow, CloudLightning, Settings } from 'lucide-react';

interface WeatherData {
  name: string;
  sys: { country: string };
  main: { temp: number; feels_like: number; humidity: number };
  weather: { id: number; main: string; description: string }[];
  wind: { speed: number };
}

type WeatherState =
  | { status: 'loading' }
  | { status: 'ok'; data: WeatherData }
  | { status: 'no_key' }
  | { status: 'error'; message: string };

function getWeatherIcon(weatherId: number): React.ReactNode {
  const size = 'h-5 w-5';
  if (weatherId >= 200 && weatherId < 300) return <CloudLightning className={size} />;
  if (weatherId >= 300 && weatherId < 600) return <CloudRain className={size} />;
  if (weatherId >= 600 && weatherId < 700) return <CloudSnow className={size} />;
  if (weatherId >= 700 && weatherId < 800) return <Wind className={size} />;
  if (weatherId === 800) return <Sun className={size} />;
  return <Cloud className={size} />;
}

function celsiusLabel(k: number) {
  return `${Math.round(k - 273.15)}°C`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface WeatherWidgetProps {
  apiKey: string | null;
  city: string | null;
  onConfigureClick?: () => void;
}

/**
 * WeatherWidget
 *
 * Menampilkan cuaca terkini dari OpenWeatherMap API.
 * Jika `apiKey` kosong, tampilkan prompt konfigurasi.
 * Jika request gagal, tampilkan pesan error ringkas tanpa crash.
 */
export default function WeatherWidget({ apiKey, city, onConfigureClick }: WeatherWidgetProps) {
  const [state, setState] = useState<WeatherState>({ status: 'loading' });

  useEffect(() => {
    if (!apiKey?.trim() || !city?.trim()) {
      setState({ status: 'no_key' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    const controller = new AbortController();
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(apiKey)}`;

    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Kode ${r.status}`);
        return r.json() as Promise<WeatherData>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Gagal memuat data cuaca' });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiKey, city]);

  if (state.status === 'no_key') {
    return (
      <div className="app-card flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
            <Cloud className="h-4 w-4" />
          </span>
          <p className="text-sm text-text-muted">
            Widget cuaca belum dikonfigurasi.
          </p>
        </div>
        {onConfigureClick && (
          <button
            onClick={onConfigureClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface/70 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Konfigurasi
          </button>
        )}
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="app-card flex items-center gap-3 px-4 py-3 animate-pulse">
        <div className="h-8 w-8 rounded-xl bg-surface/40" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-24 rounded bg-surface/40" />
          <div className="h-3 w-36 rounded bg-surface/40" />
        </div>
        <div className="h-6 w-12 rounded bg-surface/40" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="app-card flex items-center gap-3 px-4 py-3 border-accent-red/20">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-red/10 text-accent-red">
          <CloudLightning className="h-4 w-4" />
        </span>
        <p className="text-sm text-text-muted">
          Gagal memuat cuaca — {state.message}
        </p>
      </div>
    );
  }

  const { data } = state;
  const weather = data.weather[0];

  return (
    <div className="app-card flex flex-wrap items-center gap-4 px-4 py-3">
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        {weather && getWeatherIcon(weather.id)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text-primary text-sm">
          {data.name}, {data.sys.country}
        </p>
        <p className="text-xs text-text-muted">
          {weather ? capitalize(weather.description) : '—'}
        </p>
      </div>
      <div className="flex items-center gap-4 text-sm flex-shrink-0">
        <span className="flex items-center gap-1 font-bold text-text-primary">
          <Thermometer className="h-3.5 w-3.5 text-primary" />
          {celsiusLabel(data.main.temp)}
        </span>
        <span className="flex items-center gap-1 text-text-muted">
          <Droplets className="h-3.5 w-3.5" />
          {data.main.humidity}%
        </span>
        <span className="flex items-center gap-1 text-text-muted">
          <Wind className="h-3.5 w-3.5" />
          {Math.round(data.wind.speed)} m/s
        </span>
      </div>
      <span className="text-xs text-text-muted">
        Terasa {celsiusLabel(data.main.feels_like)}
      </span>
    </div>
  );
}
