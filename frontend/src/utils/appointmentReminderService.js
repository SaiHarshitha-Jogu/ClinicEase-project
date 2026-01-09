import { sendAppointmentReminderEmail } from './emailService.js';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase.js';

/**
 * Check if today is the appointment day
 * @param {string} appointmentDate - Appointment date string (YYYY-MM-DD format)
 * @returns {boolean} - True if today is the appointment day
 */
const isTodayAppointment = (appointmentDate) => {
  const today = new Date();
  const appointment = new Date(appointmentDate);
  
  // Reset time to compare only dates
  today.setHours(0, 0, 0, 0);
  appointment.setHours(0, 0, 0, 0);
  
  return today.getTime() === appointment.getTime();
};

/**
 * Get appointments scheduled for today from Firebase
 * @param {Object} db - Firebase database instance
 * @param {string} userId - Optional user ID to filter appointments
 * @returns {Promise<Array>} - Array of today's appointments
 */
export const getTodayAppointments = async (db, userId = null) => {
  try {
    const appointmentsRef = collection(db, 'appointments');
    let q;
    
    if (userId) {
      q = query(appointmentsRef, where('userId', '==', userId));
    } else {
      q = query(appointmentsRef);
    }
    
    const querySnapshot = await getDocs(q);
    const allAppointments = [];
    
    querySnapshot.forEach((doc) => {
      const appointmentData = { id: doc.id, ...doc.data() };
      if (isTodayAppointment(appointmentData.date)) {
        allAppointments.push(appointmentData);
      }
    });
    
    return allAppointments;
  } catch (error) {
    console.error('Error fetching today\'s appointments:', error);
    return [];
  }
};

/**
 * Send reminder emails for all today's appointments
 * @param {Object} db - Firebase database instance
 * @returns {Promise<Object>} - Results object with success and failure counts
 */
