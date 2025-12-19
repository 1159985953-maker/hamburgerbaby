import { useState, useEffect } from 'react';
import { CharacterProfile } from '../types';

/**
 * This hook simulates the "Alive" feeling.
 * It changes mood based on time of day (timezone aware) and simulated routine.
 */
export const useCharacterLife = (initialProfile: CharacterProfile, timezone: string) => {
  const [profile, setProfile] = useState<CharacterProfile>(initialProfile);

  useEffect(() => {
    const interval = setInterval(() => {
      setProfile(prev => {
        // Get hour in specific timezone
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false });
        const hour = parseInt(timeString.split(':')[0], 10);
        
        let newMood = prev.mood.current;
        let newDesc = prev.mood.description;
        let newEnergy = prev.mood.energyLevel;

        // Biological clock simulation based on timezone
        // Less random, more routine-based
        if (hour >= 23 || hour < 6) {
            newMood = 'Sleepy';
            newDesc = "Drifting off...";
            newEnergy = Math.max(5, newEnergy - 5);
        } else if (hour >= 6 && hour < 8) {
            newMood = 'Waking Up';
            newDesc = "Just getting started.";
            newEnergy = Math.min(60, newEnergy + 10);
        } else if (hour >= 8 && hour < 12) {
            newMood = 'Busy';
            newDesc = "Working hard!";
            newEnergy = Math.max(40, newEnergy - 2);
        } else if (hour >= 12 && hour < 14) {
            newMood = 'Hungry';
            newDesc = "Thinking about food.";
            newEnergy = 60;
        } else if (hour >= 14 && hour < 18) {
            newMood = 'Focused';
            newDesc = "In the zone.";
            newEnergy = Math.max(30, newEnergy - 3);
        } else if (hour >= 18 && hour < 23) {
            newMood = 'Relaxed';
            newDesc = "Free time now.";
            newEnergy = Math.min(90, newEnergy + 5); 
        }

        // Only update if changed to avoid re-renders if using strict equality elsewhere
        if (prev.mood.current !== newMood || Math.abs(prev.mood.energyLevel - newEnergy) > 5) {
             return {
              ...prev,
              mood: {
                current: newMood,
                description: newDesc,
                energyLevel: newEnergy,
                lastUpdate: Date.now()
              }
            };
        }
        return prev;
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [timezone, initialProfile]); 

  return { profile, setProfile };
};
