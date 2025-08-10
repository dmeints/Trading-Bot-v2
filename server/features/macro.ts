/**
 * Macro Feature Builder
 * Identifies market blackout windows around major economic events
 */

import { db } from "../db";
import { macroEventsExtended } from "@shared/schema";
import { gte, lte, and } from "drizzle-orm";

export interface MacroFeatures {
  blackout?: boolean;
}

export async function calculateMacro(
  fromTs: Date,
  toTs: Date
): Promise<MacroFeatures | null> {
  try {
    const currentTime = new Date();
    
    // Get macro events that could affect trading in the current time window
    const events = await db
      .select()
      .from(macroEventsExtended)
      .where(
        and(
          gte(macroEventsExtended.timestamp, new Date(currentTime.getTime() - 24 * 60 * 60 * 1000)), // Look back 24h
          lte(macroEventsExtended.timestamp, new Date(currentTime.getTime() + 24 * 60 * 60 * 1000))  // Look ahead 24h
        )
      );

    if (events.length === 0) {
      return { blackout: false };
    }

    // Check if we're in a blackout window for any high-importance events
    let blackout = false;
    
    for (const event of events) {
      // Only consider high importance events  
      if (event.importance !== 'high') continue;
      
      const eventTime = event.timestamp.getTime();
      const windowBefore = event.windowBeforeMs || 30 * 60 * 1000; // Default 30 minutes before
      const windowAfter = event.windowAfterMs || 30 * 60 * 1000;   // Default 30 minutes after
      
      const blackoutStart = eventTime - windowBefore;
      const blackoutEnd = eventTime + windowAfter;
      
      // Check if current time falls within any blackout window
      if (currentTime.getTime() >= blackoutStart && currentTime.getTime() <= blackoutEnd) {
        blackout = true;
        break;
      }
    }

    return { blackout };

  } catch (error) {
    console.error('Macro calculation error:', error);
    return null;
  }
}