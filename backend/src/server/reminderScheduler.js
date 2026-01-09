import cron from 'node-cron';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { sendAppointmentReminderEmail } from '../utils/emailService.js';

// Firebase configuration (same as your frontend)
const firebaseConfig = {
  // Add your Firebase config here or import from config
  apiKey: "AIzaSyBfK3LjX3h9y5t7u8v9w0x1y2z3a4b5c6d",
  authDomain: "cliniceaseunified.firebaseapp.com",
  projectId: "cliniceaseunified",
  storageBucket: "cliniceaseunified.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Check if today is the appointment day
 * @param {string} appointmentDate - Appointment date string
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
 * Get appointments scheduled for today
 * @returns {Promise<Array>} - Array of today's appointments
 */
const getTodayAppointments = async () => {
  try {
    const appointmentsRef = collection(db, 'appointments');
    const q = query(appointmentsRef);
    const querySnapshot = await getDocs(q);
    const todayAppointments = [];
    
    querySnapshot.forEach((doc) => {
      const appointmentData = { id: doc.id, ...doc.data() };
      if (isTodayAppointment(appointmentData.date)) {
        todayAppointments.push(appointmentData);
      }
    });
    
    return todayAppointments;
  } catch (error) {
    console.error('Error fetching today\'s appointments:', error);
    return [];
  }
};

/**
 * Mark reminder as sent in database
 * @param {string} appointmentId - ID of the appointment
 */
const markReminderSent = async (appointmentId) => {
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
 * Send reminder emails for all today's appointments
 */
const sendDailyReminders = async () => {
  try {
    console.log('🔔 Starting daily appointment reminder check...');
    
    const todayAppointments = await getTodayAppointments();
    console.log(`Found ${todayAppointments.length} appointments for today`);
    
    let successCount = 0;
    let failedCount = 0;
    
    for (const appointment of todayAppointments) {
      // Skip if reminder already sent
      if (appointment.reminderSent) {
        console.log(`⏭️  Reminder already sent for appointment ${appointment.id}`);
        continue;
      }
      
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
          successCount++;
          await markReminderSent(appointment.id);
          console.log(`✅ Reminder sent successfully to ${appointment.patientEmail || appointment.email}`);
        } else {
          failedCount++;
          console.log(`❌ Failed to send reminder to ${appointment.patientEmail || appointment.email}`);
        }
      } catch (error) {
        failedCount++;
        console.error(`❌ Error sending reminder for appointment ${appointment.id}:`, error);
      }
    }
    
    console.log(`📊 Daily reminder results: ${successCount} sent, ${failedCount} failed`);
    return { success: successCount, failed: failedCount, total: todayAppointments.length };
  } catch (error) {
    console.error('❌ Error in sendDailyReminders:', error);
    return { success: 0, failed: 0, total: 0, error: error.message };
  }
};

/**
 * Initialize the reminder scheduler
 * @param {string} scheduleTime - Cron expression (default: "0 9 * * *" for 9 AM daily)
 */
export const initializeReminderScheduler = (scheduleTime = "0 9 * * *") => {
  console.log(`🕐 Initializing reminder scheduler with cron: ${scheduleTime}`);
  
  // Schedule daily reminder check at 9 AM
  const task = cron.schedule(scheduleTime, async () => {
    console.log('⏰ Running scheduled appointment reminder check...');
    await sendDailyReminders();
  }, {
    scheduled: false,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });
  
  // Start the scheduler
  task.start();
  console.log('✅ Reminder scheduler started successfully');
  
  // Also run once at startup for testing (optional)
  // Uncomment the line below to send reminders immediately when server starts
  // setTimeout(sendDailyReminders, 5000);
  
  return task;
};

/**
 * Manual trigger for sending reminders (for testing)
 */
export const triggerRemindersManually = async () => {
  console.log('🔧 Manually triggering appointment reminders...');
  return await sendDailyReminders();
};

export default {
  initializeReminderScheduler,
  triggerRemindersManually,
  sendDailyReminders
};
