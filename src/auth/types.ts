import type { AnalysisResult } from "../types/analysis";

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  userId: string;
  createdAt: string;
  title: string;
  platform: string;
  code: string;
  result: AnalysisResult;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}
