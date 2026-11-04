//! The setting a track plays in: the part of the day, the weekday, the season,
//! how long the day is and whether the sun is up. Worked out on this computer
//! from the clock and a latitude, never from the network.
//!
//! The latitude is the city the person named, or else the city their time zone
//! is named after (`Europe/Moscow` → Moscow), which is close enough for the
//! length of the day and wrong only by how far they live from it.

use chrono::{DateTime, Datelike, Duration, NaiveDateTime, Timelike, Utc};
use serde::{Deserialize, Serialize};

use crate::{sun, zones};

/// The moment something happens, as this computer's clock tells it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Now {
    /// Milliseconds since 1970, UTC.
    pub utc_ms: i64,
    /// Minutes the local clock runs ahead of UTC (180 in Moscow).
    pub offset_min: i32,
    /// The system's time zone (`Europe/Moscow`), when it says.
    pub zone: Option<String>,
}

impl Now {
    /// The system clock and time zone.
    pub fn system() -> Self {
        let local = chrono::Local::now();
        Self {
            utc_ms: local.timestamp_millis(),
            offset_min: local.offset().local_minus_utc() / 60,
            zone: iana_time_zone::get_timezone().ok(),
        }
    }

    pub(crate) fn utc(&self) -> DateTime<Utc> {
        DateTime::from_timestamp_millis(self.utc_ms).unwrap_or_default()
    }

    /// The wall clock.
    pub(crate) fn local(&self) -> NaiveDateTime {
        self.utc().naive_utc() + Duration::minutes(i64::from(self.offset_min))
    }
}

/// A city the person named, so the day is worked out for where they are.
/// Kept to a tenth of a degree: enough for the sun, too little to find a house.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct City {
    pub name: String,
    pub lat: f64,
    pub lon: f64,
}

impl City {
    /// The city as it is kept: a trimmed name, coordinates rounded.
    pub fn new(name: &str, lat: f64, lon: f64) -> Option<Self> {
        let name = name.trim();
        let fits = !name.is_empty()
            && name.chars().count() <= 80
            && (-90.0..=90.0).contains(&lat)
            && (-180.0..=180.0).contains(&lon);
        fits.then(|| Self {
            name: name.to_owned(),
            lat: tenth(lat),
            lon: tenth(lon),
        })
    }
}

/// The city a time zone is named after, standing in for a city not named yet.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoneCity {
    /// The zone as the system reports it (`Europe/Moscow`).
    pub zone: String,
    pub lat: f64,
    pub lon: f64,
}

impl ZoneCity {
    /// The zone's city, from tzdb's own table; `None` for zones without one (`UTC`).
    pub fn of(zone: &str) -> Option<Self> {
        let canonical = zones::ALIASES
            .binary_search_by(|(alias, _)| alias.cmp(&zone))
            .map_or(zone, |at| zones::ALIASES[at].1);
        let at = zones::ZONES
            .binary_search_by(|(name, _, _)| name.cmp(&canonical))
            .ok()?;
        let (_, lat, lon) = zones::ZONES[at];
        Some(Self {
            zone: zone.to_owned(),
            lat,
            lon,
        })
    }
}

/// Where the latitude in a snapshot came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PlaceFrom {
    /// The city the person named.
    City,
    /// The city of their time zone: a guess.
    Zone,
}

/// The place the sun is worked out for.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Place {
    pub lat: f64,
    pub lon: f64,
    pub from: PlaceFrom,
}

impl Place {
    /// The named city first, else the time zone's city, else nothing to go on.
    pub fn resolve(city: Option<&City>, zone: Option<&str>) -> Option<Self> {
        if let Some(city) = city {
            return Some(Self {
                lat: city.lat,
                lon: city.lon,
                from: PlaceFrom::City,
            });
        }
        let guess = ZoneCity::of(zone?)?;
        Some(Self {
            lat: guess.lat,
            lon: guess.lon,
            from: PlaceFrom::Zone,
        })
    }
}

/// The part of the day by the clock.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PartOfDay {
    /// 00:00–05:59
    Night,
    /// 06:00–11:59
    Morning,
    /// 12:00–17:59
    Day,
    /// 18:00–23:59
    Evening,
}

