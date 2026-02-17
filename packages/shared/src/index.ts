export type UserRole = "user" | "venue" | "artist" | "admin";

export type EventSummary = {
  id: string;
  title: string;
  venue_name: string;
  start_time: string;
  category: string;
  zip_code: string;
};
