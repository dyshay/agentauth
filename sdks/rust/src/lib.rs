pub mod client;
pub mod crypto;
pub mod error;
pub mod guard;
pub mod middleware;
pub mod token;
pub mod types;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

pub use client::AgentAuthClient;
pub use error::AgentAuthError;
pub use guard::{GuardConfig, GuardError, GuardResult};
pub use token::{AgentAuthClaims, TokenError, TokenVerifier};
pub use types::*;
