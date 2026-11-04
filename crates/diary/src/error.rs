//! What can go wrong with the diary's file.

/// The diary could not be read or written.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("the diary's database: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("the diary's folder: {0}")]
    Io(#[from] std::io::Error),
    #[error("a value in the diary: {0}")]
    Json(#[from] serde_json::Error),
    /// A newer Cloudify wrote the file; this one leaves it alone.
    #[error("the diary was written by a newer Cloudify (schema {0})")]
    Newer(i32),
    /// Something the app should never ask for (a broken cursor, keeping for 0 days).
    #[error("{0}")]
    Invalid(String),
}

pub type Result<T> = std::result::Result<T, Error>;
