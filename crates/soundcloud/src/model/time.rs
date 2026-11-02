//! Timestamps. api-v2 mostly sends ISO 8601 strings (`2019-01-04T18:42:33Z`),
//! which pass through untouched; a few fields are believed to be epoch numbers
//! instead and are converted, so the frontend only ever sees ISO strings.

use serde::{Deserialize, Deserializer};

/// Accepts an ISO string, epoch milliseconds or epoch seconds.
pub(crate) fn lenient_timestamp<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<String>, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Raw {
        Text(String),
        Integer(i64),
        Float(f64),
    }

    Ok(match Option::<Raw>::deserialize(deserializer)? {
        Some(Raw::Text(text)) => super::text(Some(text)),
        Some(Raw::Integer(number)) => Some(iso_from_epoch(number)),
        // Truncation is the point: sub-millisecond precision means nothing here.
        Some(Raw::Float(number)) => Some(iso_from_epoch(number as i64)),
        None => None,
    })
}

/// Below this an epoch number must be seconds: as milliseconds it would be 1973.
const SECONDS_BELOW: i64 = 100_000_000_000;

fn iso_from_epoch(number: i64) -> String {
    let millis = if number.abs() < SECONDS_BELOW {
        number.saturating_mul(1000)
    } else {
        number
    };
    iso_from_epoch_millis(millis)
}

/// `2021-02-03T09:47:58.901Z`, in UTC.
pub(crate) fn iso_from_epoch_millis(millis: i64) -> String {
    let seconds = millis.div_euclid(1000);
    let millis = millis.rem_euclid(1000);
    let (year, month, day) = civil_from_days(seconds.div_euclid(86_400));
    let of_day = seconds.rem_euclid(86_400);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        of_day / 3600,
        of_day % 3600 / 60,
        of_day % 60
    )
}

/// Days since 1970-01-01 to a proleptic Gregorian date (Howard Hinnant's
/// `civil_from_days`), so no date library is needed for one conversion.
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_epoch_millis_to_iso() {
        assert_eq!(iso_from_epoch_millis(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(
            iso_from_epoch_millis(1_612_345_678_901),
            "2021-02-03T09:47:58.901Z"
        );
        assert_eq!(
            iso_from_epoch_millis(951_782_400_000),
            "2000-02-29T00:00:00.000Z"
        );
        assert_eq!(iso_from_epoch_millis(-1), "1969-12-31T23:59:59.999Z");
        assert_eq!(
            iso_from_epoch_millis(1_793_621_497_000),
            "2026-11-02T12:11:37.000Z"
        );
    }

    #[derive(Deserialize)]
    struct Holder {
        #[serde(default, deserialize_with = "lenient_timestamp")]
        at: Option<String>,
    }

    fn read(json: &str) -> Option<String> {
        serde_json::from_str::<Holder>(json).unwrap().at
    }

    #[test]
    fn accepts_every_spelling() {
        assert_eq!(
            read(r#"{"at":"2019-01-04T18:42:33Z"}"#).as_deref(),
            Some("2019-01-04T18:42:33Z")
        );
        assert_eq!(
            read(r#"{"at":1612345678901}"#).as_deref(),
            Some("2021-02-03T09:47:58.901Z")
        );
        assert_eq!(
            read(r#"{"at":1612345678}"#).as_deref(),
            Some("2021-02-03T09:47:58.000Z")
        );
        assert_eq!(
            read(r#"{"at":1612345678901.0}"#).as_deref(),
            Some("2021-02-03T09:47:58.901Z")
        );
        assert_eq!(read(r#"{"at":""}"#), None);
        assert_eq!(read(r#"{"at":null}"#), None);
        assert_eq!(read("{}"), None);
    }
}
