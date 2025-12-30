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
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
        );

        if (!response.ok) {
            throw new Error('Weather data fetch failed');
        }

        return await response.json();
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
