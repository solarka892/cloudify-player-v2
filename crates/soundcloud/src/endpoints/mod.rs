//! The routes, one module per area of the app. Each adds methods to
//! [`Client`]; the routes and their quirks are in `docs/soundcloud-api.md`.

mod discovery;
mod me;
mod playlists;
mod resolve;
pub(crate) mod search;
mod stream;
mod tracks;
mod users;
mod writes;

use serde::de::DeserializeOwned;

use crate::client::Client;
use crate::error::Result;
use crate::http::Kind;
use crate::paging::{Cursor, Page, PageRequest, clamp_limit};
use crate::raw;

impl Client {
    /// One page of a cursor-paged list at `path`: the first page with
    /// `linked_partitioning=1&limit=…` (plus `extra`), or wherever the
    /// request's cursor points.
    async fn page<R, T>(
        &self,
        path: &str,
        extra: &[(&str, &str)],
        request: PageRequest,
        kind: Kind,
        convert: impl FnMut(R) -> Option<T>,
    ) -> Result<Page<T>>
    where
        R: DeserializeOwned,
    {
        let url = match request.cursor {
            Some(cursor) => cursor.to_url(&self.inner.api_base)?,
            None => {
                let limit = clamp_limit(request.limit).to_string();
                let mut query = vec![("linked_partitioning", "1"), ("limit", limit.as_str())];
                query.extend_from_slice(extra);
                self.api_url(path, &query)
            }
        };
        let raw: raw::Collection<R> = self.get_json(url, kind).await?;
        Ok(self.finish_page(raw, convert))
    }

    fn finish_page<R, T>(
        &self,
        raw: raw::Collection<R>,
        convert: impl FnMut(R) -> Option<T>,
    ) -> Page<T> {
        let raw_items = raw.collection.0;
        // An empty page ends the list whatever `next_href` says, so a reader
        // following cursors can never loop forever.
        let next = if raw_items.is_empty() {
            None
        } else {
            raw.next_href
                .as_deref()
                .and_then(|href| Cursor::from_next_href(href, &self.inner.api_base))
        };
        Page {
            items: raw_items.into_iter().filter_map(convert).collect(),
            next,
        }
    }
}
