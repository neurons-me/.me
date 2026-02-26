The .me Identity Model — Formal Specification

1. Overview

.me is a computational identity model where identity is derived, not stored.
A .me identity is defined as a function of a private secret and the environment in which it manifests.
Persistence is optional and explicitly user-controlled.

The .me model guarantees:
	•	self-sovereign identity
	•	contextual manifestation
	•	cryptographic verifiability
	•	ephemeral-by-default existence
	•	persistence only when voluntarily invoked

.me is identity as computation, not as a record.

⸻

2. Core Components

2.1 Secret

Each user possesses a private value secret that is never transmitted or stored.
secret ∈ {0,1}^n   (n ≥ 128 bits)
This is the root of all identity derivation.

⸻

2.2 Identity Root
A universal representation of the self:
identity_root = H(secret)
Where H is a cryptographic hash function (SHA-256, Blake3, etc.).
identity_root never changes as long as the user keeps the same secret.
This is the mathematical “self” that persists across all hosts.

⸻

2.3 Host

A host is any environment where the user is present:
host ∈ Strings
Examples:
"cleaker.me", "localhost", "pixelgrid.app", "192.168.0.10", "nytimes.com"
A host may or may not provide persistence (ledger).

⸻

2.4 Namespace

A host-specific computed identity:
namespace = H(secret || host)
This binds the user’s secret to a specific environment.
Each host produces a unique namespace.
Namespaces are ephemeral unless persisted.

⸻

2.5 Public Key

Derived from the secret using a key-generation function:
public_key = DerivePublic(secret)
The server uses public_key only for verification.

⸻

2.6 Identity Hash

A public identifier inside a host:
identity_hash = H(public_key || host)
This value is used by services to recognize the user within that host.
It is consistent, unique per host, and safe to expose publicly.

⸻

3. .me Identity Definition

A .me identity is a tuple:
.me = (identity_root, public_key, host, namespace, identity_hash)
Each tuple represents a manifestation of the same person inside a specific host.

⸻

4. Ephemeral vs. Persistent Identity

4.1 Ephemeral .me
The natural mode.
Occurs when the host does not provide a ledger.
	•	.me is computed in real time
	•	exists only during the session
	•	leaves no stored trace
	•	proves identity through signatures
	•	no history, no memory

This is “presence without permanence.”

⸻

4.2 Persistent .me
Occurs when the host provides a ledger (e.g., Cleaker).
The same .me tuple may be stored:
INSERT INTO me (username, identity_root, public_key, host, namespace, identity_hash);
Persistence happens only when the user explicitly requests it, via:
cleak(payload)
Persistence adds:
	•	history
	•	version control
	•	state commits
	•	long-term identity continuity

This is “presence that chooses to remain.”

⸻

5. Signature & Verification Model

The user proves control of a .me identity by signing challenges:
signature = Sign(secret, nonce)
Verify(public_key, nonce, signature) → true/false

This allows .me authentication without revealing the secret.

⸻

6. Username Binding
A username is a human-readable label, not a cryptographic identity.

Binding:
(username, host) → me

Usernames are unique per host, not globally.
Identity continuity is derived from identity_root, not usernames.

⸻

7. Ledger Integration
Persistent .me identities may include:

state_commit_hash = last ledger commit for this manifestation
A ledger host stores:
	•	states
	•	documents
	•	transactions
	•	agreements
	•	signatures
	•	hashes
	•	historical timeline

Only when the user chooses to cleak.

Ledger is optional.
Cleaker is the canonical reference implementation.

⸻

8. Wallet Capability
.me can derive deterministic wallet keys:

wallet_root = H(secret || "wallet")
wallet(chain) = Derive(secret, chain)

Supports:
	•	cryptocurrency addresses
	•	document signing
	•	contract hashing
	•	financial agreements
	•	proof of integrity

Wallets are capabilities of .me, not separate identities.

⸻

9. Security Properties
	•	No secret stored or transmitted
	•	All identity values are hash-derived
	•	Signatures prove ownership without revelation
	•	Per-host separation prevents unwanted correlation
	•	Persistence is opt-in only
	•	Identity continuity relies on secret, not external systems

⸻

10. Philosophy

.me embraces:
	•	existence in the present
	•	intentional memory
	•	local computation
	•	universal verification
	•	human sovereignty
	•	machine minimalism

Identity should belong to the user, not to the system.

⸻

11. Summary
Calculating .me is identity as a function,
not a record.
	•	Ephemeral by default
	•	Persistent by choice
	•	Contextual per host
	•	Unified by secret
	•	Verifiable cryptographically
	•	Freed from corporate storage
	•	Designed to empower
	•	Built on simple, elegant math

This is the new model of digital selfhood.