impl PartOfDay {
    pub fn of_hour(hour: u32) -> Self {
        match hour {
            0..=5 => Self::Night,
            6..=11 => Self::Morning,
            12..=17 => Self::Day,
            _ => Self::Evening,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Weekday {
    Mon,
    Tue,
    Wed,
    Thu,
    Fri,
    Sat,
    Sun,
}

impl From<chrono::Weekday> for Weekday {
    fn from(day: chrono::Weekday) -> Self {
        match day {
            chrono::Weekday::Mon => Self::Mon,
            chrono::Weekday::Tue => Self::Tue,
            chrono::Weekday::Wed => Self::Wed,
            chrono::Weekday::Thu => Self::Thu,
            chrono::Weekday::Fri => Self::Fri,
            chrono::Weekday::Sat => Self::Sat,
            chrono::Weekday::Sun => Self::Sun,
        }
    }
}

/// The season by the calendar (winter is December to February in the north)
/// and by the hemisphere: December is summer in Sydney.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Season {
    Winter,
    Spring,
    Summer,
    Autumn,
}

impl Season {
    pub fn of(month: u32, southern: bool) -> Self {
        let north = match month {
            12 | 1 | 2 => Self::Winter,
            3..=5 => Self::Spring,
            6..=8 => Self::Summer,
            _ => Self::Autumn,
        };
        if !southern {
            return north;
        }
        match north {
            Self::Winter => Self::Summer,
            Self::Spring => Self::Autumn,
            Self::Summer => Self::Winter,
            Self::Autumn => Self::Spring,
        }
    }
}

/// A snapshot of the setting a play started in.
///
/// Every field is always written, so a snapshot is a whole object even when
/// nothing about the place is known: what cannot be worked out is `null`.
/// `weather`, `activity` and `mood` are kept for what the app will learn to
/// ask later and are `null` until then.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Setting {
    /// The part of the day by the clock.
    pub tod: Option<PartOfDay>,
    /// The day of the week.
    pub dow: Option<Weekday>,
    pub season: Option<Season>,
    /// Hours from sunrise to sunset that day, to a tenth.
    pub daylight: Option<f64>,
    /// The sun's height in whole degrees: below 0 after sunset, below −6 dark.
    pub sun: Option<i32>,
    /// Sunrise and sunset that day on the local clock, in minutes after
    /// midnight; `null` through a polar day or night.
    pub rise: Option<u32>,
    pub set: Option<u32>,
    /// The latitude those were worked out for, to a tenth of a degree.
    pub lat: Option<f64>,
    /// Whether that latitude is the person's own city or their time zone's.
    pub place: Option<PlaceFrom>,
    pub weather: Option<serde_json::Value>,
    pub activity: Option<serde_json::Value>,
    pub mood: Option<serde_json::Value>,
}

impl Setting {
    /// The setting at `now`. Without a place there is no daylight or sun, and
    /// the season is the northern hemisphere's.
    pub fn at(now: &Now, place: Option<Place>) -> Self {
        let local = now.local();
        let southern = place.is_some_and(|place| place.lat < 0.0);
        let mut setting = Self {
            tod: Some(PartOfDay::of_hour(local.hour())),
            dow: Some(local.weekday().into()),
            season: Some(Season::of(local.month(), southern)),
            ..Self::default()
        };
        if let Some(place) = place {
            let daylight = sun::day_length(place.lat, Some(place.lon), local.date());
            setting.daylight = Some(tenth(daylight));
            // A whole degree is all a sky needs; `as` cannot overflow at ±90.
            setting.sun = Some(sun::altitude(place.lat, place.lon, now.utc()).round() as i32);
            if let Some((up, down)) = sun::sunrise_sunset(place.lat, place.lon, local.date()) {
                let clock = |hours: f64| {
                    // Minutes in a day: always 0..1440 after `rem_euclid`, so `as` is exact.
                    ((hours * 60.0).round() as i64 + i64::from(now.offset_min)).rem_euclid(1440)
                        as u32
                };
                setting.rise = Some(clock(up));
                setting.set = Some(clock(down));
            }
            setting.lat = Some(tenth(place.lat));
            setting.place = Some(place.from);
        }
        setting
    }
}

fn tenth(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// 4 November 2026 at `h:m` Moscow time.
    fn moscow(h: i64, m: i64) -> Now {
        let utc = DateTime::parse_from_rfc3339("2026-11-04T00:00:00+03:00")
            .unwrap()
            .timestamp_millis();
        Now {
            utc_ms: utc + (h * 60 + m) * 60_000,
            offset_min: 180,
            zone: Some("Europe/Moscow".into()),
        }
    }

    #[test]
    fn parts_of_the_day_follow_the_clock() {
        let parts: Vec<_> = [0, 5, 6, 11, 12, 17, 18, 23]
            .into_iter()
            .map(PartOfDay::of_hour)
            .collect();
        use PartOfDay::*;
        assert_eq!(
            parts,
            [Night, Night, Morning, Morning, Day, Day, Evening, Evening]
        );
    }

    #[test]
    fn seasons_turn_over_in_the_south() {
        assert_eq!(Season::of(12, false), Season::Winter);
        assert_eq!(Season::of(2, false), Season::Winter);
        assert_eq!(Season::of(3, false), Season::Spring);
        assert_eq!(Season::of(8, false), Season::Summer);
        assert_eq!(Season::of(11, false), Season::Autumn);
        assert_eq!(Season::of(12, true), Season::Summer);
        assert_eq!(Season::of(7, true), Season::Winter);
        assert_eq!(Season::of(4, true), Season::Autumn);
    }

    #[test]
    fn a_time_zone_stands_in_for_the_city() {
        let moscow = ZoneCity::of("Europe/Moscow").unwrap();
        assert_eq!((moscow.lat, moscow.lon), (55.8, 37.6));
        // Old names still find their zone, and keep the name the system gave.
        let kyiv = ZoneCity::of("Europe/Kiev").unwrap();
        assert_eq!((kyiv.zone.as_str(), kyiv.lat), ("Europe/Kiev", 50.4));
        assert!(ZoneCity::of("UTC").is_none());
        assert!(ZoneCity::of("Nowhere/Atlantis").is_none());
    }

    #[test]
    fn the_zone_table_is_sorted_for_searching() {
        assert!(zones::ZONES.windows(2).all(|pair| pair[0].0 < pair[1].0));
        assert!(zones::ALIASES.windows(2).all(|pair| pair[0].0 < pair[1].0));
        assert!(zones::ZONES.len() > 400);
    }

    #[test]
    fn a_named_city_wins_over_the_time_zone() {
        let piter = City::new(" Санкт-Петербург ", 59.938_9, 30.315_8).unwrap();
        assert_eq!(
            (piter.name.as_str(), piter.lat, piter.lon),
            ("Санкт-Петербург", 59.9, 30.3)
        );
        let place = Place::resolve(Some(&piter), Some("Europe/Moscow")).unwrap();
        assert_eq!((place.lat, place.from), (59.9, PlaceFrom::City));
        let guess = Place::resolve(None, Some("Europe/Moscow")).unwrap();
        assert_eq!((guess.lat, guess.from), (55.8, PlaceFrom::Zone));
        assert!(Place::resolve(None, None).is_none());
        assert!(City::new("", 10.0, 10.0).is_none());
        assert!(City::new("Nowhere", 91.0, 10.0).is_none());
    }

    #[test]
    fn an_evening_in_november_moscow() {
        let now = moscow(19, 30);
        let setting = Setting::at(&now, Place::resolve(None, now.zone.as_deref()));
        assert_eq!(setting.tod, Some(PartOfDay::Evening));
        assert_eq!(setting.dow, Some(Weekday::Wed));
        assert_eq!(setting.season, Some(Season::Autumn));
        // The almanac's 9 h 02 min, worked out for the zone's city.
        assert_eq!(setting.daylight, Some(9.0));
        // Sunset was at 16:44: by half past seven it is fully dark.
        assert!(setting.sun.unwrap() < -18, "{:?}", setting.sun);
        // The almanac's 07:42 and 16:44, give or take a minute for the zone's city.
        let near = |got: Option<u32>, want: u32| got.is_some_and(|got| got.abs_diff(want) <= 2);
        assert!(near(setting.rise, 7 * 60 + 42), "{:?}", setting.rise);
        assert!(near(setting.set, 16 * 60 + 44), "{:?}", setting.set);
        assert_eq!(setting.place, Some(PlaceFrom::Zone));
        // A late morning has the sun up.
        let morning = Setting::at(&moscow(11, 0), Place::resolve(None, Some("Europe/Moscow")));
        assert_eq!(morning.tod, Some(PartOfDay::Morning));
        assert!(morning.sun.unwrap() > 10);
    }

    #[test]
    fn the_local_day_is_the_one_on_the_wall() {
        // 23:30 in Moscow is still Wednesday, though UTC is at 20:30.
        let late = Setting::at(&moscow(23, 30), None);
        assert_eq!(
            (late.tod, late.dow),
            (Some(PartOfDay::Evening), Some(Weekday::Wed))
        );
        // Half an hour later it is Thursday night.
        let after = Setting::at(&moscow(24, 0), None);
        assert_eq!(
            (after.tod, after.dow),
            (Some(PartOfDay::Night), Some(Weekday::Thu))
        );
    }

    #[test]
    fn a_snapshot_is_a_whole_object_even_with_nothing_known() {
        let bare = serde_json::to_value(Setting::at(&moscow(3, 0), None)).unwrap();
        assert_eq!(
            bare,
            json!({
                "tod": "night", "dow": "wed", "season": "autumn",
                "daylight": null, "sun": null, "rise": null, "set": null, "lat": null, "place": null,
                "weather": null, "activity": null, "mood": null,
            })
        );
        // An older or shorter snapshot still reads.
        let old: Setting = serde_json::from_value(json!({ "tod": "day" })).unwrap();
        assert_eq!(old.tod, Some(PartOfDay::Day));
        assert_eq!(old.weather, None);
    }
}
