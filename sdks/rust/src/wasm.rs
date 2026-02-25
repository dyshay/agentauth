use crate::crypto::hmac_sha256_hex;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn wasm_hmac_sha256_hex(message: &str, secret: &str) -> String {
    hmac_sha256_hex(message, secret)
}

#[wasm_bindgen]
pub struct WasmAgentAuthClient {
    base_url: String,
    api_key: Option<String>,
}

#[wasm_bindgen]
impl WasmAgentAuthClient {
    #[wasm_bindgen(constructor)]
    pub fn new(base_url: &str, api_key: Option<String>) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key,
        }
    }

    #[wasm_bindgen(js_name = "initChallenge")]
    pub async fn init_challenge(&self, difficulty: Option<String>) -> Result<JsValue, JsError> {
        let url = format!("{}/v1/challenge/init", self.base_url);
        let body = serde_json::json!({
            "difficulty": difficulty.unwrap_or_else(|| "medium".to_string()),
        });

        let client = reqwest::Client::new();
        let mut req = client
            .post(&url)
            .header("Content-Type", "application/json")
            .body(body.to_string());

        if let Some(ref key) = self.api_key {
            req = req.header("X-API-Key", key);
        }

        let resp = req.send().await.map_err(|e| JsError::new(&e.to_string()))?;
        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| JsError::new(&e.to_string()))?;
        serde_wasm_bindgen::to_value(&json).map_err(|e| JsError::new(&e.to_string()))
    }

    #[wasm_bindgen(js_name = "computeHmac")]
    pub fn compute_hmac(&self, answer: &str, session_token: &str) -> String {
        hmac_sha256_hex(answer, session_token)
    }
}
