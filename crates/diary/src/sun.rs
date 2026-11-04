//! Where the sun is, worked out from the date and a place alone, with no
//! network: how long the day lasts and how high the sun stands at a moment.
//!
//! The sun's position is the Astronomical Almanac's low-precision formula
//! (its mean longitude and anomaly, then the ecliptic longitude), good to
//! about 0.01° for decades either side of 2000: the length of a day comes out
//! within a minute or two of the almanac's own tables. Sunrise and sunset are
//! taken where the centre of the sun is 0.833° below the horizon: refraction
//! lifts it by about 34′, and its upper edge shows 16′ before its centre.

use chrono::{DateTime, NaiveDate, NaiveTime, Utc};

/// The sun's centre at sunrise and sunset, in degrees.
const HORIZON: f64 = -0.833;
/// 2000-01-01 12:00 UTC, the epoch the formulas count days from, as a Julian date.
const J2000: f64 = 2_451_545.0;
/// 1970-01-01 00:00 UTC as a Julian date.
const UNIX_EPOCH: f64 = 2_440_587.5;

/// Days since 2000-01-01 12:00 UTC.
fn days_since_j2000(at: DateTime<Utc>) -> f64 {
    // Milliseconds since 1970 fit an f64 exactly for millions of years.
    at.timestamp_millis() as f64 / 86_400_000.0 + UNIX_EPOCH - J2000
}

/// The sun's declination and right ascension, in radians, `n` days after J2000.
fn position(n: f64) -> (f64, f64) {
    let mean_longitude = (280.460 + 0.985_647_4 * n).rem_euclid(360.0);
    let anomaly = (357.528 + 0.985_600_3 * n).rem_euclid(360.0).to_radians();
    let longitude =
        (mean_longitude + 1.915 * anomaly.sin() + 0.020 * (2.0 * anomaly).sin()).to_radians();
    let obliquity = (23.439 - 0.000_000_4 * n).to_radians();
    let declination = (obliquity.sin() * longitude.sin()).asin();
    let right_ascension = (obliquity.cos() * longitude.sin()).atan2(longitude.cos());
    (declination, right_ascension)
}

/// Hours from sunrise to sunset on `date` at `latitude` (degrees, north
/// positive): 0 through a polar night, 24 through a polar day.
///
/// `longitude` (degrees, east positive) only moves the moment the sun is
/// worked out for to the place's own noon; without it, Greenwich's noon is
/// used, which changes the answer by a minute or so at most.
pub fn day_length(latitude: f64, longitude: Option<f64>, date: NaiveDate) -> f64 {
    let midnight = date.and_time(NaiveTime::MIN).and_utc();
    let noon = days_since_j2000(midnight) + (12.0 - longitude.unwrap_or(0.0) / 15.0) / 24.0;
    let (declination, _) = position(noon);
    let lat = latitude.clamp(-90.0, 90.0).to_radians();
    let cos_hour = (HORIZON.to_radians().sin() - lat.sin() * declination.sin())
        / (lat.cos() * declination.cos());
    if cos_hour >= 1.0 {
        0.0
    } else if cos_hour <= -1.0 {
        24.0
    } else {
        2.0 * cos_hour.acos().to_degrees() / 15.0
    }
}

