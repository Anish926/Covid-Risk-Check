const token =
  "pk.eyJ1IjoiYW5pc2hiYXNoeWFsIiwiYSI6ImNrdG80NmplaDAydHEyb2w4YnByb2Vrb2oifQ.VLGxj122OF5vmIZEFiatSg";
mapboxgl.accessToken = token;
const totalPopulationData = {};
const populationData = {};
const geoData = {};
const countryCode = {};
const modal = document.getElementById("myModal");
const span = document.getElementsByClassName("close")[0];
const riskCountry = document.getElementById("risk-country");
const countryStatus = document.getElementById("country-status");
const crowdiness = document.getElementById("crowdiness");
const activeCases = document.getElementById("active-cases");
const vaccinated = document.getElementById("vaccinated");
const estimatedYears = document.getElementById("estimated-years");
const estimatedMonths = document.getElementById("estimated-months");
const searchButton = document.getElementById("search-button");
const searchBar = document.getElementById("search-bar");

searchBar.addEventListener("keydown", (key) => {
  if (key.code === "Enter") {
    triggerSearch(searchBar.value);
  }
});
searchButton.onclick = function () {
  triggerSearch(searchBar.value);
};
span.onclick = function () {
  modal.style.display = "none";
};

window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v10",
  zoom: 1,
});

function riskCalc(
  populationDensity,
  casesPerOneMillion,
  testsPerOneMillion,
  activePerOneMillion
) {
  const testToCaseRatio = testsPerOneMillion / casesPerOneMillion;
  let risk = 0;
  let riskLevel;
  if (testToCaseRatio <= 10) risk += 4;
  else if (testToCaseRatio <= 30) risk += 2.5;
  else risk += 1;

  if (activePerOneMillion <= 100) risk += 1;
  else if (activePerOneMillion <= 500) risk += 2.5;
  else risk += 4;

  if (populationDensity >= 300) risk += 2;
  else if (populationDensity >= 100) risk += 1;
  else risk += 0.5;

  // todo if(vaccinated) risk-=2.5;

  if (risk <= 4) {
    countryStatus.style.color = "green";
    riskLevel = "Low";
  } else if (risk <= 8) {
    countryStatus.style.color = "orange";
    riskLevel = "Moderate";
  } else {
    countryStatus.style.color = "red";
    riskLevel = "High";
  }
  return riskLevel;
}

function estimateVaccination(
  population,
  alreadyVaccinated,
  vaccineDay7,
  vaccineDay1
) {
  const averageVaccineDaily = (vaccineDay7 - vaccineDay1) / 7;
  if (averageVaccineDaily === 0) return [-1, -1];
  const estimation = Math.round(
    (2 * population - alreadyVaccinated) / (averageVaccineDaily * 30)
  );
  console.log(averageVaccineDaily, population, estimation);

  return [Math.floor(estimation / 12), estimation % 12];
}
async function triggerSearch(country) {
  if (populationData[country]) {
    zoomTo(geoData[country].long, geoData[country].lan);
    const code = countryCode[country];
    const cases = await covidData(code);
    const vaccine = await vaccineData(code);
    const estimation = estimateVaccination(
      totalPopulationData[country],
      vaccine.timeline[7].total,
      vaccine.timeline[6].total,
      vaccine.timeline[0].total
    );
    console.log(vaccine, estimation);
    const riskLevel = riskCalc(
      populationData[country],
      cases[1],
      cases[2],
      cases[3]
    );
    countryStatus.innerText = `${riskLevel}`;
    riskCountry.innerText = `${country}`;
    crowdiness.innerText = `${populationData[country]}`;
    activeCases.innerText = `${cases[0]}`;
    vaccinated.innerText = `${vaccine.timeline[7].total}`;
    estimatedYears.innerText = "";
    estimatedMonths.innerText = "";
    if (estimation[0] == -1 && estimation[1] == -1)
      estimatedYears.innerText = `Uncertain`;
    else if (estimation[0] >= 5) estimatedYears.innerText = "5+ Years";
    else {
      if (estimation[0] > 0)
        estimatedYears.innerText = `${estimation[0]} Year${
          estimation[0] > 1 ? "s" : ""
        }`;
      if (estimation[1] > 0)
        estimatedMonths.innerText = `${estimation[1]} Month${
          estimation[1] > 1 ? "s" : ""
        }`;
    }
    modal.style.display = "block";
  }
}
function zoomTo(long, lat) {
  map.flyTo({
    center: [long, lat],
    speed: 0.3,
    minzoom: 1.5,
  });
}
function addMarker(long, lat, country, code) {
  if (!(lat > 90 || lat < -90 || isNaN(long) || isNaN(lat))) {
    const el = document.createElement("div");
    el.className = "marker mapboxgl-marker mapboxgl-marker-anchor-center";
    const flagUrl = `https://www.countryflags.io/${code}/shiny/64.png`;
    el.style.backgroundImage = `url(${flagUrl})`;
    const marker = new mapboxgl.Marker(el).setLngLat([long, lat]).addTo(map);
    marker.getElement().addEventListener("click", () => {
      triggerSearch(country);
    });
  }
}

async function getPopulation() {
  await fetch("/data/population.json")
    .then((response) => response.json())
    .then((data) => {
      data.forEach((element) => {
        populationData[element.country] = element.density;
        totalPopulationData[element.country] = Number(element.pop2021) * 1000;
      });
    });
  await fetch("/data/coordinates.json")
    .then((response) => response.json())
    .then((data) => {
      data.forEach((element) => {
        const long = element.longitude;
        const lan = element.latitude;
        geoData[element.country] = { long, lan };
        countryCode[element.country] = element.alpha2;
        //addMarker(long, lan);
      });
    });

  for (const [country, { long, lan }] of Object.entries(geoData)) {
    if (populationData[country]) {
      populationData[country] = Math.ceil(populationData[country]);
      addMarker(
        long,
        lan,
        country,
        countryCode[country],
        populationData[country]
      );
    }
  }
}

async function covidData(country) {
  const data = await fetch(
    `https://disease.sh/v3/covid-19/countries/${country}`
  ).then((response) => response.json());
  return [
    data.active,
    data.casesPerOneMillion,
    data.testsPerOneMillion,
    data.activePerOneMillion,
  ];
}

async function vaccineData(country) {
  const data = await fetch(
    `https://disease.sh/v3/covid-19/vaccine/coverage/countries/${country}?lastdays=8&fullData=true
    `
  ).then((response) => response.json());
  return data;
}
getPopulation();
