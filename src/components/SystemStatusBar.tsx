import { Wifi, Satellite, Battery, Camera, Clock, Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudFog, Wind } from "lucide-react";
import type { AircraftState } from "@/hooks/useSimulation";
import { useEffect, useState } from "react";

interface SystemStatusBarProps {
  aircraft: AircraftState;
}

interface WeatherData {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
}

// Open-Meteo weather code to icon mapping
const getWeatherIcon = (code: number) => {
  if (code === 0) return Sun; // Clear sky
  if (code <= 3) return Cloud; // Partly cloudy
  if (code <= 49) return CloudFog; // Fog
  if (code <= 69) return CloudRain; // Rain/Drizzle
  if (code <= 79) return CloudSnow; // Snow
  if (code <= 99) return CloudLightning; // Thunderstorm
  return Cloud;
};

const getWeatherDescription = (code: number) => {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 49) return "Foggy";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 99) return "Storm";
  return "Unknown";
};

const SystemStatusBar = ({ aircraft }: SystemStatusBarProps) => {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get device GPS location, fallback to Chennai
  useEffect(() => {
    const CHENNAI_COORDS = { lat: 13.0827, lng: 80.2707 };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("Geolocation failed, using Chennai as fallback:", error.message);
          setLocation(CHENNAI_COORDS);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      console.warn("Geolocation not supported, using Chennai as fallback");
      setLocation(CHENNAI_COORDS);
    }
  }, []);

  // Fetch weather from Open-Meteo API using device GPS or Chennai fallback
  useEffect(() => {
    if (!location) return;

    const fetchWeather = async () => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=celsius`
        );
        const data = await response.json();
        if (data.current) {
          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            weatherCode: data.current.weather_code,
            windSpeed: Math.round(data.current.wind_speed_10m),
          });
        }
      } catch (error) {
        console.error("Failed to fetch weather:", error);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
    // Refresh weather every 10 minutes
    const weatherInterval = setInterval(fetchWeather, 600000);
    return () => clearInterval(weatherInterval);
  }, [location]);

  const timeStr = time.toLocaleTimeString("en-US", { hour12: false });
  const dateStr = time.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const batteryColor = aircraft.battery > 50 ? "text-aero-success" : aircraft.battery > 20 ? "text-aero-warning" : "text-aero-danger";

  const WeatherIcon = weather ? getWeatherIcon(weather.weatherCode) : Cloud;

  return (
    <header className="h-10 border-b border-border bg-card flex items-center justify-between px-4 text-xs font-mono">
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground">AeroSense Control v2.4.1</span>
        <div className="flex items-center gap-1.5">
          <span className={`aero-status-dot ${aircraft.status === "Idle" ? "bg-aero-success" : "bg-aero-cyan animate-pulse"}`} />
          <span className={aircraft.status === "Idle" ? "text-aero-success" : "text-aero-cyan"}>
            {aircraft.status === "Idle" ? "ONLINE" : aircraft.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5 text-muted-foreground">
        <div className="flex items-center gap-1.5" title="Signal Strength">
          <Wifi className="h-3.5 w-3.5 text-aero-success" />
          <span>{Math.round(aircraft.signal)}%</span>
        </div>
        <div className="flex items-center gap-1.5" title="GPS Lock">
          <Satellite className="h-3.5 w-3.5 text-aero-success" />
          <span>{aircraft.satellites} SAT</span>
        </div>
        <div className="flex items-center gap-1.5" title="Battery">
          <Battery className={`h-3.5 w-3.5 ${batteryColor}`} />
          <span>{Math.round(aircraft.battery)}%</span>
        </div>
        <div className="flex items-center gap-1.5" title="Camera">
          <Camera className={`h-3.5 w-3.5 ${aircraft.cameraActive ? "text-aero-success" : "text-aero-danger"}`} />
          <span>{aircraft.cameraActive ? "LIVE" : "OFF"}</span>
        </div>
        {/* Weather from Open-Meteo */}
        <div className="flex items-center gap-1.5" title={weather ? `${getWeatherDescription(weather.weatherCode)} • Wind: ${weather.windSpeed} km/h` : "Loading weather..."}>
          {weatherLoading ? (
            <Cloud className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
          ) : weather ? (
            <>
              <WeatherIcon className="h-3.5 w-3.5 text-aero-cyan" />
              <span>{weather.temperature}°C</span>
              <Wind className="h-3 w-3 text-muted-foreground ml-1" />
              <span className="text-muted-foreground">{weather.windSpeed}km/h</span>
            </>
          ) : (
            <span className="text-muted-foreground">--</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>{timeStr}</span>
          <span className="text-border">|</span>
          <span>{dateStr}</span>
        </div>
      </div>
    </header>
  );
};

export default SystemStatusBar;
