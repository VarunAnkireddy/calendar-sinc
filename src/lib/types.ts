// Plain client-safe shapes mirroring the DB rows, used to pass data from
// server components into client components without pulling drizzle into
// the client bundle.

export interface EventDTO {
  id: string;
  provider: string;
  externalId: string;
  calendarName: string | null;
  title: string;
  location: string | null;
  start: string; // ISO
  end: string; // ISO
  isAllDay: boolean;
  status: string;
  htmlLink: string | null;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedEventIds: string[];
  read: boolean;
  createdAt: string; // ISO
}
