//! What every command shares.

use soundcloud::Client;
use tokio::sync::OnceCell;

use crate::keychain;

pub struct AppState {
    client: Client,
    /// The keychain is read once per run, by whichever command needs the
    /// client first: asking it on every call would make macOS prompt again
    /// and again for unsigned builds.
    token_read: OnceCell<()>,
}

impl AppState {
    pub fn new() -> soundcloud::Result<Self> {
        Ok(Self {
            client: Client::new()?,
            token_read: OnceCell::new(),
        })
    }

    /// The client, signed in with the stored token if there is one.
    pub async fn client(&self) -> &Client {
        self.token_read
            .get_or_init(|| async {
                match keychain::load().await {
                    Ok(Some(token)) => self.client.set_token(token),
                    Ok(None) => {}
                    // Not fatal: the person can sign in again; nothing about the token is printed.
                    Err(error) => eprintln!("cloudify: could not read the saved sign-in: {error}"),
                }
            })
            .await;
        &self.client
    }

    /// The client without touching the keychain, for start-up work that
    /// needs no session (looking up the `client_id`).
    pub fn client_unsigned(&self) -> Client {
        self.client.clone()
    }
}
