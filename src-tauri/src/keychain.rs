//! The session token's only home: the OS keychain (Keychain on macOS,
//! Credential Manager on Windows, the Secret Service on Linux). Never a file,
//! never a log line.
//!
//! Every call runs on a blocking thread: on macOS the keychain may stop to ask
//! the person for permission, and that must not freeze the window.

use soundcloud::Token;

use crate::error::{CommandError, CommandResult};

/// The app's bundle identifier, so the entry is easy to find in Keychain Access.
const SERVICE: &str = "io.github.solarka892.cloudify";
const ACCOUNT: &str = "soundcloud";

/// The stored token, if there is one. A stored value that cannot be a token
/// (damaged, edited by hand) counts as none.
pub async fn load() -> CommandResult<Option<Token>> {
    blocking(|| match entry()?.get_password() {
        Ok(value) => Ok(Token::new(&value).ok()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(refused(&error)),
    })
    .await
}

pub async fn save(token: &Token) -> CommandResult<()> {
    let value = token.expose().to_owned();
    blocking(move || {
        entry()?
            .set_password(&value)
            .map_err(|error| refused(&error))
    })
    .await
}

/// Deletes the stored token; nothing stored is not an error.
pub async fn forget() -> CommandResult<()> {
    blocking(|| match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(refused(&error)),
    })
    .await
}

fn entry() -> CommandResult<keyring::Entry> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|error| refused(&error))
}

/// Keychain errors describe the platform's refusal, never the secret.
fn refused(error: &keyring::Error) -> CommandError {
    CommandError::Keychain(error.to_string())
}

async fn blocking<T, F>(work: F) -> CommandResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> CommandResult<T> + Send + 'static,
{
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|_| CommandError::Keychain("the keychain task stopped".into()))?
}
