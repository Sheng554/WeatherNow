// ========== WEATHER CODE MAPPING ==========
const weatherCodeMap = {
    0: { description: "Clear sky", icon: "☀️" },
    1: { description: "Mainly clear", icon: "🌤️" },
    2: { description: "Partly cloudy", icon: "⛅" },
    3: { description: "Overcast", icon: "☁️" },
    45: { description: "Fog", icon: "🌫️" },
    48: { description: "Depositing rime fog", icon: "🌫️" },
    51: { description: "Light drizzle", icon: "🌦️" },
    53: { description: "Moderate drizzle", icon: "🌧️" },
    55: { description: "Dense drizzle", icon: "🌧️" },
    56: { description: "Light freezing drizzle", icon: "🌨️" },
    57: { description: "Dense freezing drizzle", icon: "🌨️" },
    61: { description: "Slight rain", icon: "🌦️" },
    63: { description: "Moderate rain", icon: "🌧️" },
    65: { description: "Heavy rain", icon: "🌧️" },
    66: { description: "Light freezing rain", icon: "🌨️" },
    67: { description: "Heavy freezing rain", icon: "🌨️" },
    71: { description: "Slight snow fall", icon: "❄️" },
    73: { description: "Moderate snow fall", icon: "❄️" },
    75: { description: "Heavy snow fall", icon: "❄️" },
    77: { description: "Snow grains", icon: "❄️" },
    80: { description: "Slight rain showers", icon: "🌦️" },
    81: { description: "Moderate rain showers", icon: "🌧️" },
    82: { description: "Violent rain showers", icon: "🌧️" },
    85: { description: "Slight snow showers", icon: "❄️" },
    86: { description: "Heavy snow showers", icon: "❄️" },
    95: { description: "Thunderstorm", icon: "⛈️" },
    96: { description: "Thunderstorm with slight hail", icon: "⛈️" },
    99: { description: "Thunderstorm with heavy hail", icon: "⛈️" }
};

function getWeatherInfo(code) {
    return weatherCodeMap[code] || { description: "Unknown", icon: "❓" };
}
//return { description: "Unknown", icon: "❓" } if no found

function getWeekday(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// DOM elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const errorBanner = document.getElementById('errorBanner');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const currentCard = document.getElementById('currentWeatherCard');
const forecastRow = document.getElementById('forecastRow');

let lastSearchCity = 'Johor Bahru';

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// ========== RECENT SEARCHES HISTORY (localStorage) ==========
const STORAGE_KEY = 'weather_recent_cities';
const MAX_HISTORY = 5;

function getRecentCities() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveRecentCities(cities) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cities.slice(0, MAX_HISTORY)));
}

function addToHistory(cityName) {
    let cities = getRecentCities();
    // Remove if already exists (to move to front)
    cities = cities.filter(c => c !== cityName);
    // Add to front
    cities.unshift(cityName);
    // Keep only MAX_HISTORY
    if (cities.length > MAX_HISTORY) cities.pop();
    saveRecentCities(cities);
    renderRecentChips();
}

function renderRecentChips() {
    const container = document.getElementById('recentSearches');
    if (!container) return;
    const cities = getRecentCities();
    if (cities.length === 0) {
        container.innerHTML = '<span class="recent-placeholder">🔍 No recent cities</span>';
        return;
    }
    container.innerHTML = cities.map(city => 
        `<button class="city-chip" data-city="${escapeHtml(city)}">${escapeHtml(city)}</button>`
    ).join('');
    
    // Attach click handlers
    document.querySelectorAll('.city-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const city = btn.getAttribute('data-city');
            if (city) {
                cityInput.value = city;
                performSearch(); // defined earlier
            }
        });
    });
}

// Helper: show/hide error
function showError(msg) {
    errorMessage.textContent = msg;
    errorBanner.classList.remove('hidden');
}
function hideError() {
    errorBanner.classList.add('hidden');
}

// Skeleton rendering functions
function renderSkeletonCurrent() {
    currentCard.innerHTML = `
        <div class="skeleton city-skeleton"></div>
        <div class="skeleton temp-skeleton"></div>
        <div class="skeleton desc-skeleton"></div>
        <div class="detail-row">
            <div class="skeleton detail-skeleton"></div>
            <div class="skeleton detail-skeleton"></div>
        </div>
        <div class="skeleton time-skeleton"></div>
    `;
    currentCard.classList.remove('real-data');
}

function renderSkeletonForecast() {
    let html = '';
    for (let i = 0; i < 7; i++) {
        html += `
            <div class="forecast-card">
                <div class="skeleton day-skeleton"></div>
                <div class="skeleton icon-skeleton"></div>
                <div class="skeleton temp-skeleton"></div>
            </div>
        `;
    }
    forecastRow.innerHTML = html;
}

