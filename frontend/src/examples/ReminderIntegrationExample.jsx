import React from 'react';
import AppointmentReminderPanel from '../components/AppointmentReminderPanel.jsx';
import { auth } from '../firebase/firebase';

/**
 * Example of how to integrate the AppointmentReminderPanel into your dashboard
 * Add this component to your dashboard where you want to show appointment reminders
 */
const ReminderIntegrationExample = () => {
  const currentUser = auth.currentUser;
  
  return (
    <div className="reminder-section">
      <h2>Appointment Reminders</h2>
      
      {/* For patient view - shows only their appointments */}
      {currentUser && (
        <AppointmentReminderPanel 
          userId={currentUser.uid}
          isAdmin={false}
        />
      )}
      
      {/* For admin/doctor view - shows all appointments */}
      {/* Uncomment the following for admin dashboard */}
      {/*
      <AppointmentReminderPanel 
        userId={null}
        isAdmin={true}
      />
      */}
    </div>
  );
};

export default ReminderIntegrationExample;

/*
HOW TO INTEGRATE INTO YOUR DASHBOARD:

1. For Patient Dashboard (src/patient/dashboard.jsx):
   - Add this import at the top:
     import AppointmentReminderPanel from '../components/AppointmentReminderPanel.jsx';
   
   - Add this component where you want to show reminders:
     <AppointmentReminderPanel userId={user?.uid} isAdmin={false} />

2. For Doctor/Admin Dashboard:
   - Use the same component but with isAdmin={true}:
     <AppointmentReminderPanel userId={null} isAdmin={true} />

3. The component will:
   - Automatically fetch today's appointments
   - Show appointment details with reminder status
   - Allow manual reminder sending
   - Auto-refresh every 5 minutes
   - Display success/failure status

4. Server-side automation:
   - Reminders are automatically sent daily at 9 AM
   - You can test manually by calling POST /trigger-reminders
   - Each appointment gets only one reminder per day
   - Status is tracked in the database

5. Email template:
   - Uses the existing sendAppointmentReminderEmail function
   - Includes appointment details and clinic information
   - Professional reminder message with arrival instructions
*/
