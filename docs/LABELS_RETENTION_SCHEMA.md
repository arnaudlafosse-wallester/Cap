# Video Labels & Retention System - Database Schema

## Overview

This document describes the database schema for implementing video labels with automatic retention policies in Wallester Record (Cap.so self-hosted).

## New Tables

### 1. `video_labels` - Label Definitions

```sql
CREATE TABLE video_labels (
  id VARCHAR(21) NOT NULL PRIMARY KEY,
  organization_id VARCHAR(21) NOT NULL,

  -- Label info
  name VARCHAR(100) NOT NULL,              -- e.g., "TUTORIAL", "QUICK_ANSWER"
  display_name VARCHAR(100) NOT NULL,      -- e.g., "Tutorial", "Quick Answer"
  description VARCHAR(500),                -- e.g., "Réponse rapide à un collègue"
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280', -- Hex color for UI badge
  icon VARCHAR(50),                        -- FontAwesome icon name (optional)

  -- Category
  category ENUM('content_type', 'department') NOT NULL DEFAULT 'content_type',

  -- Retention policy
  retention_days INT DEFAULT NULL,         -- NULL = permanent, otherwise days until auto-delete

  -- RAG eligibility
  rag_default ENUM('eligible', 'excluded', 'pending') DEFAULT 'pending',

  -- System flags
  is_system BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = predefined, FALSE = custom
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  INDEX org_idx (organization_id),
  INDEX category_idx (category),
  UNIQUE KEY org_name_unique (organization_id, name)
);
```

### 2. `video_label_assignments` - Video-Label Junction

```sql
CREATE TABLE video_label_assignments (
  id VARCHAR(21) NOT NULL PRIMARY KEY,
  video_id VARCHAR(21) NOT NULL,
  label_id VARCHAR(21) NOT NULL,

  -- Who assigned
  assigned_by_id VARCHAR(21) NOT NULL,     -- User who assigned the label
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- AI suggestion tracking
  is_ai_suggested BOOLEAN NOT NULL DEFAULT FALSE,
  ai_confidence FLOAT,                     -- 0.0 to 1.0 confidence score

  -- Indexes
  INDEX video_idx (video_id),
  INDEX label_idx (label_id),
  UNIQUE KEY video_label_unique (video_id, label_id)
);
```

### 3. Modifications to `videos` table

```sql
ALTER TABLE videos ADD COLUMN (
  -- RAG eligibility override (per-video)
  rag_status ENUM('eligible', 'excluded', 'pending') DEFAULT 'pending',
  rag_status_updated_at TIMESTAMP,
  rag_status_updated_by VARCHAR(21),

  -- Retention override
  keep_permanently BOOLEAN NOT NULL DEFAULT FALSE,  -- Override label retention
  expires_at TIMESTAMP,                             -- Computed from labels, NULL = never

  -- AI classification results
  ai_suggested_labels JSON,                         -- [{label_id, confidence}]
  ai_classified_at TIMESTAMP
);

-- Index for retention cron job
CREATE INDEX expires_at_idx ON videos (expires_at);
CREATE INDEX rag_status_idx ON videos (rag_status);
```

---

## Predefined Labels (System)

### Content Type Labels

| Name | Display | Retention | RAG Default | Color |
|------|---------|-----------|-------------|-------|
| `TUTORIAL` | Tutorial | NULL (permanent) | eligible | #10B981 (green) |
| `ONBOARDING` | Onboarding | NULL (permanent) | eligible | #10B981 (green) |
| `PROCESS` | Process | NULL (permanent) | eligible | #10B981 (green) |
| `DEMO` | Demo | NULL (permanent) | eligible | #3B82F6 (blue) |
| `TROUBLESHOOTING` | Troubleshooting | 14 days | pending | #F59E0B (amber) |
| `QUICK_ANSWER` | Quick Answer | 14 days | excluded | #EF4444 (red) |
| `MEETING_RECORDING` | Meeting Recording | 30 days | pending | #8B5CF6 (purple) |
| `CLIENT_CALL` | Client Call | 30 days | pending | #EC4899 (pink) |
| `ANNOUNCEMENT` | Announcement | 90 days | pending | #6366F1 (indigo) |

### Department Labels

| Name | Display | Retention | RAG Default | Color |
|------|---------|-----------|-------------|-------|
| `SALES` | Sales | NULL | pending | #3B82F6 |
| `TECH` | Tech | NULL | pending | #10B981 |
| `PRODUCT` | Product | NULL | pending | #8B5CF6 |
| `COMPLIANCE` | Compliance | NULL | pending | #F59E0B |
| `FINANCE` | Finance | NULL | pending | #6366F1 |
| `HR` | HR | NULL | pending | #EC4899 |
| `SUPPORT` | Support | NULL | pending | #14B8A6 |
| `MARKETING` | Marketing | NULL | pending | #F97316 |

