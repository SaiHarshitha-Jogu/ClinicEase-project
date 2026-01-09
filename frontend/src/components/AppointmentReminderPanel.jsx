import React from 'react';
import { useAppointmentReminders } from '../hooks/useAppointmentReminders.js';
import { toast } from 'react-toastify';

const AppointmentReminderPanel = ({ userId, isAdmin = false }) => {
  const {
    todayAppointments,
    loading,
    error,
    reminderResults,
    sendReminder,
    sendAllReminders,
    clearResults
  } = useAppointmentReminders(userId);

  const handleSendReminder = async (appointmentId) => {
    const success = await sendReminder(appointmentId);
    if (success) {
      toast.success('Reminder sent successfully!');
    } else {
      toast.error('Failed to send reminder');
    }
  };

  const handleSendAllReminders = async () => {
    const results = await sendAllReminders();
    if (results) {
      toast.success(
        `Sent ${results.success} reminders${results.failed > 0 ? ` (${results.failed} failed)` : ''}`
      );
    } else {
      toast.error('Failed to send reminders');
    }
  };

  const formatTime = (time) => {
    if (!time) return 'Not specified';
    return time;
  };

  if (loading && todayAppointments.length === 0) {
    return (
      <div className="reminder-panel loading">
        <div className="loading-spinner">Loading appointments...</div>
      </div>
    );
  }

  return (
    <div className="reminder-panel">
      <div className="reminder-header">
        <h3>Today's Appointments</h3>
        {isAdmin && todayAppointments.length > 0 && (
          <button 
            className="send-all-btn"
            onClick={handleSendAllReminders}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send All Reminders'}
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}

      {reminderResults && (
        <div className="reminder-results">
          <div className="results-header">
            <h4>Reminder Results</h4>
            <button onClick={clearResults} className="close-btn">×</button>
          </div>
          <div className="results-content">
            <p>✅ Sent: {reminderResults.success}</p>
            <p>❌ Failed: {reminderResults.failed}</p>
            <p>📊 Total: {reminderResults.total}</p>
          </div>
        </div>
      )}

      {todayAppointments.length === 0 ? (
        <div className="no-appointments">
          <p>No appointments scheduled for today</p>
        </div>
      ) : (
        <div className="appointments-list">
          {todayAppointments.map((appointment) => (
            <div key={appointment.id} className="appointment-card">
              <div className="appointment-info">
                <h4>{appointment.patientName || appointment.name}</h4>
                <p><strong>Time:</strong> {formatTime(appointment.time)}</p>
                <p><strong>Reason:</strong> {appointment.problem || appointment.reason || 'General consultation'}</p>
                {appointment.doctorName && (
                  <p><strong>Doctor:</strong> {appointment.doctorName}</p>
                )}
                <p><strong>Email:</strong> {appointment.patientEmail || appointment.email}</p>
                {appointment.reminderSent && (
                  <span className="reminder-sent-badge">✅ Reminder Sent</span>
                )}
              </div>
              <div className="appointment-actions">
                <button
                  className={`reminder-btn ${appointment.reminderSent ? 'sent' : ''}`}
                  onClick={() => handleSendReminder(appointment.id)}
                  disabled={loading || appointment.reminderSent}
                >
                  {appointment.reminderSent ? 'Reminder Sent' : 'Send Reminder'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .reminder-panel {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin: 20px 0;
        }

        .reminder-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .reminder-header h3 {
          margin: 0;
          color: #333;
        }

        .send-all-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .send-all-btn:hover {
          background: #0056b3;
        }

        .send-all-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .loading {
          text-align: center;
          padding: 40px;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .reminder-results {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          border-radius: 4px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .results-header h4 {
          margin: 0;
          color: #155724;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #155724;
        }

        .no-appointments {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .appointments-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .appointment-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .appointment-info h4 {
          margin: 0 0 8px 0;
          color: #333;
        }

        .appointment-info p {
          margin: 4px 0;
          color: #666;
          font-size: 14px;
        }

        .reminder-sent-badge {
          display: inline-block;
          background: #28a745;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          margin-top: 8px;
        }

        .appointment-actions {
          flex-shrink: 0;
        }

        .reminder-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
        }

        .reminder-btn:hover:not(:disabled) {
          background: #218838;
        }

        .reminder-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .reminder-btn.sent {
          background: #6c757d;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .appointment-card {
            flex-direction: column;
            align-items: stretch;
          }

          .appointment-actions {
            margin-top: 12px;
          }

          .reminder-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default AppointmentReminderPanel;
