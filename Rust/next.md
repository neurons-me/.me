# NEXT STEPS — Multi-Key Support in `this.me`

## 🧠 Goal
Enable `this.me` identities to hold multiple cryptographic keys, allowing each identity to:
- Maintain a master keypair
- Support additional keys for different authorities (e.g. Cleaker, 3rd-party networks)
- Select keys dynamically when signing or verifying actions

---

## 🧱 Design

```json
{
  "username": "jabellae",
  "keys": {
    "main": {
      "publicKey": "...",
      "privateKey": "..." // encrypted
    },
    "cleaker": {
      "publicKey": "...",
      "privateKey": "..." // encrypted
    },
    "networkX": {
      "publicKey": "...",
      "privateKey": "..." // encrypted
    }
  }
}
```

---

## 🔧 Functions to Implement

- `add_key(authority: &str, keypair: KeyPair)`
- `sign_with(authority: &str, message: &[u8]) -> Result<Signature>`
- `get_public_key(authority: Option<&str>) -> Result<String>`
- `list_keys() -> Vec<String>`

---

## 🛡 Rules

- `main` key is required for identity initialization and cannot be deleted.
- All private keys must be encrypted with the user’s password/hash.
- Signing defaults to `main` unless specified.

---

## 🧪 CLI Ideas

```bash
me key add cleaker
me key list
me sign --with cleaker message.txt
me verify --with cleaker message.txt.signature
```

---

## ❓Open Questions

- Should keys include metadata (creation time, last used)?
- Do we allow export/import of individual keys?
- Should signatures be logged in the .me file?

---

## ✅ Why This Matters

This makes `this.me` capable of interacting across different trust networks (e.g. Cleaker, blockchain nodes, federated authorities) without compromising security or user control.
