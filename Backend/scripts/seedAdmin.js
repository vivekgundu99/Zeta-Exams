// scripts/seedAdmin.js - Create initial admin account
// Run: node scripts/seedAdmin.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Admin } from '../models/Others.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await Admin.findOne({ email: 'zetafeedback@gmail.com' });

    if (existingAdmin) {
      console.log('⚠️  Admin already exists');
      process.exit(0);
    }

    // Create admin with hashed password
    const hashedPassword = await bcrypt.hash('123456', 10);

    await Admin.create({
      email: 'zetafeedback@gmail.com',
      password: hashedPassword,
      name: 'Main Administrator',
      role: 'admin'
    });

    console.log('✅ Admin account created successfully');
    console.log('Email: zetafeedback@gmail.com');
    console.log('Password: 123456');
    console.log('⚠️  PLEASE CHANGE THE PASSWORD IMMEDIATELY AFTER FIRST LOGIN');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();