import emailjs from '@emailjs/browser';

// EmailJS configuration
const EMAILJS_SERVICE_ID = 'service_944ve9p';
const EMAILJS_CONFIRMATION_TEMPLATE_ID = 'template_fm3held'; // Existing confirmation template
const EMAILJS_REMINDER_TEMPLATE_ID = 'template_dsr7uii'; // Reminder template
const EMAILJS_CANCELLATION_TEMPLATE_ID = 'template_fm3held'; // TODO: Replace with actual cancellation template ID
const EMAILJS_PUBLIC_KEY = '6GS11X2SFgoLpPRXf';

/**
 * Send appointment confirmation email
 * @param {Object} appointmentDetails - Appointment information
 * @param {string} appointmentDetails.name - Patient name
 * @param {string} appointmentDetails.email - Patient email
 * @param {string} appointmentDetails.date - Appointment date
 * @param {string} appointmentDetails.time - Appointment time
 * @param {string} appointmentDetails.problem - Problem description
 * @param {string} appointmentDetails.doctorName - Doctor name (optional)
 * @returns {Promise<boolean>} - Returns true if email sent successfully
 */
export const sendAppointmentConfirmationEmail = async (appointmentDetails) => {
  try {
    console.log('Appointment details received:', appointmentDetails);
    
    const templateParams = {
      to_name: appointmentDetails.name,
      to_email: appointmentDetails.email,
      appointment_date: appointmentDetails.date,
      appointment_time: appointmentDetails.time,
      appointment_reason: appointmentDetails.problem || 'General consultation',
      patient_name: appointmentDetails.name,
      reason: appointmentDetails.problem || 'General consultation',
      problem: appointmentDetails.problem || 'General consultation',
      reason_for_visit: appointmentDetails.problem || 'General consultation',
      visit_reason: appointmentDetails.problem || 'General consultation',
      purpose: appointmentDetails.problem || 'General consultation',
      doctor_name: appointmentDetails.doctorName || 'Dr. Manjunath',
      clinic_name: 'ClinicEase Unified',
      clinic_address: '123 Healthcare Street, Medical City, MC 12345',
      clinic_phone: '+1 (555) 123-4567',
      message: `Your appointment has been successfully booked for ${appointmentDetails.date} at ${appointmentDetails.time}. Please arrive 10 minutes early.`
    };

    console.log('Template params being sent to EmailJS:', templateParams);

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_CONFIRMATION_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.log('Appointment confirmation email sent successfully:', response);
    return true;
  } catch (error) {
    console.error('Error sending appointment confirmation email:', error);
    return false;
  }
};

/**
 * Send appointment cancellation email
 * @param {Object} appointmentDetails - Appointment information
 * @returns {Promise<boolean>} - Returns true if email sent successfully
 */
export const sendAppointmentCancellationEmail = async (appointmentDetails) => {
  try {
    const templateParams = {
      to_name: appointmentDetails.name,
      to_email: appointmentDetails.email,
      appointment_date: appointmentDetails.date,
      appointment_time: appointmentDetails.time,
      patient_name: appointmentDetails.name,
      doctor_name: appointmentDetails.doctorName || 'Dr. Manjunath',
      clinic_name: 'ClinicEase Unified',
      message: `Your appointment scheduled for ${appointmentDetails.date} at ${appointmentDetails.time} has been cancelled.`
    };

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_CANCELLATION_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.log('Appointment cancellation email sent successfully:', response);
    return true;
  } catch (error) {
    console.error('Error sending appointment cancellation email:', error);
    return false;
  }
};

/**
 * Send appointment reminder email
 * @param {Object} appointmentDetails - Appointment information
 * @returns {Promise<boolean>} - Returns true if email sent successfully
 */
export const sendAppointmentReminderEmail = async (appointmentDetails) => {
  try {
    const templateParams = {
      to_name: appointmentDetails.name,
      to_email: appointmentDetails.email,
      appointment_date: appointmentDetails.date,
      appointment_time: appointmentDetails.time,
      patient_name: appointmentDetails.name,
      reason: appointmentDetails.problem || 'General consultation',
      doctor_name: appointmentDetails.doctorName || 'Dr. Manjunath',
      clinic_name: 'Star Smiles Dental Care',
      clinic_address: 'Alkapur Township, Huda, Mahalneknapur, Manikonda, Hyderabad, Telangana 500089',
      clinic_phone: '+91-9030271023',
      clinic_phone_alt: '+91-7416860888',
      message: `🔔 REMINDER: Your appointment is TODAY! 📅\n\nAppointment Details:\n• Date: ${appointmentDetails.date}\n• Time: ${appointmentDetails.time}\n• Doctor: ${appointmentDetails.doctorName || 'Dr. Manjunath'}\n• Reason: ${appointmentDetails.problem || 'General consultation'}\n\n📍 Please arrive 10 minutes early.\n📞 Call us if you need to reschedule:\n   +91-9030271023\n   +91-7416860888\n\nWe look forward to seeing you at Star Smiles Dental Care!`
    };

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_REMINDER_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.log('Appointment reminder email sent successfully:', response);
    return true;
  } catch (error) {
    console.error('Error sending appointment reminder email:', error);
    return false;
  }
};
