require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced middleware configuration
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// MongoDB connection with error handling
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connection established'))
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// Application schema with validation
const applicationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    match: [/\S+@\S+\.\S+/, 'Invalid email format']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required']
  },
  searchFilters: {
    country: String,
    city: String,
    sector: String,
    employmentType: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Application = mongoose.model('Application', applicationSchema);

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.ADMIN_EMAIL_PASSWORD
  }
});

// Verify email configuration
transporter.verify(error => {
  if (error) console.error('❌ Email server error:', error);
  else console.log('✅ Email server ready');
});

// API Endpoints
app.post('/api/submit-application', async (req, res) => {
  try {
    const { email, firstName, lastName, country, ...searchFilters } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName || !country) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Create and save application
    const newApplication = await Application.create({
      email,
      firstName,
      lastName,
      country,
      searchFilters
    });

    // Send email notification (non-blocking)
    transporter.sendMail({
      from: `PLC Careers <${process.env.ADMIN_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: 'New Application Received',
      html: `
        <h3>New Job Application</h3>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Country:</strong> ${country}</p>
        <h4>Search Filters:</h4>
        <pre>${JSON.stringify(searchFilters, null, 2)}</pre>
      `
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: newApplication
    });

  } catch (error) {
    console.error('🚨 Submission error:', error);
    res.status(500).json({
      success: false,
      error: error.name === 'ValidationError' ? error.message : 'Submission failed'
    });
  }
});

// Service endpoints
app.get('/', (req, res) => {
  res.send(`
    <style>
      body { font-family: Arial, sans-serif; padding: 2rem; }
      a { color: #0056b3; }
    </style>
    <h1>PLC Construction Careers Backend</h1>
    <p>This server handles job application submissions.</p>
    <p>➡️ Access the frontend: <a href="http://localhost:3000">http://localhost:3000</a></p>
    <h3>Available Endpoints:</h3>
    <ul>
      <li><strong>POST</strong> /api/submit-application - Submit job applications</li>
      <li><strong>GET</strong> /api/health - Service health check</li>
    </ul>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 MongoDB status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});