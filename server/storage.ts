import {
  type Session,
  type InsertSession,
  type AttentionMetric,
  type InsertAttentionMetric,
  type SessionStats,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Session operations
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  getAllSessions(): Promise<Session[]>;
  updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<boolean>;
  
  // Attention metric operations
  createAttentionMetric(metric: InsertAttentionMetric): Promise<AttentionMetric>;
  getMetricsBySessionId(sessionId: string): Promise<AttentionMetric[]>;
  
  // Analytics operations
  getSessionStats(): Promise<SessionStats>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private attentionMetrics: Map<string, AttentionMetric>;

  constructor() {
    this.sessions = new Map();
    this.attentionMetrics = new Map();
  }

  // Session operations
  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = randomUUID();
    
    // Convert ISO string dates back to Date objects
    const normalized = { ...insertSession };
    if (normalized.startTime && typeof normalized.startTime === 'string') {
      normalized.startTime = new Date(normalized.startTime);
    }
    if (normalized.endTime && typeof normalized.endTime === 'string') {
      normalized.endTime = new Date(normalized.endTime);
    }
    
    const session: Session = { ...normalized, id };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getAllSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).sort((a, b) => {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });
  }

  async updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    
    // Convert ISO string dates back to Date objects
    const normalized = { ...data };
    if (normalized.startTime && typeof normalized.startTime === 'string') {
      normalized.startTime = new Date(normalized.startTime);
    }
    if (normalized.endTime && typeof normalized.endTime === 'string') {
      normalized.endTime = new Date(normalized.endTime);
    }
    
    const updated = { ...session, ...normalized };
    this.sessions.set(id, updated);
    return updated;
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = this.sessions.delete(id);
    if (result) {
      // Also delete associated metrics
      Array.from(this.attentionMetrics.values())
        .filter(metric => metric.sessionId === id)
        .forEach(metric => this.attentionMetrics.delete(metric.id));
    }
    return result;
  }

  // Attention metric operations
  async createAttentionMetric(insertMetric: InsertAttentionMetric): Promise<AttentionMetric> {
    const id = randomUUID();
    
    // Convert ISO string timestamp back to Date object
    const normalized = { ...insertMetric };
    if (normalized.timestamp && typeof normalized.timestamp === 'string') {
      normalized.timestamp = new Date(normalized.timestamp);
    }
    
    const metric: AttentionMetric = { ...normalized, id };
    this.attentionMetrics.set(id, metric);
    return metric;
  }

  async getMetricsBySessionId(sessionId: string): Promise<AttentionMetric[]> {
    return Array.from(this.attentionMetrics.values())
      .filter(metric => metric.sessionId === sessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Analytics operations
  async getSessionStats(): Promise<SessionStats> {
    const sessions = Array.from(this.sessions.values());
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Filter sessions by time periods
    const thisWeekSessions = sessions.filter(s => new Date(s.startTime) >= oneWeekAgo);
    const lastWeekSessions = sessions.filter(
      s => new Date(s.startTime) >= twoWeeksAgo && new Date(s.startTime) < oneWeekAgo
    );

    // Calculate total sessions
    const totalSessions = sessions.length;

    // Calculate average attention
    const sessionsWithAttention = sessions.filter(s => s.averageAttention !== null);
    const averageAttention = sessionsWithAttention.length > 0
      ? sessionsWithAttention.reduce((sum, s) => sum + (s.averageAttention || 0), 0) / sessionsWithAttention.length
      : 0;

    // Calculate total study time for this week (in minutes)
    const totalStudyTime = thisWeekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;

    // Calculate weekly trend
    const thisWeekAvg = thisWeekSessions.filter(s => s.averageAttention !== null).length > 0
      ? thisWeekSessions
          .filter(s => s.averageAttention !== null)
          .reduce((sum, s) => sum + (s.averageAttention || 0), 0) /
        thisWeekSessions.filter(s => s.averageAttention !== null).length
      : 0;

    const lastWeekAvg = lastWeekSessions.filter(s => s.averageAttention !== null).length > 0
      ? lastWeekSessions
          .filter(s => s.averageAttention !== null)
          .reduce((sum, s) => sum + (s.averageAttention || 0), 0) /
        lastWeekSessions.filter(s => s.averageAttention !== null).length
      : 0;

    const weeklyTrend = lastWeekAvg > 0
      ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100
      : 0;

    return {
      totalSessions,
      averageAttention,
      totalStudyTime,
      weeklyTrend,
    };
  }
}

export const storage = new MemStorage();