---

## Drizzle Schema (TypeScript)

```typescript
// packages/database/schema.ts

export const videoLabels = mysqlTable(
  "video_labels",
  {
    id: nanoId("id").notNull().primaryKey(),
    organizationId: nanoId("organizationId").notNull().$type<Organisation.OrganisationId>(),

    // Label info
    name: varchar("name", { length: 100 }).notNull(),
    displayName: varchar("displayName", { length: 100 }).notNull(),
    description: varchar("description", { length: 500 }),
    color: varchar("color", { length: 7 }).notNull().default("#6B7280"),
    icon: varchar("icon", { length: 50 }),

    // Category
    category: varchar("category", {
      length: 20,
      enum: ["content_type", "department"]
    }).notNull().default("content_type"),

    // Retention policy
    retentionDays: int("retentionDays"), // NULL = permanent

    // RAG eligibility
    ragDefault: varchar("ragDefault", {
      length: 10,
      enum: ["eligible", "excluded", "pending"]
    }).default("pending"),

    // System flags
    isSystem: boolean("isSystem").notNull().default(false),
    isActive: boolean("isActive").notNull().default(true),

    // Timestamps
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    orgIdx: index("org_idx").on(table.organizationId),
    categoryIdx: index("category_idx").on(table.category),
    orgNameUnique: unique("org_name_unique").on(table.organizationId, table.name),
  }),
);

export const videoLabelAssignments = mysqlTable(
  "video_label_assignments",
  {
    id: nanoId("id").notNull().primaryKey(),
    videoId: nanoId("videoId").notNull().$type<Video.VideoId>(),
    labelId: nanoId("labelId").notNull(),

    // Who assigned
    assignedById: nanoId("assignedById").notNull().$type<User.UserId>(),
    assignedAt: timestamp("assignedAt").notNull().defaultNow(),

    // AI suggestion tracking
    isAiSuggested: boolean("isAiSuggested").notNull().default(false),
    aiConfidence: float("aiConfidence"),
  },
  (table) => ({
    videoIdx: index("video_idx").on(table.videoId),
    labelIdx: index("label_idx").on(table.labelId),
    videoLabelUnique: unique("video_label_unique").on(table.videoId, table.labelId),
  }),
);

// Relations
export const videoLabelsRelations = relations(videoLabels, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [videoLabels.organizationId],
    references: [organizations.id],
  }),
  assignments: many(videoLabelAssignments),
}));

export const videoLabelAssignmentsRelations = relations(videoLabelAssignments, ({ one }) => ({
  video: one(videos, {
    fields: [videoLabelAssignments.videoId],
    references: [videos.id],
  }),
  label: one(videoLabels, {
    fields: [videoLabelAssignments.labelId],
    references: [videoLabels.id],
  }),
  assignedBy: one(users, {
    fields: [videoLabelAssignments.assignedById],
    references: [users.id],
  }),
}));
```

---

## Video Table Modifications

```typescript
// Add to videos table definition
export const videos = mysqlTable(
  "videos",
  {
    // ... existing fields ...

    // NEW: RAG eligibility
    ragStatus: varchar("ragStatus", {
      length: 10,
      enum: ["eligible", "excluded", "pending"]
    }).default("pending"),
    ragStatusUpdatedAt: timestamp("ragStatusUpdatedAt"),
    ragStatusUpdatedById: nanoIdNullable("ragStatusUpdatedById").$type<User.UserId>(),

    // NEW: Retention
    keepPermanently: boolean("keepPermanently").notNull().default(false),
    expiresAt: timestamp("expiresAt"),

    // NEW: AI classification
    aiSuggestedLabels: json("aiSuggestedLabels").$type<Array<{
      labelId: string;
      confidence: number;
    }>>(),
    aiClassifiedAt: timestamp("aiClassifiedAt"),
  },
  (table) => [
    // ... existing indexes ...
    index("expires_at_idx").on(table.expiresAt),
    index("rag_status_idx").on(table.ragStatus),
  ],
);
```

---

## Retention Logic

### Computation

```typescript
function computeExpiresAt(video: Video, labels: VideoLabel[]): Date | null {
  // If keep permanently, never expires
  if (video.keepPermanently) return null;

  // Find minimum retention from assigned labels
  const retentionDays = labels
    .map(l => l.retentionDays)
    .filter((d): d is number => d !== null);

  if (retentionDays.length === 0) return null; // All permanent

  const minRetention = Math.min(...retentionDays);
  const expiresAt = new Date(video.createdAt);
  expiresAt.setDate(expiresAt.getDate() + minRetention);

  return expiresAt;
}
```