// Populate current weather card with real data
function populateCurrentWeather(weatherData, cityName, humidity) {
    const current = weatherData.current_weather;
    const temp = current.temperature;
    const wind = current.windspeed;
    const weatherCode = current.weathercode;
    const weatherInfo = getWeatherInfo(weatherCode);

    currentCard.innerHTML = `
        <div class="real-data">
            <div class="city-name">${escapeHtml(cityName)}</div>
            <div class="temperature">${temp}°C</div>
            <div class="description">${weatherInfo.icon} ${weatherInfo.description}</div>
            <div class="detail-row">
                <div class="detail-item">💧 Humidity: ${humidity}%</div>
                <div class="detail-item">💨 Wind: ${wind} km/h</div>
            </div>
            <div class="local-time" id="localTimeDisplay">🕒 Loading local time...</div>
        </div>
    `;
    currentCard.classList.add('real-data');
}

// Populate 7-day forecast
function populateForecast(dailyData) {
    const times = dailyData.time;
    const maxTemps = dailyData.temperature_2m_max;
    const minTemps = dailyData.temperature_2m_min;
    const weatherCodes = dailyData.weathercode;

    let html = '';
    for (let i = 0; i < times.length; i++) {
        const dayName = getWeekday(times[i]);
        const weatherInfo = getWeatherInfo(weatherCodes[i]);
        const max = maxTemps[i];
        const min = minTemps[i];
        html += `
            <div class="forecast-card real-data">
                <div class="forecast-day">${dayName}</div>
                <div class="forecast-icon">${weatherInfo.icon}</div>
                <div class="forecast-temp">${max}° / ${min}°</div>
            </div>
        `;
    }
    forecastRow.innerHTML = html;
}

// Task 3: Fetch local time using jQuery $.getJSON
function updateLocalTimeWithJQuery(timezone) {
    const $timeElement = $('#localTimeDisplay');
    
    if (!timezone) {
        // Fallback to browser time if no timezone provided
        const browserTime = new Date();
        const timeString = browserTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        $timeElement.html(`🕒 Browser Time: ${timeString}`);
        console.log(`WorldTimeAPI skipped (no timezone) at ${new Date().toISOString()}`);
        return;
    }
    
    const url = `https://worldtimeapi.org/api/timezone/${encodeURIComponent(timezone)}`;
    
    $.getJSON(url)
        .done(function(data) {
            const datetime = data.datetime;
            const localTime = new Date(datetime);
            const timeString = localTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            $timeElement.html(`🕒 Local Time (${timezone}): ${timeString}`);
        })
        .fail(function(jqxhr, textStatus, error) {
            console.warn(`WorldTimeAPI failed for ${timezone}: ${textStatus}`);
            // Fallback to browser time
            const browserTime = new Date();
            const timeString = browserTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            $timeElement.html(`🕒 Browser Time: ${timeString}`);
        })
        .always(function() {
            console.log(`WorldTimeAPI request completed at ${new Date().toISOString()}`);
        });
}

// Fetch with timeout (default 10 seconds)
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error(`Request timeout (${timeoutMs}ms): ${url}`);
        }
        throw err;
    }
}

// Main fetch chain using async/await (Fetch API)
async function fetchWeatherForCity(cityName) {
    hideError();
    renderSkeletonCurrent();
    renderSkeletonForecast();

    try {
        // 1. Geocoding API - resolve city name to lat/lon
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;
        const geoResponse = await fetchWithTimeout(geoUrl);
        if (!geoResponse.ok) {
            throw new Error(`Geocoding API error (HTTP ${geoResponse.status})`);
        }
        const geoData = await geoResponse.json();
        
        // 2. Check if city found
        if (!geoData.results || geoData.results.length === 0) {
            showError(`City "${cityName}" not found. Please check the spelling.`);
            return;//exit
        }
        
        const { latitude, longitude, name: actualCityName } = geoData.results[0];
        
        // 3. Open-Meteo forecast API
        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
        const forecastResponse = await fetchWithTimeout(forecastUrl);
        if (!forecastResponse.ok) {
            throw new Error(`Weather API error (HTTP ${forecastResponse.status})`);
        }
        const forecastData = await forecastResponse.json();
        
        // Extract humidity (first value from hourly)
        let humidity = 'N/A';
        if (forecastData.hourly && forecastData.hourly.relativehumidity_2m && forecastData.hourly.relativehumidity_2m.length > 0) {
            humidity = forecastData.hourly.relativehumidity_2m[0];
        }
        
        // Populate UI
        populateCurrentWeather(forecastData, actualCityName, humidity);
        populateForecast(forecastData.daily);

        const timezone = forecastData.timezone;
        updateLocalTimeWithJQuery(timezone);
        
    } catch (err) {
        console.error(err);
        showError(`Network or server error: ${err.message}. Please try again.`);
    }
}

function performSearch() {
    const city = cityInput.value.trim();
    if (city === '') {
        showError('Please enter a city name.');
        return;
    }
    if (city.length < 2) {
        showError('City name must be at least 2 characters.');
        return;
    }
    lastSearchCity = city;
    fetchWeatherForCity(city);
}

const debouncedSearch = debounce(performSearch, 500);

// Bind events
searchBtn.addEventListener('click', debouncedSearch);
cityInput.addEventListener('input', debouncedSearch);

retryBtn.addEventListener('click', () => {
    fetchWeatherForCity(lastSearchCity);
});

fetchWeatherForCity('Johor Bahru');