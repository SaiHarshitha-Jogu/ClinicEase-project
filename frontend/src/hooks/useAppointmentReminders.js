import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/firebase';
import { 
  getTodayAppointments, 
  sendSpecificReminder, 
  sendDailyReminders 
} from '../utils/appointmentReminderService.js';

/**
 * Custom hook for managing appointment reminders
 * @param {string} userId - Optional user ID to filter appointments
 * @returns {Object} - Reminder state and functions
 */
export const useAppointmentReminders = (userId = null) => {
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reminderResults, setReminderResults] = useState(null);

  // Fetch today's appointments
  const fetchTodayAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const appointments = await getTodayAppointments(db, userId);
      setTodayAppointments(appointments);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching today\'s appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Send reminder for specific appointment
  const sendReminder = useCallback(async (appointmentId) => {
    setLoading(true);
    setError(null);
    try {
      const success = await sendSpecificReminder(db, appointmentId);
      if (success) {
        // Refresh appointments to update reminder status
        await fetchTodayAppointments();
      }
      return success;
    } catch (err) {
      setError(err.message);
      console.error('Error sending reminder:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchTodayAppointments]);

  // Send reminders for all today's appointments
  const sendAllReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await sendDailyReminders(db);
      setReminderResults(results);
      // Refresh appointments to update reminder status
      await fetchTodayAppointments();
      return results;
    } catch (err) {
      setError(err.message);
      console.error('Error sending all reminders:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchTodayAppointments]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    fetchTodayAppointments();
    
    const interval = setInterval(fetchTodayAppointments, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchTodayAppointments]);

  return {
    todayAppointments,
    loading,
    error,
    reminderResults,
    fetchTodayAppointments,
    sendReminder,
    sendAllReminders,
    clearResults: () => setReminderResults(null)
  };
};
