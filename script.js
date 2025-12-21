/* ===============================
   CONFIG
================================ */
const API_KEY = "4b20f1aab98f9ec99f22b2ae19e34f39";
const BASE = "https://api.openweathermap.org/data/2.5";

let timelineData = [];
let activeDotIndex = 0;
let sunriseTime = null;
let sunsetTime = null;

/* ===============================
   HELPERS
================================ */
const $ = id => document.getElementById(id);

const WORLD_CITIES = [
  { name: "New York", country: "US" },
  { name: "London", country: "GB" },
  { name: "Tokyo", country: "JP" },
  { name: "Delhi", country: "IN" },
  { name: "Paris", country: "FR" },
  { name: "Singapore", country: "SG" }
];

/* ===============================
   AQI (PM2.5)
================================ */
function calculateAQI_PM25(pm) {
  const bp = [
    [0, 12, 0, 50, "Good"],
    [12.1, 35.4, 51, 100, "Moderate"],
    [35.5, 55.4, 101, 150, "Unhealthy for Sensitive Groups"],
    [55.5, 150.4, 151, 200, "Unhealthy"],
    [150.5, 250.4, 201, 300, "Very Unhealthy"],
    [250.5, 500.4, 301, 500, "Hazardous"]
  ];

  for (const [cL, cH, iL, iH, label] of bp) {
    if (pm >= cL && pm <= cH) {
      const value = Math.round(
        ((iH - iL) / (cH - cL)) * (pm - cL) + iL
      );
      return { value, label };
    }
  }
  return { value: "—", label: "Unknown" };
}

/* ===============================
   MAP
================================ */
let map, marker;

