import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSessionSchema, insertAttentionMetricSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Get a specific session
  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Update a session
  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.updateSession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  // Delete a session
  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const success = await storage.deleteSession(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Session not found" });
      }
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

  // Analytics endpoints
  
  // Get session statistics
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getSessionStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Export endpoints
  
  // Export all sessions as CSV
  app.get("/api/export/csv", async (_req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      
      // Create CSV header
      const headers = [
        "Session ID",
        "Start Time",
        "End Time",
        "Duration (seconds)",
        "Average Attention",
        "Peak Attention",
        "Lowest Attention",
        "Total Blinks",
        "Average Eye Openness"
      ];
      
      // Create CSV rows
      const rows = sessions.map(session => [
        session.id,
        session.startTime.toISOString(),
        session.endTime?.toISOString() || "",
        session.duration?.toString() || "",
        session.averageAttention?.toString() || "",
        session.peakAttention?.toString() || "",
        session.lowestAttention?.toString() || "",
        session.totalBlinks?.toString() || "",
        session.averageEyeOpenness?.toString() || ""
      ]);
      
      // Combine header and rows
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
