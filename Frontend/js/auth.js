// js/auth.js - Updated Authentication with Password Login

let otpTimer;
let currentEmail = '';
let currentPhone = '';
let isNewUser = false;

// Phone & Email Form Submission - Check if user exists
document.getElementById('phone-email-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  
  // Validate phone
  if (!/^\d{10}$/.test(phone)) {
    showToast('Please enter a valid 10-digit phone number', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const response = await api.checkUser(email, phone);
    
    hideLoading();
    
    if (response.success) {
      currentEmail = email;
      currentPhone = phone;
      
      if (response.userExists) {
        // Existing user - show password login
        isNewUser = false;
        showPasswordLogin();
      } else {
        // New user - send OTP for registration
        isNewUser = true;
        await sendOTPForRegistration();
      }
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to check user', 'error');
  }
});

// Show Password Login Screen
function showPasswordLogin() {
  document.getElementById('step-phone-email').classList.remove('active');
  document.getElementById('step-password').classList.add('active');
  document.getElementById('password-email').textContent = currentEmail;
  document.getElementById('login-password').focus();
}

// Send OTP for Registration
async function sendOTPForRegistration() {
  showLoading();
  
  try {
    const response = await api.sendOTP(currentEmail, currentPhone);
    
    hideLoading();
    
    if (response.success) {
      // Show OTP step for registration
      document.getElementById('step-phone-email').classList.remove('active');
      document.getElementById('step-otp').classList.add('active');
      document.getElementById('otp-email').textContent = currentEmail;
      document.getElementById('otp-instruction').textContent = 'Enter OTP to complete registration';
      
      // Show password field in OTP step
      document.getElementById('otp-password-group').style.display = 'block';
      
      // Start timer
      startOTPTimer(600);
      
      // Focus first OTP digit
      document.querySelector('.otp-digit').focus();
      
      showToast('OTP sent to your email!', 'success');
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to send OTP', 'error');
  }
}

// Password Login Form
document.getElementById('password-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const password = document.getElementById('login-password').value;
  
  if (!password) {
    showToast('Please enter your password', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const response = await api.loginWithPassword(currentEmail, currentPhone, password);
    
    hideLoading();
    
    if (response.success) {
      api.setToken(response.token);
      saveCurrentUser(response.user);
      
      // Check if multiple accounts
      if (response.allAccounts && response.allAccounts.length > 1) {
        showAccountSelection(response.allAccounts);
      } else {
        handleSuccessfulLogin(response.user);
      }
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Invalid password', 'error');
  }
});

// OTP Input Management
const otpDigits = document.querySelectorAll('.otp-digit');

otpDigits.forEach((digit, index) => {
  digit.addEventListener('input', (e) => {
    const value = e.target.value;
    
    if (!/^\d$/.test(value)) {
      e.target.value = '';
      return;
    }
    
    if (value && index < otpDigits.length - 1) {
      otpDigits[index + 1].focus();
    }
  });
  
  digit.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      otpDigits[index - 1].focus();
    }
  });
  
  digit.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    if (/^\d{6}$/.test(pastedData)) {
      pastedData.split('').forEach((char, idx) => {
        if (otpDigits[idx]) {
          otpDigits[idx].value = char;
        }
      });
      otpDigits[5].focus();
    }
  });
});

// OTP Form Submission (for registration)
document.getElementById('otp-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const otp = Array.from(otpDigits).map(d => d.value).join('');
  const password = document.getElementById('otp-password').value;
  
  if (otp.length !== 6) {
    showToast('Please enter complete OTP', 'error');
    return;
  }
  
  if (!password || password.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const response = await api.verifyOTP(currentEmail, currentPhone, otp, password);
    
    hideLoading();
    
    if (response.success) {
      api.setToken(response.token);
      saveCurrentUser(response.user);
      
      if (otpTimer) clearInterval(otpTimer);
      
      if (response.allAccounts && response.allAccounts.length > 1) {
        showAccountSelection(response.allAccounts);
      } else {
        showToast('Registration successful!', 'success');
        handleSuccessfulLogin(response.user);
      }
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Registration failed', 'error');
  }
});

// Show Account Selection
function showAccountSelection(accounts) {
  document.getElementById('step-otp').classList.remove('active');
  document.getElementById('step-password').classList.remove('active');
  document.getElementById('step-select-account').classList.add('active');
  
  const accountsList = document.getElementById('accounts-list');
  accountsList.innerHTML = '';
  
  accounts.forEach(account => {
    const card = document.createElement('div');
    card.className = 'account-card';
    card.innerHTML = `
      <div>
        <h4>${account.name || 'Account'} - ${account.subscriptionType.toUpperCase()}</h4>
        <p>${account.selectedExam || 'No exam selected'}</p>
      </div>
    `;
    card.onclick = () => selectAccount(account.userId);
    accountsList.appendChild(card);
  });
}

// Select Account
async function selectAccount(userId) {
  showLoading();
  
  try {
    const response = await api.selectAccount(currentEmail, userId);
    
    hideLoading();
    
    if (response.success) {
      api.setToken(response.token);
      saveCurrentUser(response.user);
      handleSuccessfulLogin(response.user);
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to select account', 'error');
  }
}

// Handle Successful Login
function handleSuccessfulLogin(user) {
  if (!user.userDetailsCompleted) {
    window.location.href = '/pages/user-details.html';
  } else if (!user.selectedExam) {
    window.location.href = '/pages/select-exam.html';
  } else {
    const dashboardUrl = user.selectedExam === 'JEE' 
      ? '/pages/jee-dashboard.html' 
      : '/pages/neet-dashboard.html';
    window.location.href = dashboardUrl;
  }
}

// Start OTP Timer
function startOTPTimer(seconds) {
  let remaining = seconds;
  const timerEl = document.getElementById('otp-timer');
  
  otpTimer = setInterval(() => {
    remaining--;
    
    const minutes = Math.floor(remaining / 60);
    const secs = remaining % 60;
    
    timerEl.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
    
    if (remaining <= 0) {
      clearInterval(otpTimer);
      showToast('OTP expired. Please request a new one.', 'error');
    }
  }, 1000);
}

// Resend OTP
async function resendOTP() {
  if (otpTimer) clearInterval(otpTimer);
  
  otpDigits.forEach(d => d.value = '');
  otpDigits[0].focus();
  
  await sendOTPForRegistration();
}

// Back Navigation
function backToPhoneEmail() {
  if (otpTimer) clearInterval(otpTimer);
  
  document.getElementById('step-otp').classList.remove('active');
  document.getElementById('step-password').classList.remove('active');
  document.getElementById('step-phone-email').classList.add('active');
  
  otpDigits.forEach(d => d.value = '');
  document.getElementById('login-password').value = '';
  document.getElementById('otp-password').value = '';
}

function backFromPassword() {
  document.getElementById('step-password').classList.remove('active');
  document.getElementById('step-phone-email').classList.add('active');
  document.getElementById('login-password').value = '';
}

// Forgot Password (redirect to support/reset)
function forgotPassword() {
  showToast('Please contact support at zetafeedback@gmail.com for password reset', 'info');
}

// Theme Toggle
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Load Theme
window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
});