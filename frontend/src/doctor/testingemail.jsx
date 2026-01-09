import React, { useRef, useState } from 'react';
import { sendAppointmentConfirmationEmail } from '../utils/emailService.js';

function Trial() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [formData, setFormData] = useState({
    name: 'Test Patient',
    email: 'test@example.com',
    date: '2026-01-05',
    time: '10:00 AM',
    problem: 'General consultation'
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const sendEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult('');
    
    try {
      const success = await sendAppointmentConfirmationEmail({
        name: formData.name,
        email: formData.email,
        date: formData.date,
        time: formData.time,
        problem: formData.problem,
        doctorName: 'Dr. Manjunath'
      });
      
      if (success) {
        setResult('✅ Appointment confirmation email sent successfully!');
      } else {
        setResult('❌ Failed to send email');
      }
    } catch (error) {
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2>Appointment Email Test</h2>
      
      <form onSubmit={sendEmail}>
        <div style={{ marginBottom: '10px' }}>
          <label>Patient Name: </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            style={{ width: '100%', padding: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>Patient Email: </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            style={{ width: '100%', padding: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>Appointment Date: </label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleInputChange}
            required
            style={{ width: '100%', padding: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>Appointment Time: </label>
          <input
            type="text"
            name="time"
            value={formData.time}
            onChange={handleInputChange}
            required
            style={{ width: '100%', padding: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>Problem/Reason: </label>
          <input
            type="text"
            name="problem"
            value={formData.problem}
            onChange={handleInputChange}
            required
            style={{ width: '100%', padding: '5px' }}
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Sending...' : 'Send Test Email'}
        </button>
      </form>
      
      {result && (
        <div style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: result.includes('✅') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${result.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '5px'
        }}>
          {result}
        </div>
      )}
    </div>
  );
}

export default Trial;

