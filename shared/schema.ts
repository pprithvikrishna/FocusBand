import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session table - stores attention tracking sessions
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in seconds
  averageAttention: real("average_attention"), // 0-100
  peakAttention: real("peak_attention"), // 0-100
  lowestAttention: real("lowest_attention"), // 0-100
  totalBlinks: integer("total_blinks"),
  averageEyeOpenness: real("average_eye_openness"),
});

// Attention metrics table - stores per-second metrics during a session
export const attentionMetrics = pgTable("attention_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => sessions.id),
  timestamp: timestamp("timestamp").notNull(),
  attentionScore: real("attention_score").notNull(), // 0-100
  eyeOpenness: real("eye_openness").notNull(), // 0-1
  blinkDetected: integer("blink_detected").notNull().default(0), // 0 or 1
  gazeDirection: text("gaze_direction").notNull(), // 'center', 'left', 'right', 'up', 'down'
  headYaw: real("head_yaw").notNull(), // degrees
  headPitch: real("head_pitch").notNull(), // degrees
});

// Insert schemas with timestamp/date coercion for JSON APIs
export const insertSessionSchema = createInsertSchema(sessions, {
  startTime: z.coerce.date().or(z.date()),
  endTime: z.coerce.date().or(z.date()).nullable(),
}).omit({
  id: true,
});

export const insertAttentionMetricSchema = createInsertSchema(attentionMetrics, {
  timestamp: z.coerce.date().or(z.date()),
  blinkDetected: z.number().int().min(0).max(1), // 0 or 1
}).omit({
  id: true,
});

// Types
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertAttentionMetric = z.infer<typeof insertAttentionMetricSchema>;
export type AttentionMetric = typeof attentionMetrics.$inferSelect;

// Frontend-only types for real-time data
export interface LiveAttentionData {
  attentionScore: number;
  eyeOpenness: number;
  blinkRate: number;
  gazeDirection: string;
  headYaw: number;
  headPitch: number;
  faceDetected: boolean;
}

export interface SessionStats {
  totalSessions: number;
  averageAttention: number;
  totalStudyTime: number; // in minutes
  weeklyTrend: number; // percentage change
}
