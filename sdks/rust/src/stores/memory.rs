use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;

use crate::types::{ChallengeData, ChallengeStore};

struct Entry {
    data: ChallengeData,
    expires_at_ms: u64,
}

/// In-memory challenge store for development and testing.
pub struct MemoryStore {
    entries: Mutex<HashMap<String, Entry>>,
}

impl MemoryStore {
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
        }
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

impl Default for MemoryStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ChallengeStore for MemoryStore {
    async fn set(&self, id: &str, data: ChallengeData, ttl_seconds: u64) -> Result<(), String> {
        let expires_at_ms = Self::now_ms() + ttl_seconds * 1000;
        self.entries
            .lock()
            .unwrap()
            .insert(id.to_string(), Entry { data, expires_at_ms });
        Ok(())
    }

    async fn get(&self, id: &str) -> Result<Option<ChallengeData>, String> {
        let entries = self.entries.lock().unwrap();
        match entries.get(id) {
            Some(entry) if entry.expires_at_ms > Self::now_ms() => Ok(Some(entry.data.clone())),
            _ => Ok(None),
        }
    }

    async fn delete(&self, id: &str) -> Result<(), String> {
        self.entries.lock().unwrap().remove(id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ChallengeInner, ChallengePayload, Difficulty};

    fn test_challenge_data() -> ChallengeData {
        ChallengeData {
            challenge: ChallengeInner {
                id: "ch_test".into(),
                session_token: "st_test".into(),
                payload: ChallengePayload {
                    challenge_type: "test".into(),
                    instructions: "test instructions".into(),
                    data: "dGVzdA==".into(),
                    steps: 1,
                    context: None,
                },
                difficulty: Difficulty::Medium,
                dimensions: vec![],
                created_at: 1000,
                expires_at: 2000,
            },
            answer_hash: "abc123".into(),
            attempts: 0,
            max_attempts: 3,
            created_at: 1000,
            created_at_server_ms: 1000000,
            injected_canaries: None,
        }
    }

    #[tokio::test]
    async fn test_set_and_get() {
        let store = MemoryStore::new();
        let data = test_challenge_data();
        store.set("id1", data.clone(), 60).await.unwrap();

        let result = store.get("id1").await.unwrap();
        assert!(result.is_some());
        let got = result.unwrap();
        assert_eq!(got.challenge.id, "ch_test");
        assert_eq!(got.answer_hash, "abc123");
    }

    #[tokio::test]
    async fn test_ttl_expiry() {
        let store = MemoryStore::new();
        let data = test_challenge_data();
        // TTL of 0 seconds means already expired
        store.set("id2", data, 0).await.unwrap();

        // Small delay to ensure expiry
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;

        let result = store.get("id2").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_missing() {
        let store = MemoryStore::new();
        let result = store.get("nonexistent").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete() {
        let store = MemoryStore::new();
        let data = test_challenge_data();
        store.set("id3", data, 60).await.unwrap();
        store.delete("id3").await.unwrap();

        let result = store.get("id3").await.unwrap();
        assert!(result.is_none());
    }
}
