// js/auth.js - Authentication Flow Logic

let otpTimer;
let currentEmail = '';
let currentPhone = '';

// Phone & Email Form Submission
document.getElementById('phone-email-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  
  // Validate phone (10 digits)
  if (!/^\d{10}$/.test(phone)) {
    showToast('Please enter a valid 10-digit phone number', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const response = await api.sendOTP(email, phone);
    
    hideLoading();
    
    if (response.success) {
      currentEmail = email;
      currentPhone = phone;
      
      // Show OTP step
      document.getElementById('step-phone-email').classList.remove('active');
      document.getElementById('step-otp').classList.add('active');
      document.getElementById('otp-email').textContent = email;
      
      // Start OTP timer
      startOTPTimer(600); // 10 minutes
      
      // Focus first OTP digit
      document.querySelector('.otp-digit').focus();
      
      showToast('OTP sent successfully!', 'success');
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to send OTP', 'error');
  }
});

// OTP Input Management
const otpDigits = document.querySelectorAll('.otp-digit');

otpDigits.forEach((digit, index) => {
  digit.addEventListener('input', (e) => {
    const value = e.target.value;
    
    // Only allow numbers
    if (!/^\d$/.test(value)) {
      e.target.value = '';
      return;
    }
    
    // Move to next input
    if (value && index < otpDigits.length - 1) {
      otpDigits[index + 1].focus();
    }
  });
  
  digit.addEventListener('keydown', (e) => {
    // Move to previous input on backspace
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      otpDigits[index - 1].focus();
    }
  });
  
  // Paste handling
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

// OTP Form Submission
document.getElementById('otp-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const otp = Array.from(otpDigits).map(d => d.value).join('');
  
  if (otp.length !== 6) {
    showToast('Please enter complete OTP', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const response = await api.verifyOTP(currentEmail, currentPhone, otp);
    
    hideLoading();
    
    if (response.success) {
      // Save token
      api.setToken(response.token);
      saveCurrentUser(response.user);
      
      // Stop timer
      if (otpTimer) clearInterval(otpTimer);
      
      // Check if multiple accounts exist
      if (response.allAccounts && response.allAccounts.length > 1) {
        // Show account selection
        showAccountSelection(response.allAccounts);
      } else {
        // Single account - proceed
        handleSuccessfulLogin(response.user);
      }
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Invalid OTP', 'error');
  }
});

// Show Account Selection
function showAccountSelection(accounts) {
  document.getElementById('step-otp').classList.remove('active');
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

// Create New Account
function createNewAccount() {
  // Just proceed with the existing OTP verification
  // The backend will create a new account
  const user = getCurrentUser();
  handleSuccessfulLogin(user);
}

// Handle Successful Login
function handleSuccessfulLogin(user) {
  if (!user.userDetailsCompleted) {
    // Redirect to user details page
    window.location.href = '/pages/user-details.html';
  } else if (!user.selectedExam) {
    // Redirect to exam selection
    window.location.href = '/pages/select-exam.html';
  } else {
    // Redirect to dashboard
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
  
  // Clear OTP inputs
  otpDigits.forEach(d => d.value = '');
  otpDigits[0].focus();
  
  showLoading();
  
  try {
    const response = await api.sendOTP(currentEmail, currentPhone);
    
    hideLoading();
    
    if (response.success) {
      startOTPTimer(600);
      showToast('New OTP sent successfully!', 'success');
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to resend OTP', 'error');
  }
}

// Back to Phone/Email
function backToPhoneEmail() {
  if (otpTimer) clearInterval(otpTimer);
  
  document.getElementById('step-otp').classList.remove('active');
  document.getElementById('step-phone-email').classList.add('active');
  
  // Clear OTP inputs
  otpDigits.forEach(d => d.value = '');
}

// Theme Toggle
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Load Theme on Page Load
window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
});