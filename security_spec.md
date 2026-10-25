# Security Specification — AgriPulse Command (Smart Precision Agriculture & Task Collaboration)

## 1. Data Invariants

1. **Global Default Deny**: Any path not explicitly matched is strictly denied (`allow read, write: if false;`).
2. **Verified Identity**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Split Isolation**: User PII (`email`, `phone`) is stored exclusively under `/users/{userId}/private/{infoId}` and is readable/writable only by `request.auth.uid == userId` or `isAdmin()`. Public collaborator profiles live in `/users/{userId}/public/{profileId}`.
4. **Relational Integrity (Master Gate)**:
   - A `Field` document (`/fields/{fieldId}`) can only be created if `/farms/$(incoming().farmId)` exists and belongs to `request.auth.uid`.
   - A `Task` document (`/tasks/{taskId}`) can only be created if `/farms/$(incoming().farmId)` and `/fields/$(incoming().fieldId)` exist.
   - A `TaskComment` subcollection document (`/tasks/{taskId}/comments/{commentId}`) requires `get(/databases/$(database)/documents/tasks/$(taskId))` to verify the parent task exists and the user is either the task owner or assignee (`ownerId == request.auth.uid || assigneeId == request.auth.uid`).
5. **Terminal State Locking**: Once a `Task` reaches `status == 'completed'`, non-admin and non-owner users cannot mutate it further; even owners must use explicit action branches with `affectedKeys().hasOnly(...)`.
6. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on `create` and remain immutable (`incoming().createdAt == existing().createdAt`) on `update`. `updatedAt` must equal `request.time` on `create` and `update`. `ownerId` is strictly immutable.
7. **Query Enforcer (Cost-Optimized `allow list`)**: No `allow list` block delegates filtering to the client or calls `get()`/`exists()`. Every `allow list` validates `resource.data` against `request.auth.uid`.

---

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection on Task Create**:
   ```json
   {
     "ownerId": "user_1",
     "farmId": "farm_1",
     "fieldId": "field_1",
     "title": "Check Soil Moisture",
     "description": "Inspect probe ESP32-001",
     "category": "irrigation",
     "priority": "high",
     "status": "todo",
     "assigneeName": "Ravi Kumar",
     "assigneeId": "user_2",
     "dueDate": "2026-10-26",
     "isVerifiedAdmin": true
   }
   ```
   *Rejected by*: `data.keys().hasOnly(...)` in `isValidTask`.

2. **Identity Spoofing on Farm Create**:
   ```json
   {
     "ownerId": "victim_uid_999",
     "name": "Spoofed Farm",
     "district": "Lucknow",
     "state": "Uttar Pradesh",
     "soilType": "loamy",
     "areaHectares": 2.5
   }
   ```
   *Rejected by*: `data.ownerId == request.auth.uid`.

3. **Unverified Email Spoof Attack**:
   `auth: { uid: "attacker_1", token: { email: "vipsp1414@gmail.com", email_verified: false } }`
   *Rejected by*: `isVerifiedUser()` checking `request.auth.token.email_verified == true`.

4. **PII Lateral Read on `/users/victim_uid/private/info`**:
   `auth: { uid: "other_user", token: { email_verified: true } }` performing `get`.
   *Rejected by*: `isOwner(userId) || isAdmin()`.

5. **Denial-of-Wallet 2KB Path ID Poisoning**:
   Path: `/tasks/` + `"A".repeat(2048)`
   *Rejected by*: `isValidId(taskId)` (`id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).

6. **Orphaned Field Creation (Non-existent Farm)**:
   ```json
   {
     "ownerId": "user_1",
     "farmId": "non_existent_farm_99",
     "name": "Parcel B",
     "crop": "Wheat",
     "variety": "HD-2967",
     "sowingDate": "2026-10-01",
     "growthStage": "tillering",
     "areaHectares": 1.2,
     "moistureThreshold": 24
   }
   ```
   *Rejected by*: `exists(/databases/$(database)/documents/farms/$(incoming().farmId))`.

7. **Tier-2 Assignee Privilege Escalation (Modifying Task Title/Owner)**:
   Assignee attempts to update `title` and `ownerId` instead of `status` and `updatedAt`.
   *Rejected by*: Tier 2 branch `incoming().diff(existing()).affectedKeys().hasOnly(['status', 'updatedAt'])` + `incoming().ownerId == existing().ownerId`.

8. **Terminal State Re-opening by Assignee**:
   Task has `existing().status == 'completed'`. Assignee attempts to change `status` back to `'in_progress'`.
   *Rejected by*: Terminal state gate `existing().status != 'completed'`.

9. **Value Poisoning on Whitelisted Update Key**:
   Owner updates `title` with a 10,000-character string or numeric `12345`.
   *Rejected by*: `isValidTask(incoming())` wrapping the entire `allow update` block.

10. **Client-Forged Timestamp Manipulation**:
    Client passes `createdAt: Timestamp.fromMillis(1500000000000)` in the past.
    *Rejected by*: `incoming().createdAt == request.time`.

11. **Unauthorized Subcollection Comment by Non-Member**:
    User who is neither `ownerId` nor `assigneeId` of `/tasks/{taskId}` attempts to create `/tasks/{taskId}/comments/{commentId}`.
    *Rejected by*: Master Gate `get(/databases/$(database)/documents/tasks/$(taskId))` checking membership.

12. **Blanket List Query Scraping on `/tasks`**:
    Authenticated user queries `collection(db, 'tasks')` without filtering by `ownerId` or `assigneeId`.
    *Rejected by*: `allow list: if isSignedIn() && (resource.data.ownerId == request.auth.uid || resource.data.assigneeId == request.auth.uid);`.
