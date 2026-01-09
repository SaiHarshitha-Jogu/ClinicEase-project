import React, { useState } from 'react';
import { sendAppointmentConfirmationEmail } from '../utils/emailService.js';

const EmailTest = () => {
  const [testData, setTestData] = useState({
    name: 'John Doe',
    email: 'test@example.com',
    date: '2026-01-05',
    time: '10:00 AM',
    problem: 'General checkup',
    doctorName: 'Dr. Manjunath'
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleTest = async () => {
    setLoading(true);
    setResult('');
    
    try {
      const success = await sendAppointmentConfirmationEmail(testData);
      if (success) {
        setResult('✅ Email sent successfully!');
      } else {
        setResult('❌ Failed to send email');
      }
    } catch (error) {
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setTestData({
      ...testData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2>Email Service Test</h2>
      
      <div style={{ marginBottom: '10px' }}>
        <label>Name: </label>
        <input
          type="text"
          name="name"
          value={testData.name}
          onChange={handleChange}
          style={{ width: '100%', padding: '5px' }}
        />
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <label>Email: </label>
        <input
          type="email"
          name="email"
          value={testData.email}
          onChange={handleChange}
          style={{ width: '100%', padding: '5px' }}
        />
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <label>Date: </label>
        <input
          type="date"
          name="date"
          value={testData.date}
          onChange={handleChange}
          style={{ width: '100%', padding: '5px' }}
        />
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <label>Time: </label>
        <input
          type="text"
          name="time"
          value={testData.time}
          onChange={handleChange}
          style={{ width: '100%', padding: '5px' }}
        />
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <label>Problem: </label>
        <input
          type="text"
          name="problem"
          value={testData.problem}
          onChange={handleChange}
          style={{ width: '100%', padding: '5px' }}
        />
      </div>
      
      <button
        onClick={handleTest}
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
};

export default EmailTest;
