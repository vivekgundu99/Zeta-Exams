// routes/admin.routes.js - Admin Management Routes
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Admin, GiftCode, FormulaSheet } from '../models/Others.js';
import Question from '../models/Question.model.js';
import { adminAuthMiddleware } from '../middleware/auth.middleware.js';
import Papa from 'papaparse';

const router = express.Router();

// POST /api/admin/login - Password-based admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find admin
    const admin = await Admin.findOne({ email, isActive: true });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = jwt.sign(
      { adminId: admin._id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Admin Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Protected admin routes
router.use(adminAuthMiddleware);

// POST /api/admin/create-coadmin - Only admin can create co-admins
router.post('/create-coadmin', async (req, res) => {
  try {
    if (req.adminRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create co-admins'
      });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and name are required'
      });
    }

    // Check if co-admin exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create co-admin
    const coAdmin = await Admin.create({
      email,
      password: hashedPassword,
      name,
      role: 'co-admin',
      createdBy: req.adminId
    });

    res.json({
      success: true,
      message: 'Co-admin created successfully',
      coAdmin: {
        email: coAdmin.email,
        name: coAdmin.name,
        role: coAdmin.role
      }
    });

  } catch (error) {
    console.error('Create Co-admin Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create co-admin'
    });
  }
});

// DELETE /api/admin/coadmin/:id - Delete co-admin
router.delete('/coadmin/:id', async (req, res) => {
  try {
    if (req.adminRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete co-admins'
      });
    }

    const coAdmin = await Admin.findById(req.params.id);

    if (!coAdmin || coAdmin.role !== 'co-admin') {
      return res.status(404).json({
        success: false,
        message: 'Co-admin not found'
      });
    }

    coAdmin.isActive = false;
    await coAdmin.save();

    res.json({
      success: true,
      message: 'Co-admin deleted successfully'
    });

  } catch (error) {
    console.error('Delete Co-admin Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete co-admin'
    });
  }
});

// GET /api/admin/coadmins - List all co-admins
router.get('/coadmins', async (req, res) => {
  try {
    if (req.adminRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view co-admins'
      });
    }

    const coAdmins = await Admin.find({ role: 'co-admin' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      coAdmins
    });

  } catch (error) {
    console.error('Get Co-admins Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch co-admins'
    });
  }
});

// POST /api/admin/questions/bulk-import - Bulk import questions from CSV
router.post('/questions/bulk-import', async (req, res) => {
  try {
    const { csvData, exam, subject, chapter } = req.body;

    if (!csvData || !exam || !subject || !chapter) {
      return res.status(400).json({
        success: false,
        message: 'CSV data, exam, subject, and chapter are required'
      });
    }

    const lines = csvData.trim().split('\n');
    const questions = [];

    for (const line of lines) {
      const parts = line.split('#');
      
      if (parts.length < 5) continue;

      const type = parseInt(parts[0]);
      const questionText = parts[1];
      const questionImageUrl = parts[2] !== 'none' ? parts[2] : null;

      if (type === 1) {
        // MCQ
        const optionA = parts[3];
        const imageA = parts[4] !== 'none' ? parts[4] : null;
        const optionB = parts[5];
        const imageB = parts[6] !== 'none' ? parts[6] : null;
        const optionC = parts[7];
        const imageC = parts[8] !== 'none' ? parts[8] : null;
        const optionD = parts[9];
        const imageD = parts[10] !== 'none' ? parts[10] : null;
        const correctAnswer = parts[11];

        questions.push({
          exam,
          subject,
          chapter,
          topic: parts[12] || 'General',
          questionType: 'MCQ',
          questionText,
          questionImageUrl,
          options: [
            { label: 'A', text: optionA, imageUrl: imageA },
            { label: 'B', text: optionB, imageUrl: imageB },
            { label: 'C', text: optionC, imageUrl: imageC },
            { label: 'D', text: optionD, imageUrl: imageD }
          ],
          correctAnswer,
          createdBy: req.adminId
        });
      } else if (type === 2) {
        // Numerical
        const correctAnswer = parts[11];

        questions.push({
          exam,
          subject,
          chapter,
          topic: parts[12] || 'General',
          questionType: 'NUMERICAL',
          questionText,
          questionImageUrl,
          correctAnswer,
          createdBy: req.adminId
        });
      }
    }

    // Insert questions
    const inserted = await Question.insertMany(questions);

    res.json({
      success: true,
      message: `${inserted.length} questions imported successfully`,
      count: inserted.length
    });

  } catch (error) {
    console.error('Bulk Import Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import questions'
    });
  }
});

// POST /api/admin/questions - Add single question
router.post('/questions', async (req, res) => {
  try {
    const questionData = {
      ...req.body,
      createdBy: req.adminId
    };

    const question = await Question.create(questionData);

    res.json({
      success: true,
      message: 'Question added successfully',
      question
    });

  } catch (error) {
    console.error('Add Question Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add question'
    });
  }
});

// GET /api/admin/questions/search - Search questions
router.get('/questions/search', async (req, res) => {
  try {
    const { exam, subject, chapter, topic, search } = req.query;

    const query = { isActive: true };
    if (exam) query.exam = exam;
    if (subject) query.subject = subject;
    if (chapter) query.chapter = chapter;
    if (topic) query.topic = topic;
    if (search) {
      query.questionText = { $regex: search, $options: 'i' };
    }

    const questions = await Question.find(query)
      .select('-__v')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      questions
    });

  } catch (error) {
    console.error('Search Questions Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search questions'
    });
  }
});

// PUT /api/admin/questions/:id - Update question
router.put('/questions/:id', async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      message: 'Question updated successfully',
      question
    });

  } catch (error) {
    console.error('Update Question Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update question'
    });
  }
});

// DELETE /api/admin/questions/:id - Delete question
router.delete('/questions/:id', async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });

  } catch (error) {
    console.error('Delete Question Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete question'
    });
  }
});

// POST /api/admin/giftcodes/generate - Generate gift codes
router.post('/giftcodes/generate', async (req, res) => {
  try {
    if (req.adminRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can generate gift codes'
      });
    }

    const { count, duration } = req.body;

    if (!count || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Count and duration are required'
      });
    }

    const giftCodes = [];

    for (let i = 0; i < count; i++) {
      const code = Array.from({ length: 12 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
      ).join('');

      giftCodes.push({
        code,
        duration,
        createdBy: req.adminId
      });
    }

    const inserted = await GiftCode.insertMany(giftCodes);

    res.json({
      success: true,
      message: `${inserted.length} gift codes generated`,
      codes: inserted.map(c => c.code)
    });

  } catch (error) {
    console.error('Generate Gift Codes Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate gift codes'
    });
  }
});

export default router;