### Cron Job (Daily)

```typescript
// Run daily at 3 AM
async function deleteExpiredVideos() {
  const now = new Date();

  const expiredVideos = await db
    .select()
    .from(videos)
    .where(
      and(
        isNotNull(videos.expiresAt),
        lte(videos.expiresAt, now),
        eq(videos.keepPermanently, false)
      )
    );

  for (const video of expiredVideos) {
    // 1. Delete from S3
    await deleteVideoFiles(video.id);

    // 2. Delete from database (cascade to comments, shares, etc.)
    await db.delete(videos).where(eq(videos.id, video.id));

    console.log(`Deleted expired video: ${video.id} (${video.name})`);
  }

  return { deleted: expiredVideos.length };
}
```

---

## UI Components

### 1. Retention Badge on Video Card

```tsx
function RetentionBadge({ video }: { video: Video }) {
  if (!video.expiresAt || video.keepPermanently) return null;

  const daysLeft = differenceInDays(video.expiresAt, new Date());

  if (daysLeft <= 0) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
        Expires today
      </span>
    );
  }

  const urgency = daysLeft <= 3 ? "red" : daysLeft <= 7 ? "amber" : "gray";

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full bg-${urgency}-100 text-${urgency}-800`}>
      ⏱️ {daysLeft}j
    </span>
  );
}
```

### 2. Label Selector with Retention Warning

```tsx
function LabelSelector({ video, labels, onSelect }: Props) {
  const [selected, setSelected] = useState<string[]>(video.labelIds);

  const selectedLabels = labels.filter(l => selected.includes(l.id));
  const minRetention = Math.min(
    ...selectedLabels.map(l => l.retentionDays ?? Infinity)
  );

  return (
    <div className="space-y-3">
      {/* Content Type Labels */}
      <div>
        <p className="text-xs font-medium text-gray-10 mb-2">TYPE DE CONTENU</p>
        {labels.filter(l => l.category === 'content_type').map(label => (
          <LabelCheckbox
            key={label.id}
            label={label}
            checked={selected.includes(label.id)}
            onToggle={() => toggleLabel(label.id)}
          />
        ))}
      </div>

      {/* Department Labels */}
      <div>
        <p className="text-xs font-medium text-gray-10 mb-2">DÉPARTEMENT</p>
        {labels.filter(l => l.category === 'department').map(label => (
          <LabelCheckbox ... />
        ))}
      </div>

      {/* Retention Warning */}
      {minRetention !== Infinity && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            ⚠️ Cette vidéo sera supprimée automatiquement après{" "}
            <strong>{minRetention} jours</strong>
          </p>
          <button
            onClick={() => setKeepPermanently(true)}
            className="text-xs text-amber-600 underline mt-1"
          >
            Garder définitivement
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## RAG Integration

### Data to Send to Wally RAG

```typescript
interface VideoForRAG {
  id: string;
  title: string;
  url: string;                    // https://wallester-record.com/s/{id}
  transcription: string;          // Full transcription text
  aiSummary: string;              // AI-generated summary
  labels: string[];               // ["TUTORIAL", "TECH"]
  department: string | null;      // "TECH" if department label assigned
  createdAt: Date;
  createdBy: string;              // User name
}
```

### Sync Process

1. Video marked as `rag_status = 'eligible'`
2. Cron job or webhook sends to Wally RAG API
3. Wally ingests with category based on labels:
   - TUTORIAL, ONBOARDING, PROCESS → `TRAINING`
   - DEMO → `PRESENTATION`
   - Other → `KNOWLEDGE`

---

## Migration Plan

1. **Create tables**: `video_labels`, `video_label_assignments`
2. **Alter videos table**: Add RAG and retention fields
3. **Seed predefined labels**: Insert system labels for each org
4. **Backfill**: Set `ragStatus = 'pending'` for existing videos
5. **Deploy UI**: Label selector, retention badges
6. **Enable cron job**: After testing

---

## API Endpoints

```
GET    /api/labels                     # List labels for org
POST   /api/labels                     # Create custom label
PUT    /api/labels/:id                 # Update label
DELETE /api/labels/:id                 # Delete custom label (not system)

POST   /api/videos/:id/labels          # Assign labels to video
DELETE /api/videos/:id/labels/:labelId # Remove label from video

POST   /api/videos/:id/rag-status      # Update RAG status (admin only)
POST   /api/videos/:id/keep-permanently # Toggle keep permanently
```
