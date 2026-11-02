//! `tag_list`: one string, space-separated, multi-word tags in double quotes —
//! `house "deep house" techno`.

/// Splits a `tag_list` into tags, in order, without duplicates.
pub(crate) fn parse_tags(list: &str) -> Vec<String> {
    let mut tags: Vec<String> = Vec::new();
    let mut rest = list;
    loop {
        rest = rest.trim_start();
        if rest.is_empty() {
            break;
        }
        let (tag, after) = match rest.strip_prefix('"') {
            // An unclosed quote runs to the end, as the website reads it.
            Some(quoted) => quoted.split_once('"').unwrap_or((quoted, "")),
            None => rest.split_once(char::is_whitespace).unwrap_or((rest, "")),
        };
        rest = after;
        let tag = tag.trim();
        if tag.is_empty() || is_machine_tag(tag) || tags.iter().any(|seen| seen == tag) {
            continue;
        }
        tags.push(tag.to_owned());
    }
    tags
}

/// `soundcloud:source=web-record`, `geo:lat=52.5` — metadata stored as tags
/// by old uploaders, not words anyone typed.
fn is_machine_tag(tag: &str) -> bool {
    let identifier = |text: &str| {
        !text.is_empty()
            && text
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    };
    tag.split_once(':')
        .and_then(|(namespace, rest)| Some((namespace, rest.split_once('=')?.0)))
        .is_some_and(|(namespace, key)| identifier(namespace) && identifier(key))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_words_and_quoted_phrases() {
        assert_eq!(
            parse_tags(r#"house "deep house" techno"#),
            ["house", "deep house", "techno"]
        );
    }

    #[test]
    fn tolerates_messy_spacing_and_quotes() {
        assert_eq!(
            parse_tags("  lo-fi\t\tchill \n beats "),
            ["lo-fi", "chill", "beats"]
        );
        assert_eq!(parse_tags(r#""" "  " ambient"#), ["ambient"]);
        assert_eq!(
            parse_tags(r#"jazz "unclosed phrase"#),
            ["jazz", "unclosed phrase"]
        );
        assert_eq!(
            parse_tags(r#""Hip-hop & Rap"rap"#),
            ["Hip-hop & Rap", "rap"]
        );
        assert_eq!(parse_tags(""), Vec::<String>::new());
    }

    #[test]
    fn drops_duplicates_and_machine_tags() {
        assert_eq!(
            parse_tags(r#"rock soundcloud:source=web-record "rock" geo:lat=52.5 time:12:30 rock"#),
            ["rock", "time:12:30"]
        );
    }

    #[test]
    fn keeps_unicode() {
        assert_eq!(
            parse_tags(r#"рэп "русский рэп" 日本"#),
            ["рэп", "русский рэп", "日本"]
        );
    }
}