export const sendDailyReminders = async (db) => {
  try {
    const todayAppointments = await getTodayAppointments(db);
    const results = {
      success: 0,
      failed: 0,
      total: todayAppointments.length,
      details: []
    };
    
    console.log(`Found ${todayAppointments.length} appointments for today`);
    
    for (const appointment of todayAppointments) {
      try {
        const emailSent = await sendAppointmentReminderEmail({
          name: appointment.patientName || appointment.name,
          email: appointment.patientEmail || appointment.email,
          date: appointment.date,
          time: appointment.time,
          problem: appointment.problem || appointment.reason,
          doctorName: appointment.doctorName
        });
        
        if (emailSent) {
          results.success++;
          results.details.push({
            appointmentId: appointment.id,
            status: 'success',
            email: appointment.patientEmail || appointment.email
          });
          
          // Mark reminder as sent in database
          await markReminderSent(db, appointment.id);
        } else {
          results.failed++;
          results.details.push({
            appointmentId: appointment.id,
            status: 'failed',
            email: appointment.patientEmail || appointment.email
          });
        }
      } catch (error) {
        console.error(`Failed to send reminder for appointment ${appointment.id}:`, error);
        results.failed++;
        results.details.push({
          appointmentId: appointment.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log(`Daily reminder results: ${results.success} sent, ${results.failed} failed`);
    return results;
  } catch (error) {
    console.error('Error in sendDailyReminders:', error);
    return { success: 0, failed: 0, total: 0, error: error.message };
  }
};

/**
 * Mark that a reminder has been sent for an appointment
 * @param {Object} db - Firebase database instance
 * @param {string} appointmentId - ID of the appointment
 * @returns {Promise<void>}
 */
const markReminderSent = async (db, appointmentId) => {
  try {
    const appointmentRef = doc(db, 'appointments', appointmentId);
    await updateDoc(appointmentRef, {
      reminderSent: true,
      reminderSentAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error marking reminder as sent:', error);
  }
};

/**
 * Check if reminder has already been sent for an appointment
 * @param {Object} appointment - Appointment object
 * @returns {boolean} - True if reminder already sent
 */
const isReminderAlreadySent = (appointment) => {
  return appointment.reminderSent === true;
};

/**
 * Send reminder for a specific appointment (manual trigger)
 * @param {Object} db - Firebase database instance
 * @param {string} appointmentId - ID of the appointment
 * @returns {Promise<boolean>} - True if email sent successfully
 */
export const sendSpecificReminder = async (db, appointmentId) => {
  try {
    const appointmentRef = doc(db, 'appointments', appointmentId);
    const appointmentDoc = await getDoc(appointmentRef);
    
    if (!appointmentDoc.exists()) {
      console.error('Appointment not found:', appointmentId);
      return false;
    }
    
    const appointment = { id: appointmentDoc.id, ...appointmentDoc.data() };
    
    // Check if reminder already sent
    if (isReminderAlreadySent(appointment)) {
      console.log('Reminder already sent for appointment:', appointmentId);
      return true;
    }
    
    const emailSent = await sendAppointmentReminderEmail({
      name: appointment.patientName || appointment.name,
      email: appointment.patientEmail || appointment.email,
      date: appointment.date,
      time: appointment.time,
      problem: appointment.problem || appointment.reason,
      doctorName: appointment.doctorName
    });
    
    if (emailSent) {
      await markReminderSent(db, appointmentId);
    }
    
    return emailSent;
  } catch (error) {
    console.error('Error sending specific reminder:', error);
    return false;
  }
};

/**
 * Send immediate reminder for same-day appointments (called after booking)
 * @param {Object} db - Firebase database instance
 * @param {Object} appointmentDetails - Appointment details
 * @returns {Promise<boolean>} - True if email sent successfully
 */
export const sendImmediateReminderForSameDay = async (db, appointmentDetails) => {
  try {
    // Only send if appointment is today
    if (!isTodayAppointment(appointmentDetails.date)) {
      console.log('Appointment is not for today, skipping immediate reminder');
      return false;
    }
    
    const emailSent = await sendAppointmentReminderEmail({
      name: appointmentDetails.patientName || appointmentDetails.name,
      email: appointmentDetails.patientEmail || appointmentDetails.email,
      date: appointmentDetails.date,
      time: appointmentDetails.time,
      problem: appointmentDetails.problem || appointmentDetails.reason,
      doctorName: appointmentDetails.doctorName
    });
    
    if (emailSent) {
      console.log('Immediate reminder sent for same-day appointment');
    }
    
    return emailSent;
  } catch (error) {
    console.error('Error sending immediate reminder:', error);
    return false;
  }
};

/**
 * Initialize daily reminder scheduler
 * @param {Object} db - Firebase database instance
 * @param {string} scheduleTime - Time to run daily check (HH:MM format, default: "09:00")
 * @returns {Object} - Scheduler control object
 */
export const initializeReminderScheduler = (db, scheduleTime = "09:00") => {
  let schedulerInterval;
  
  const scheduleDailyCheck = () => {
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const now = new Date();
    
    // Calculate time until next scheduled run
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    // If scheduled time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const timeUntilScheduled = scheduledTime.getTime() - now.getTime();
    
    console.log(`Next reminder check scheduled for: ${scheduledTime.toLocaleString()}`);
    
    // Clear existing interval
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
    }
    
    // Set timeout for first run
    setTimeout(() => {
      sendDailyReminders(db);
      
      // Then set up daily interval
      schedulerInterval = setInterval(() => {
        sendDailyReminders(db);
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, timeUntilScheduled);
  };
  
  // Start the scheduler
  scheduleDailyCheck();
  
  return {
    stop: () => {
      if (schedulerInterval) {
        clearInterval(schedulerInterval);
        console.log('Reminder scheduler stopped');
      }
    },
    restart: () => {
      scheduleDailyCheck();
    },
    runNow: () => {
      sendDailyReminders(db);
    }
  };
};