/// How high the sun's centre stands above the horizon at `at`, in degrees:
/// below zero after sunset, below −6 once it is dark enough to need a lamp,
/// below −18 in full night. Refraction is left out.
pub fn altitude(latitude: f64, longitude: f64, at: DateTime<Utc>) -> f64 {
    let n = days_since_j2000(at);
    let (declination, right_ascension) = position(n);
    let sidereal = (280.460_618_37 + 360.985_647_366_29 * n).rem_euclid(360.0);
    let hour_angle = (sidereal + longitude).to_radians() - right_ascension;
    let lat = latitude.clamp(-90.0, 90.0).to_radians();
    let sin_altitude =
        lat.sin() * declination.sin() + lat.cos() * declination.cos() * hour_angle.cos();
    sin_altitude.clamp(-1.0, 1.0).asin().to_degrees()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn date(text: &str) -> NaiveDate {
        NaiveDate::parse_from_str(text, "%Y-%m-%d").unwrap()
    }

    /// Sunrise to sunset as the US Naval Observatory gives it
    /// (aa.usno.navy.mil, rise and set to the minute), in minutes.
    const ALMANAC: &[(&str, &str, f64, f64, f64)] = &[
        ("Moscow, winter solstice", "2026-12-21", 55.75, 37.62, 421.0),
        (
            "Moscow, summer solstice",
            "2026-06-21",
            55.75,
            37.62,
            1053.0,
        ),
        ("Moscow, equinox", "2026-03-20", 55.75, 37.62, 731.0),
        ("Moscow, early November", "2026-11-04", 55.75, 37.62, 542.0),
        ("St Petersburg, winter", "2026-12-21", 59.94, 30.31, 354.0),
        (
            "St Petersburg, white nights",
            "2026-06-21",
            59.94,
            30.31,
            1131.0,
        ),
        ("Novosibirsk, January", "2026-01-15", 55.03, 82.92, 467.0),
        ("Yakutsk, winter", "2026-12-21", 62.03, 129.73, 308.0),
        (
            "Vladivostok, autumn equinox",
            "2026-09-23",
            43.12,
            131.89,
            729.0,
        ),
        ("Reykjavik, summer", "2026-06-21", 64.15, -21.94, 1269.0),
        ("The equator", "2026-03-20", 0.0, -78.5, 727.0),
        ("Sydney, its summer", "2026-12-21", -33.87, 151.21, 864.0),
        ("Sydney, its winter", "2026-06-21", -33.87, 151.21, 594.0),
    ];

    /// The spec asks for five minutes; the sums do better, and this keeps them there.
    const MINUTES: f64 = 2.0;

    #[test]
    fn the_day_lasts_as_long_as_the_almanac_says() {
        for &(place, day, lat, lon, minutes) in ALMANAC {
            let worked_out = day_length(lat, Some(lon), date(day)) * 60.0;
            assert!(
                (worked_out - minutes).abs() <= MINUTES,
                "{place} on {day}: {worked_out:.1} min, the almanac says {minutes}"
            );
        }
    }

    #[test]
    fn without_a_longitude_the_day_is_still_right() {
        for &(place, day, lat, _, minutes) in ALMANAC {
            let worked_out = day_length(lat, None, date(day)) * 60.0;
            assert!(
                (worked_out - minutes).abs() <= MINUTES,
                "{place} on {day}: {worked_out:.1} min, the almanac says {minutes}"
            );
        }
    }

    #[test]
    fn beyond_the_polar_circle_the_day_is_all_or_nothing() {
        // Murmansk: the almanac has the sun «continuously below» and «above» the horizon.
        assert_eq!(day_length(68.97, Some(33.08), date("2026-12-21")), 0.0);
        assert_eq!(day_length(68.97, Some(33.08), date("2026-06-21")), 24.0);
        // The poles themselves, and a latitude past them, do not break the sums.
        assert_eq!(day_length(90.0, None, date("2026-06-21")), 24.0);
        assert_eq!(day_length(-95.0, None, date("2026-06-21")), 0.0);
    }

    #[test]
    fn the_sun_stands_where_the_almanac_puts_it() {
        let moscow = |h, m| Utc.with_ymd_and_hms(2026, 12, 21, h, m, 0).unwrap();
        // Sunrise 08:57 MSK (05:57 UTC): the centre at −0.833°.
        let rise = altitude(55.75, 37.62, moscow(5, 57));
        assert!((rise - HORIZON).abs() < 0.2, "sunrise at {rise:.2}°");
        // Civil twilight begins 08:10 MSK (05:10 UTC): the sun 6° down.
        let twilight = altitude(55.75, 37.62, moscow(5, 10));
        assert!((twilight + 6.0).abs() < 0.2, "twilight at {twilight:.2}°");
        // Noon (12:28 MSK): 90 − 55.75 − 23.44 ≈ 10.8° at the solstice.
        let noon = altitude(55.75, 37.62, moscow(9, 28));
        assert!((noon - 10.8).abs() < 0.2, "noon at {noon:.2}°");
        // Midnight is the deepest night.
        assert!(altitude(55.75, 37.62, moscow(21, 28)) < -50.0);
    }
}
