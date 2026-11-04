//! The listening diary's file, open for the whole run.
//!
//! It lives in the app's data folder (`diary.sqlite3`) and nowhere else. If it
//! cannot be opened, the app still plays: the diary's commands say why, and
//! nothing else is touched.

use std::path::Path;
use std::sync::{Arc, Mutex, PoisonError};

use diary::{Diary, Now};

use crate::error::{CommandError, CommandResult};

/// The file's name inside the app's data folder.
pub const FILE: &str = "diary.sqlite3";

pub struct DiaryState(Result<Arc<Mutex<Diary>>, String>);

impl DiaryState {
    /// Opens the diary, closes the plays a quit left open and lets go of
    /// those older than it keeps.
    pub fn open(path: &Path) -> Self {
        let opened = Diary::open(path).and_then(|mut diary| {
            diary.recover()?;
            diary.prune(Now::system().utc_ms)?;
            Ok(diary)
        });
        match opened {
            Ok(diary) => Self(Ok(Arc::new(Mutex::new(diary)))),
            Err(error) => {
                eprintln!("cloudify: the listening diary did not open: {error}");
                Self(Err(error.to_string()))
            }
        }
    }

    /// No diary this run, and why.
    pub fn unavailable(reason: impl Into<String>) -> Self {
        Self(Err(reason.into()))
    }

    /// Runs `job` on the diary on a blocking thread: the file is quick, but
    /// it is still a disk, and the async threads serve SoundCloud.
    pub async fn with<T, F>(&self, job: F) -> CommandResult<T>
    where
        T: Send + 'static,
        F: FnOnce(&mut Diary) -> diary::Result<T> + Send + 'static,
    {
        let diary = self.0.clone().map_err(CommandError::Storage)?;
        tokio::task::spawn_blocking(move || {
            // A job that panicked left the connection as it was: carry on with it.
            let mut diary = diary.lock().unwrap_or_else(PoisonError::into_inner);
            job(&mut diary).map_err(|error| CommandError::Storage(error.to_string()))
        })
        .await
        .map_err(|_| CommandError::Storage("the diary's task stopped".into()))?
    }
}
