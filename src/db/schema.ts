import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** One row per person using the app. Matched by email across providers. */
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  image: text("image"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

/**
 * A connected Gmail or Outlook calendar. A user can have up to one of each
 * provider connected at a time — this is the only "account" concept the
 * app has; there's no separate login-only account row.
 */
export const connectedCalendars = pgTable(
  "connected_calendar",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "google" | "microsoft"
    providerAccountId: text("providerAccountId").notNull(),
    email: text("email").notNull(),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken"),
    expiresAt: timestamp("expiresAt", { mode: "date" }),
    scope: text("scope"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("connected_calendar_unique").on(t.userId, t.provider)]
);

/**
 * A lightweight cache of every event we last saw for a connected calendar.
 * The sync job diffs against this to notice brand-new events and to
 * detect clashes between the two connected calendars.
 */
export const calendarEvents = pgTable(
  "calendar_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "google" | "microsoft"
    externalId: text("externalId").notNull(), // event id from Google/Graph
    calendarName: text("calendarName"),
    title: text("title").notNull(),
    location: text("location"),
    start: timestamp("start", { mode: "date" }).notNull(),
    end: timestamp("end", { mode: "date" }).notNull(),
    isAllDay: boolean("isAllDay").notNull().default(false),
    status: text("status").notNull().default("confirmed"), // confirmed | cancelled | tentative
    htmlLink: text("htmlLink"),
    firstSeenAt: timestamp("firstSeenAt", { mode: "date" }).notNull().defaultNow(),
    lastSeenAt: timestamp("lastSeenAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("calendar_event_unique").on(t.userId, t.provider, t.externalId),
    index("calendar_event_user_idx").on(t.userId),
    index("calendar_event_time_idx").on(t.start, t.end),
  ]
);

/** Notifications shown as in-app toasts/banner + sent as web push. */
export const notifications = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "clash" | "new_event" | "cancelled"
    title: text("title").notNull(),
    message: text("message").notNull(),
    relatedEventIds: jsonb("relatedEventIds").$type<string[]>().default([]),
    read: boolean("read").notNull().default(false),
    pushSentAt: timestamp("pushSentAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt)]
);

/** Browser push subscriptions registered for a user's devices. */
export const pushSubscriptions = pgTable(
  "push_subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("push_sub_user_idx").on(t.userId)]
);

/** Tracks the last successful sync per connected calendar, for the dashboard's "Last synced" label and error surfacing. */
export const syncStatus = pgTable(
  "sync_status",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    lastSyncedAt: timestamp("lastSyncedAt", { mode: "date" }),
    lastError: text("lastError"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })]
);
