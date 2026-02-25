use thiserror::Error;

#[derive(Error, Debug)]
pub enum AgentAuthError {
    #[error("HTTP error {status}: {message}")]
    Http {
        status: u16,
        message: String,
        error_type: Option<String>,
    },

    #[error("Request failed: {0}")]
    Request(#[from] reqwest::Error),

    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Timeout after {0}ms")]
    Timeout(u64),

    #[error("{0}")]
    Other(String),
}
