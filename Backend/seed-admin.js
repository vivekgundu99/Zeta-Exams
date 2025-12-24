// seed-admin.js - Create Admin Account
// Place this file in Backend/ folder (not in scripts/)
// Run: node seed-admin.js

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Define Admin Schema directly here
const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'co-admin'],
    default: 'admin'
  },
  name: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Admin = mongoose.model('Admin', adminSchema);

const seedAdmin = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await Admin.findOne({ 
      email: 'zetafeedback@gmail.com' 
    });

    if (existingAdmin) {
      console.log('⚠️  Admin already exists!');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Name:', existingAdmin.name);
      console.log('🔑 Password: Admin@Zeta2025!');
      
      const updatePassword = process.argv.includes('--update-password');
      
      if (updatePassword) {
        console.log('🔄 Updating password...');
        const hashedPassword = await bcrypt.hash('Admin@Zeta2025!', 10);
        existingAdmin.password = hashedPassword;
        await existingAdmin.save();
        console.log('✅ Password updated successfully!');
      }
      
      await mongoose.connection.close();
      process.exit(0);
    }

    // Create new admin
    console.log('🔄 Creating admin account...');
    
    const hashedPassword = await bcrypt.hash('Admin@Zeta2025!', 10);

    const admin = await Admin.create({
      email: 'zetafeedback@gmail.com',
      password: hashedPassword,
      name: 'Main Administrator',
      role: 'admin',
      isActive: true
    });

    console.log('✅ Admin account created successfully!');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email: zetafeedback@gmail.com');
    console.log('🔑 Password: Admin@Zeta2025!');
    console.log('═══════════════════════════════════════');
    console.log('⚠️  IMPORTANT: Change password after first login!');
    console.log('');
    console.log('🔗 Login URL: https://zeta-exams-backend.vercel.app/api/admin/login');
    console.log('');

    await mongoose.connection.close();
    console.log('👋 Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

seedAdmin();