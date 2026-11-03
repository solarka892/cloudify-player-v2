//! Signing in and out. Twins: `src/api/session.ts`.

use serde::Serialize;
use soundcloud::{ErrorKind, Me, Token};
use tauri::{AppHandle, State};

use crate::error::CommandResult;
use crate::keychain;
use crate::signin;
use crate::state::AppState;

/// Who is signed in. Mirrored by `SessionState` in `src/api/types.ts`.
#[derive(Debug, Serialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum SessionState {
    SignedOut,
    /// SoundCloud stopped accepting the stored token; it has been forgotten.
    Expired,
    SignedIn {
        me: Box<Me>,
    },
}

/// Checks the stored session with SoundCloud. A refused token is forgotten
/// and reported as expired; anything else (no network, rate limit) is an
/// error and the token stays — being offline is not being signed out.
#[tauri::command]
pub async fn session(state: State<'_, AppState>) -> CommandResult<SessionState> {
    let client = state.client().await;
    if !client.is_signed_in() {
        return Ok(SessionState::SignedOut);
    }
    match client.me().await {
        Ok(me) => Ok(SessionState::SignedIn { me: Box::new(me) }),
        Err(error) if error.kind() == ErrorKind::Unauthorized => {
            client.clear_token();
            keychain::forget().await?;
            Ok(SessionState::Expired)
        }
        Err(error) => Err(error.into()),
    }
}

/// Opens SoundCloud's sign-in page in its own window and waits for the
/// session; `None` when the window was closed first.
#[tauri::command]
pub async fn sign_in_with_window(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CommandResult<Option<Me>> {
    let client = state.client().await;
    signin::open(&app)?;
    signin::wait(&app, client).await
}

/// The fallback: a token copied from soundcloud.com by hand. Stored only once
/// SoundCloud has accepted it.
#[tauri::command]
pub async fn sign_in_with_token(token: String, state: State<'_, AppState>) -> CommandResult<Me> {
    let token = Token::new(&token)?;
    let client = state.client().await;
    client.set_token(token.clone());
    let me = match client.me().await {
        Ok(me) => me,
        Err(error) => {
            client.clear_token();
            return Err(error.into());
        }
    };
    if let Err(error) = keychain::save(&token).await {
        client.clear_token();
        return Err(error);
    }
    Ok(me)
}

/// Signs out here. SoundCloud has no route to revoke the token, so the
/// website stays signed in wherever else it is.
#[tauri::command]
pub async fn sign_out(state: State<'_, AppState>) -> CommandResult<()> {
    state.client().await.clear_token();
    keychain::forget().await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn states_are_tagged_for_the_frontend() {
        assert_eq!(
            serde_json::to_value(SessionState::SignedOut).unwrap(),
            json!({ "state": "signed-out" })
        );
        assert_eq!(
            serde_json::to_value(SessionState::Expired).unwrap(),
            json!({ "state": "expired" })
        );
        let me: Me = serde_json::from_value(json!({
            "user": {
                "id": 1, "urn": "soundcloud:users:1", "username": "solarka", "fullName": null,
                "permalinkUrl": null, "avatarUrl": null, "bannerUrl": null, "description": null,
                "city": null, "countryCode": null, "followersCount": null, "followingsCount": null,
                "trackCount": null, "playlistCount": 24, "likesCount": 1312, "verified": false
            },
            "plan": "free"
        }))
        .unwrap();
        let signed_in = serde_json::to_value(SessionState::SignedIn { me: Box::new(me) }).unwrap();
        assert_eq!(signed_in["state"], "signed-in");
        assert_eq!(signed_in["me"]["user"]["likesCount"], 1312);
        assert_eq!(signed_in["me"]["plan"], "free");
    }
}
