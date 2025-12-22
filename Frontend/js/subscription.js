// js/subscription.js - Subscription & Payment Logic

const PLANS = {
  silver: {
    '1M': { mrp: 100, price: 49, savings: 51 },
    '6M': { mrp: 500, price: 249, savings: 50 },
    '1Y': { mrp: 1000, price: 399, savings: 60 }
  },
  gold: {
    '1M': { mrp: 600, price: 299, savings: 50 },
    '6M': { mrp: 2500, price: 1299, savings: 48 },
    '1Y': { mrp: 5000, price: 2000, savings: 60 }
  }
};

let selectedPlan = { type: 'silver', duration: '1M' };

// Initialize page
window.addEventListener('DOMContentLoaded', () => {
  if (!isLoggedIn()) {
    window.location.href = '/pages/login.html';
    return;
  }
  
  setupTabButtons();
});

// Setup Tab Buttons
function setupTabButtons() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const plan = this.getAttribute('data-plan');
      const duration = this.getAttribute('data-duration');
      
      // Remove active from siblings
      this.parentElement.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
      });
      
      // Add active to clicked
      this.classList.add('active');
      
      // Update pricing display
      updatePricing(plan, duration);
    });
  });
}

// Update Pricing Display
function updatePricing(plan, duration) {
  const pricing = PLANS[plan][duration];
  const card = document.querySelector(`.${plan}-card`);
  
  card.querySelector('.original-price').textContent = `₹${pricing.mrp}`;
  card.querySelector('.price').textContent = `₹${pricing.price}`;
  card.querySelector('.savings-badge').textContent = `Save ${pricing.savings}%`;
  
  // Update period based on duration
  const periodMap = {
    '1M': '/month',
    '6M': '/6 months',
    '1Y': '/year'
  };
  card.querySelector('.period').textContent = periodMap[duration];
  
  // Update button
  const btn = card.querySelector('.btn-primary, .btn-gold');
  btn.onclick = () => proceedToPayment(plan, duration, pricing.price);
}

// Toggle Gift Code Form
function toggleGiftCode() {
  const form = document.getElementById('gift-code-form');
  form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  
  if (form.style.display === 'flex') {
    document.getElementById('giftCodeInput').focus();
  }
}

// Apply Gift Code
async function applyGiftCode() {
  const code = document.getElementById('giftCodeInput').value.trim().toUpperCase();
  
  if (code.length !== 12) {
    showToast('Gift code must be 12 characters', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const response = await api.applyGiftCode(code);
    
    hideLoading();
    
    if (response.success) {
      showToast('Gift code applied successfully! Redirecting...', 'success');
      
      // Update user data
      const user = getCurrentUser();
      user.subscriptionType = 'gold';
      user.subscriptionExpiryDate = response.subscription.expiryDate;
      saveCurrentUser(user);
      
      // Redirect to dashboard
      setTimeout(() => {
        const dashboardUrl = user.selectedExam === 'JEE' 
          ? '/pages/jee-dashboard.html' 
          : '/pages/neet-dashboard.html';
        window.location.href = dashboardUrl;
      }, 2000);
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Invalid gift code', 'error');
  }
}

// Select Free Plan
function selectPlan(type) {
  if (type === 'free') {
    // Update user data
    const user = getCurrentUser();
    
    // Redirect to dashboard
    const dashboardUrl = user.selectedExam === 'JEE' 
      ? '/pages/jee-dashboard.html' 
      : '/pages/neet-dashboard.html';
    window.location.href = dashboardUrl;
  }
}

// Proceed to Payment
async function proceedToPayment(planType, duration, amount) {
  showLoading();
  
  try {
    // Create Razorpay order
    const orderResponse = await api.createOrder(planType, duration, amount);
    
    hideLoading();
    
    if (!orderResponse.success) {
      throw new Error('Failed to create order');
    }
    
    // Initialize Razorpay
    const options = {
      key: orderResponse.keyId,
      amount: orderResponse.amount,
      currency: orderResponse.currency,
      order_id: orderResponse.orderId,
      name: 'Zeta Exams',
      description: `${planType.toUpperCase()} Plan - ${duration}`,
      image: '/assets/logo.png',
      handler: async function(response) {
        await verifyPayment(response, planType, duration, amount);
      },
      prefill: {
        email: getCurrentUser().email
      },
      theme: {
        color: '#6366f1'
      },
      modal: {
        ondismiss: function() {
          showToast('Payment cancelled', 'info');
        }
      }
    };
    
    const razorpay = new Razorpay(options);
    razorpay.open();
    
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to initiate payment', 'error');
  }
}

// Verify Payment
async function verifyPayment(razorpayResponse, planType, duration, amount) {
  showLoading();
  
  try {
    const verifyResponse = await api.verifyPayment({
      razorpay_payment_id: razorpayResponse.razorpay_payment_id,
      razorpay_order_id: razorpayResponse.razorpay_order_id,
      razorpay_signature: razorpayResponse.razorpay_signature,
      planType,
      duration,
      amount
    });
    
    hideLoading();
    
    if (verifyResponse.success) {
      showToast('Payment successful! Subscription activated.', 'success');
      
      // Update user data
      const user = getCurrentUser();
      user.subscriptionType = planType;
      user.subscriptionExpiryDate = verifyResponse.subscription.expiryDate;
      saveCurrentUser(user);
      
      // Show success modal
      showSuccessModal(planType, duration);
      
      // Redirect after 3 seconds
      setTimeout(() => {
        const dashboardUrl = user.selectedExam === 'JEE' 
          ? '/pages/jee-dashboard.html' 
          : '/pages/neet-dashboard.html';
        window.location.href = dashboardUrl;
      }, 3000);
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Payment verification failed', 'error');
  }
}

// Show Success Modal
function showSuccessModal(planType, duration) {
  const modal = document.createElement('div');
  modal.className = 'payment-success-modal';
  modal.innerHTML = `
    <div class="success-content">
      <div class="success-icon">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="#10b981"/>
          <path d="M30 50L45 65L70 35" stroke="white" stroke-width="6" fill="none" stroke-linecap="round"/>
        </svg>
      </div>
      <h2>Payment Successful!</h2>
      <p>Your ${planType.toUpperCase()} subscription (${duration}) is now active.</p>
      <p class="redirect-text">Redirecting to dashboard...</p>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  setTimeout(() => {
    modal.remove();
  }, 3000);
}

// Close Payment Modal
function closePaymentModal() {
  document.getElementById('payment-modal').style.display = 'none';
}

// Add CSS for payment success modal
const style = document.createElement('style');
style.textContent = `
  .payment-success-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease;
  }
  
  .success-content {
    background: white;
    border-radius: 16px;
    padding: 40px;
    text-align: center;
    max-width: 400px;
    animation: slideUp 0.3s ease;
  }
  
  .success-icon {
    margin-bottom: 24px;
    animation: scaleIn 0.5s ease;
  }
  
  .success-content h2 {
    margin-bottom: 16px;
    color: #111827;
  }
  
  .success-content p {
    color: #6b7280;
    margin-bottom: 8px;
  }
  
  .redirect-text {
    font-size: 14px;
    color: #9ca3af;
  }
  
  @keyframes scaleIn {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  @keyframes slideUp {
    from {
      transform: translateY(50px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);