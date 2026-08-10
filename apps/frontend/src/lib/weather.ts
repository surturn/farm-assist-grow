// Map Kenya regions to approximate coordinates
const REGION_COORDINATES: Record<string, { lat: number; lon: number }> = {
    "Central Kenya": { lat: -0.4201, lon: 36.9476 }, // Nyeri
    "Rift Valley": { lat: 0.5143, lon: 35.2698 },   // Eldoret
    "Western Kenya": { lat: 0.2827, lon: 34.7519 }, // Kakamega
    "Eastern Kenya": { lat: -1.5348, lon: 37.2615 }, // Machakos
    "Coast": { lat: -4.0435, lon: 39.6682 },        // Mombasa
    "Nairobi": { lat: -1.2921, lon: 36.8219 },      // Nairobi
};

export const getCoordinates = (region: string) => {
    return REGION_COORDINATES[region] || REGION_COORDINATES["Central Kenya"]; // Default fallback
};

export const getWeather = async (lat: number, lon: number) => {
    try {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        if (!apiKey) {
            console.error('OpenWeatherMap API key is missing');
            return null;
        }

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
        );

        if (!response.ok) {
            throw new Error('Weather data fetch failed');
        }

        const data = await response.json();
        
        // Map OWM codes to Open-Meteo codes approximately so Dashboard/Planning logic still works
        // OWM codes: 2xx (Thunderstorm), 3xx (Drizzle), 5xx (Rain), 6xx (Snow), 7xx (Atmosphere), 800 (Clear), 80x (Clouds)
        let weather_code = 0; // Clear
        const owmCode = data.weather[0].id;
        if (owmCode === 800) weather_code = 0;
        else if (owmCode === 801 || owmCode === 802) weather_code = 2; // Partly cloudy
        else if (owmCode === 803 || owmCode === 804) weather_code = 3; // Overcast
        else if (owmCode >= 300 && owmCode < 400) weather_code = 51; // Drizzle
        else if (owmCode >= 500 && owmCode < 600) weather_code = 63; // Rain
        else if (owmCode >= 200 && owmCode < 300) weather_code = 95; // Thunderstorm

        return {
            current: {
                temperature_2m: data.main.temp,
                relative_humidity_2m: data.main.humidity,
                wind_speed_10m: data.wind?.speed || 0,
                rain: data.rain?.['1h'] || 0,
                weather_code: weather_code,
            }
        };
    } catch (error) {
        console.error('Weather API Error:', error);
        return null;
    }
};

export const getWeatherDescription = (code: number) => {
    // WMO Weather interpretation codes (WW)
    const codes: Record<number, string> = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
    };
    return codes[code] || "Moderate";
};
