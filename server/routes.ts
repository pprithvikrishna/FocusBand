import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSessionSchema, insertAttentionMetricSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // SMS alert endpoint using Fast2SMS
  app.post("/api/send-alert-sms", async (req, res) => {
    try {
      const apiKey = process.env.FAST2SMS_API_KEY;
      const mobile = process.env.ALERT_MOBILE;

      if (!apiKey || !mobile) {
        console.error("[SMS] FAST2SMS_API_KEY or ALERT_MOBILE not set");
        return res
          .status(500)
          .json({ ok: false, error: "SMS env vars missing on server" });
      }

      const url = "https://www.fast2sms.com/dev/bulkV2";

      const params = new URLSearchParams({
        authorization: apiKey,
        route: "q",
        language: "english",
        numbers: mobile,
        message:
          "FocusBand alert: Attention dropped below 50. Please refocus now.",
      });

      const response = await fetch(`${url}?${params.toString()}`, {
        method: "GET",
      });

      const data = await response.json().catch(() => ({} as any));

      if (!response.ok || (data && data.return === false)) {
        console.error("[SMS] Fast2SMS error:", data);
        return res.status(500).json({ ok: false, error: "Fast2SMS API error" });
      }

      console.log("[SMS] Fast2SMS success:", data);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[SMS] Error in /api/send-alert-sms:", err);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  // Session endpoints
  
  // Create a new session
  app.post("/api/sessions", async (req, res) => {
    try {
      const validatedData = insertSessionSchema.parse(req.body);
      const session = await storage.createSession(validatedData);
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(400).json({ error: "Invalid session data" });
    }
  });

  // Get all sessions
  app.get("/api/sessions", async (_req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Get a single session by ID
  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSessionById(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Update a session by ID
  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const updatedSession = await storage.updateSession(req.params.id, req.body);
      if (!updatedSession) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(updatedSession);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  // Delete a session by ID
  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      await storage.deleteSession(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // Attention metric endpoints
  
  // Create attention metrics (batch)
  app.post("/api/metrics", async (req, res) => {
    try {
      const metrics = Array.isArray(req.body) ? req.body : [req.body];
      const created = await Promise.all(
        metrics.map(metric => {
          const validatedData = insertAttentionMetricSchema.parse(metric);
          return storage.createAttentionMetric(validatedData);
        })
      );
      res.json(created);
    } catch (error) {
      console.error("Error creating metrics:", error);
      res.status(400).json({ error: "Invalid metric data" });
    }
  });

  // Get metrics for a session
  app.get("/api/metrics/session/:sessionId", async (req, res) => {
    try {
      const metrics = await storage.getMetricsBySessionId(req.params.sessionId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // Stats endpoints
  
  // Get attention statistics
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Export all sessions and metrics as CSV
  app.get("/api/export/csv", async (_req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      const headers = [
        "Session ID",
        "Start Time",
        "End Time",
        "Duration (s)",
        "Average Attention",
        "Peak Attention",
        "Lowest Attention",
        "Total Blinks",
        "Average Eye Openness",
      ];

      const rows: string[][] = [];
      
      for (const session of sessions) {
        const metrics = await storage.getMetricsBySessionId(session.id);
        const averageAttention = metrics.length > 0
          ? metrics.reduce((sum, metric) => sum + metric.attentionScore, 0) / metrics.length
          : 0;
        const peakAttention = metrics.length > 0
          ? Math.max(...metrics.map(metric => metric.attentionScore))
          : 0;
        const lowestAttention = metrics.length > 0
          ? Math.min(...metrics.map(metric => metric.attentionScore))
          : 0;
        const totalBlinks = metrics.reduce((sum, metric) => sum + (metric.blinkDetected ? 1 : 0), 0);
        const averageEyeOpenness = metrics.length > 0
          ? metrics.reduce((sum, metric) => sum + metric.eyeOpenness, 0) / metrics.length
          : 0;

        rows.push([
          session.id,
          session.startTime.toISOString(),
          session.endTime ? session.endTime.toISOString() : "",
          session.duration?.toString() ?? "",
          averageAttention.toFixed(2),
          peakAttention.toString(),
          lowestAttention.toString(),
          totalBlinks.toString(),
          averageEyeOpenness.toFixed(4),
        ]);
      }

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(","))
        .join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="attention-sessions.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  // Export all sessions and metrics as JSON
  app.get("/api/export/json", async (_req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      const sessionsWithMetrics = await Promise.all(
        sessions.map(async session => {
          const metrics = await storage.getMetricsBySessionId(session.id);
          return { ...session, metrics };
        })
      );
      
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", 'attachment; filename="attention-data.json"');
      res.json(sessionsWithMetrics);
    } catch (error) {
      console.error("Error exporting JSON:", error);
      res.status(500).json({ error: "Failed to export JSON" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
