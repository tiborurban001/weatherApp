const express = require("express");
const https = require("https");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");

const Schema = mongoose.Schema;
mongoose.connect(
  "mongodb+srv://Tibor:valami001@weatherdb.pcmad.mongodb.net/weatherDB",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

//mongoose csatlakozás üzenet/log
mongoose.connection.on(
  "error",
  console.error.bind("console", "Adatbázis csatlakozási hiba.")
);
mongoose.connection.once("open", () => {
  console.log("Adatbázis csatlakozva.");
});

//Adatszerkezet (schema) Mongo-hoz

const weatherSchema = new Schema({
  varos: String,
  lat: Number,
  lon: Number,
  homerseklet: Number,
  meresidejeUnix: Number,
  szelirany: Number,
  szelsebesseg: Number,
  legnyomashPa: Number,
  legnyomashgmm: Number,
  paratartalom: Number,
  felhozet: Number,
});

//model

const Weather = mongoose.model("Weather", weatherSchema);

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));

// Létrehozunk egy promise functiont hogy megszerezze nekünk az adatokat
const getWeatherPromise = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        res.on("data", (d) => {
          let parsedData = JSON.parse(d);
          resolve(parsedData);
        });
      })
      .on("error", (e) => {
        reject(e.message);
      });
  });
};

const writeToDB = (weatherData) => {
  return new Promise((resolve, reject) => {
    const newWeather = new Weather({
      varos: weatherData.name,
      lat: weatherData.coord.lat,
      lon: weatherData.coord.lon,
      homerseklet: weatherData.main.temp,
      meresidejeUnix: weatherData.dt,
      szelirany: weatherData.wind.deg,
      szelsebesseg: weatherData.wind.speed,
      legnyomashPa: weatherData.main.pressure * 0.75,
      legnyomashgmm: weatherData.main.pressure,
      paratartalom: weatherData.main.humidity,
      felhozet: weatherData.clouds.all,
    });
    resolve(newWeather.save());
    
    reject("Hiba az adatok mentése közben az adatbázisba.");
  });
};

app.get("/", (req, res) => {
  // res.send('express működik')
  res.render("index");
});

app.get("/:location", async (req, res) => {
  const { location } = req.params;
  const appId = "46d4b7c5d34fa20f4e66d522546c5d5f";
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${appId}&units=metric`;


  //ha létezik már adat róla 10 percen belül
  const currTime = Math.round(Date.now() / 1000 - 10);

  try {
    const total = (await Weather.count({ varos: location }).exec()) - 1;
    const last = await Weather.find({ varos: location });
    let lastTime = 0;
    if (total >= 0) {
      lastTime = last[total].meresidejeUnix;
    }

    //idő különbség
    const timeDiff = Math.round((currTime - lastTime) / 60);


    const weatherData = await getWeatherPromise(url);
    
    //Ha az idp különbség nagyobb mint 10 akkor mentse el az adatbázisba
    if (timeDiff > 10) {
      await writeToDB(weatherData);
      res.render("details", { weatherData });
      console.log(weatherData);
    //Ha nem akkor töltse be a régi adatból
    //(valamiért csak az eredeti szerkezettel működik)
    } else {
      const oldWeatherData = {
        coord: { lon: last[total].lon, lat: last[total].lat },
        weather: [{ icon: "01n" }],
        base: "stations",
        main: {
          temp: last[total].homerseklet,
          pressure: last[total].legnyomashgmm,
          humidity: last[total].paratartalom,
        },
        wind: { speed: last[total].szelsebesseg, deg: last[total].szelirany },
        clouds: { all: last[total].felhozet },
        dt: last[total].meresidejeUnix,
        sys: {
          country: "HU",
        },
        name: last[total].varos,
      };
      res.render("details", { weatherData: oldWeatherData });
    }
  } catch (err) {
    console.log(err);
    res.send("<div style='text-align:center'><h1 style='color:blue;'>Sajnáljuk hiba lépett fel. Kérjük próbálja újra később.</h1></div>");
  }
});

app.listen(process.env.PORT || 3000, function () {
  console.log("A szerver fut/Port:3000");
});
