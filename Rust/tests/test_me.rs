use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::env;

use crate::utils::file_me::{encrypt_data, decrypt_data, load_and_decrypt_identity, save_identity};
use crate::identity::Identity;

pub struct Me {
    pub username: String,
    pub file_path: PathBuf,
}

impl Me {
    pub fn new(username: &str) -> Self {
        let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push(".this");
        path.push("me");
        path.push(username);
        Me {
            username: username.to_string(),
            file_path: path,
        }
    }

    pub fn create(username: &str, hash: &str) -> Result<(), Box<dyn std::error::Error>> {
        let me = Me::new(username);
        if me.file_path.exists() {
            return Err("User already exists".into());
        }
        let identity = Identity::new(username);
        save_identity(&me.file_path, &identity, hash)?;
        Ok(())
    }

    pub fn unlock(&self, hash: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
        load_and_decrypt_identity(&self.file_path, hash)
    }

    pub fn be(&mut self, key: &str, value: &str, hash: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut identity = load_and_decrypt_identity(&self.file_path, hash)?.ok_or("Failed to unlock")?;
        let mut identity_obj: Identity = serde_json::from_str(&identity)?;
        identity_obj.be(key, value);
        let updated = serde_json::to_string(&identity_obj)?;
        save_identity(&self.file_path, &updated, hash)?;
        Ok(())
    }

    pub fn have(&mut self, key: &str, value: &str, hash: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut identity = load_and_decrypt_identity(&self.file_path, hash)?.ok_or("Failed to unlock")?;
        let mut identity_obj: Identity = serde_json::from_str(&identity)?;
        identity_obj.have(key, value);
        let updated = serde_json::to_string(&identity_obj)?;
        save_identity(&self.file_path, &updated, hash)?;
        Ok(())
    }

    pub fn relate(&mut self, to: &str, relation: &str, hash: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut identity = load_and_decrypt_identity(&self.file_path, hash)?.ok_or("Failed to unlock")?;
        let mut identity_obj: Identity = serde_json::from_str(&identity)?;
        identity_obj.relate(to, relation);
        let updated = serde_json::to_string(&identity_obj)?;
        save_identity(&self.file_path, &updated, hash)?;
        Ok(())
    }

    pub fn react(&mut self, key: &str, value: &str, hash: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut identity = load_and_decrypt_identity(&self.file_path, hash)?.ok_or("Failed to unlock")?;
        let mut identity_obj: Identity = serde_json::from_str(&identity)?;
        identity_obj.react(key, value);
        let updated = serde_json::to_string(&identity_obj)?;
        save_identity(&self.file_path, &updated, hash)?;
        Ok(())
    }

    pub fn say(&mut self, key: &str, value: &str, hash: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut identity = load_and_decrypt_identity(&self.file_path, hash)?.ok_or("Failed to unlock")?;
        let mut identity_obj: Identity = serde_json::from_str(&identity)?;
        identity_obj.say(key, value);
        let updated = serde_json::to_string(&identity_obj)?;
        save_identity(&self.file_path, &updated, hash)?;
        Ok(())
    }

    pub fn at(&mut self, key: &str, value: &str, hash: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut identity = load_and_decrypt_identity(&self.file_path, hash)?.ok_or("Failed to unlock")?;
        let mut identity_obj: Identity = serde_json::from_str(&identity)?;
        identity_obj.at(key, value);
        let updated = serde_json::to_string(&identity_obj)?;
        save_identity(&self.file_path, &updated, hash)?;
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_me_create_file_exists() {
        let username = "testuser";
        let hash = "testhash";

        // Remove existing file if test was previously run
        let path = dirs::home_dir()
            .unwrap()
            .join(".this/me")
            .join(username);
        if path.exists() {
            fs::remove_file(&path).unwrap();
        }

        // Attempt creation
        let result = Me::create(username, hash);
        assert!(result.is_ok());
        assert!(path.exists());

        // Cleanup after test
        fs::remove_file(&path).unwrap();
    }
}