function loadMap(lat, lon) {
  if (!map) {
    map = L.map("map", { zoomControl: false }).setView([lat, lon], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    marker = L.marker([lat, lon]).addTo(map);
  } else {
    map.setView([lat, lon], 10);
    marker.setLatLng([lat, lon]);
  }
}

/* ===============================
   WEATHER
================================ */
async function loadWeather(city) {
  if (!city) return;

  const res = await fetch(`${BASE}/weather?q=${city}&units=metric&appid=${API_KEY}`);
  const d = await res.json();
  if (d.cod !== 200) return alert("City not found");

  $("cityName").textContent = d.name;
  $("temp").textContent = Math.round(d.main.temp);
  $("maxTemp").textContent = Math.round(d.main.temp_max) + "°";
  $("minTemp").textContent = Math.round(d.main.temp_min) + "°";
  $("desc").textContent = d.weather[0].description;
  $("humidity").textContent = d.main.humidity + "%";
  $("wind").textContent = Math.round(d.wind.speed * 3.6) + " km/h";
  $("pressure").textContent = d.main.pressure + " hPa";
  $("feels").textContent = Math.round(d.main.feels_like) + "°";
  $("visibility").textContent = (d.visibility / 1000).toFixed(1) + " km";

  loadForecast(city);
  loadAQI(d.coord.lat, d.coord.lon);
  loadMap(d.coord.lat, d.coord.lon);
  sunriseTime = d.sys.sunrise * 1000;
sunsetTime = d.sys.sunset * 1000;

updateDayNight(Date.now());

}

/* ===============================
   FORECAST
================================ */
async function loadForecast(city) {
  const res = await fetch(`${BASE}/forecast?q=${city}&units=metric&appid=${API_KEY}`);
  const d = await res.json();

  $("forecastRow").innerHTML = "";
  timelineData = [];

  d.list.slice(0, 8).forEach(item => {
    const temp = Math.round(item.main.temp);
    const feels = Math.round(item.main.feels_like);
    const time = item.dt_txt.slice(11, 16);

    timelineData.push({ temp, feels, time });

    const card = document.createElement("div");
    card.className = "forecast-item";
    card.innerHTML = `<p>${time}</p><b>${temp}°</b>`;
    $("forecastRow").appendChild(card);
  });

  drawGraph(timelineData);
  setupTimeline();
}

/* ===============================
   GRAPH (DUAL LINE + ACTIVE DOT)
================================ */
function drawGraph(data) {
  if (!data || data.length < 2) return;

  const width = 700, height = 300, pad = 50;

  const path = $("graphPath");
  const dots = $("graphDots");
  const grid = $("grid");
  const yLabels = $("yLabels");

  dots.innerHTML = grid.innerHTML = yLabels.innerHTML = "";

  const temps = data.map(d => d.temp);
  const feels = data.map(d => d.feels);

  const max = Math.max(...temps, ...feels);
  const min = Math.min(...temps, ...feels);
  const range = Math.max(1, max - min);

  $("minGraph").textContent = `Min: ${min}°`;
  $("maxGraph").textContent = `Max: ${max}°`;

  const sx = i => pad + (i / (temps.length - 1)) * (width - pad * 2);
  const sy = t => height - pad - ((t - min) / range) * (height - pad * 2);

  /* grid */
  for (let i = 0; i <= 4; i++) {
    const y = pad + (i / 4) * (height - pad * 2);
    const val = Math.round(min + (range / 4) * (4 - i));

    const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", 10);
    txt.setAttribute("y", y + 4);
    txt.textContent = val + "°";
    txt.setAttribute("class", "y-label");
    yLabels.appendChild(txt);

    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", pad);
    ln.setAttribute("x2", width - pad);
    ln.setAttribute("y1", y);
    ln.setAttribute("y2", y);
    ln.setAttribute("class", "grid-line");
    grid.appendChild(ln);
  }

  /* main temp line */
  path.setAttribute(
    "d",
    "M " + temps.map((t, i) => `${sx(i)},${sy(t)}`).join(" L ")
  );

  /* feels-like line */
  const feelsPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  feelsPath.setAttribute(
    "d",
    "M " + feels.map((t, i) => `${sx(i)},${sy(t)}`).join(" L ")
  );
  feelsPath.setAttribute("stroke", "#67e8f9");
  feelsPath.setAttribute("stroke-dasharray", "6 6");
  feelsPath.setAttribute("fill", "none");
  feelsPath.setAttribute("stroke-width", "2");
  grid.appendChild(feelsPath);

  /* dots */
  temps.forEach((t, i) => {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", sx(i));
    dot.setAttribute("cy", sy(t));
    dot.setAttribute("r", i === activeDotIndex ? 7 : 4);
    dot.setAttribute("class", "graph-dot");
    dots.appendChild(dot);
  });
}

/* ===============================
   TIMELINE (SCRUB + ANIMATE)
================================ */
function setupTimeline() {
  const slider = $("timeSlider");
  if (!slider || timelineData.length === 0) return;

  slider.max = timelineData.length - 1;
  slider.value = 0;
  updateTimelineUI(0);

  slider.oninput = e => updateTimelineUI(+e.target.value);
}

function updateTimelineUI(index) {
  const point = timelineData[index];
  if (!point) return;

  activeDotIndex = index;

  $("sliderTime").textContent = point.time;
  $("sliderTemp").textContent = `${point.temp}°`;

  $("temp").textContent = point.temp;
  $("feels").textContent = point.feels + "°";

  // ⬇️ NEW: approximate timeline time
  const now = Date.now();
  const simulatedTime = now + index * 3 * 60 * 60 * 1000;
  updateDayNight(simulatedTime);

  drawGraph(timelineData);
}

/* ===============================
   AIR QUALITY
================================ */
async function loadAQI(lat, lon) {
  const res = await fetch(`${BASE}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
  const d = await res.json();

  const pm25 = d.list[0].components.pm2_5;
  const aqi = calculateAQI_PM25(pm25);

  $("pm25").textContent = pm25.toFixed(1);
  $("aqiScore").textContent = aqi.value;
  $("aqiLabel").textContent = aqi.label;

  $("aqiScore").className = "aqi-badge " + ({
    "Good": "aqi-good",
    "Moderate": "aqi-moderate",
    "Unhealthy for Sensitive Groups": "aqi-usg",
    "Unhealthy": "aqi-unhealthy",
    "Very Unhealthy": "aqi-very",
    "Hazardous": "aqi-hazard"
  }[aqi.label] || "");
}

/* ===============================
   WORLD CITIES
================================ */
async function loadWorldCities() {
  const grid = $("worldGrid");
  grid.innerHTML = "";

  for (const c of WORLD_CITIES) {
    const res = await fetch(`${BASE}/weather?q=${c.name},${c.country}&units=metric&appid=${API_KEY}`);
    const d = await res.json();

    const card = document.createElement("div");
    card.className = "city-card";
    card.onclick = () => loadWeather(d.name);

    card.innerHTML = `
      <div class="city-header">
        <span>${d.name}, ${c.country}</span>
        <span class="city-temp">${Math.round(d.main.temp)}°</span>
      </div>
      <div class="mini-bars">
        <div class="bar temp" style="height:${d.main.temp * 2}px"></div>
        <div class="bar hum" style="height:${d.main.humidity}px"></div>
        <div class="bar pres" style="height:${(d.main.pressure - 980) / 2}px"></div>
        <div class="bar wind" style="height:${d.wind.speed * 8}px"></div>
      </div>
      <div class="city-meta">
        <span>Humidity ${d.main.humidity}%</span>
        <span>Wind ${d.wind.speed.toFixed(1)} m/s</span>
      </div>
    `;

    grid.appendChild(card);
  }
}
function updateDayNight(currentTime) {
  if (!sunriseTime || !sunsetTime) return;

  const isDay = currentTime >= sunriseTime && currentTime < sunsetTime;

  document.body.classList.toggle("day", isDay);
  document.body.classList.toggle("night", !isDay);
}

/* ===============================
   INIT
================================ */
$("searchBtn").onclick = () => loadWeather($("searchInput").value.trim());
$("searchInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    loadWeather(e.target.value.trim());
  }
});

loadWeather("Delhi");
loadWorldCities();
