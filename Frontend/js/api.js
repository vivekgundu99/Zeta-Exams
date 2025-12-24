// js/api.js - Fixed with Request Timeout and Better Error Handling
const API_URL = 'https://zeta-exams-backend.vercel.app/api';

class API {
  constructor() {
    this.baseURL = API_URL;
    this.token = localStorage.getItem('authToken');
    this.timeout = 30000; // 30 second timeout
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  getHeaders(isJson = true) {
    const headers = {
      'Accept': 'application/json',
    };
    
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Fetch with timeout
  async fetchWithTimeout(url, options = {}, timeout = this.timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - server took too long to respond');
      }
      throw error;
    }
  }

  // Generic request handler
  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      
      const config = {
        ...options,
        headers: this.getHeaders(options.body !== undefined),
        credentials: 'omit', // Changed from 'include' - Vercel doesn't need credentials
        mode: 'cors',
      };

      console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await this.fetchWithTimeout(url, config);

      console.log(`📡 Response Status: ${response.status}`);

      // Handle different response types
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.log('📄 Raw Response:', text);
        try {
          data = JSON.parse(text);
        } catch {
          if (!response.ok) {
            throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
          }
          data = { message: text || 'No response data' };
        }
      }

      if (!response.ok) {
        console.error('❌ API Error Response:', data);
        
        // Handle 401 - Unauthorized
        if (response.status === 401) {
          this.clearToken();
          if (window.location.pathname !== '/pages/index.html' && 
              !window.location.pathname.includes('login') &&
              !window.location.pathname.includes('admin-login')) {
            window.location.href = '/pages/index.html';
          }
        }
        
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      console.log('✅ API Success:', data);
      return data;

    } catch (error) {
      console.error('❌ API Error:', error);
      
      // Provide user-friendly error messages
      if (error.message.includes('timeout')) {
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      
      if (error.message === 'Failed to fetch') {
        throw new Error('Cannot reach server. Please check your internet connection.');
      }
      
      if (error.name === 'TypeError') {
        throw new Error('Network error. Please try again.');
      }
      
      throw error;
    }
  }

  // Auth endpoints
  async sendOTP(email, phone) {
    return this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email, phone })
    });
  }

  async verifyOTP(email, phone, otp) {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, phone, otp })
    });
  }

  async selectAccount(email, userId) {
    return this.request('/auth/select-account', {
      method: 'POST',
      body: JSON.stringify({ email, userId })
    });
  }

  // User endpoints
  async getUserProfile() {
    return this.request('/user/profile');
  }

  async completeUserDetails(details) {
    return this.request('/user/complete-details', {
      method: 'POST',
      body: JSON.stringify(details)
    });
  }

  async selectExam(exam) {
    return this.request('/user/select-exam', {
      method: 'POST',
      body: JSON.stringify({ exam })
    });
  }

  async checkLimits() {
    return this.request('/user/check-limits');
  }

  async trackQuestionAttempt(data) {
    return this.request('/user/track-question-attempt', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Question endpoints
  async getFilters(exam) {
    return this.request(`/questions/filters?exam=${exam}`);
  }

  async getChapters(exam, subject) {
    return this.request(`/questions/chapters?exam=${exam}&subject=${encodeURIComponent(subject)}`);
  }

  async getTopics(exam, subject, chapter) {
    return this.request(`/questions/topics?exam=${exam}&subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`);
  }

  async getPracticeQuestions(filters) {
    return this.request('/questions/practice', {
      method: 'POST',
      body: JSON.stringify(filters)
    });
  }

  async getQuestionImage(questionId) {
    return this.request(`/questions/${questionId}/image`);
  }

  async verifyAnswer(questionId, userAnswer, timeTaken) {
    return this.request('/questions/verify-answer', {
      method: 'POST',
      body: JSON.stringify({ questionId, userAnswer, timeTaken })
    });
  }

  async generateTest(filters) {
    return this.request('/questions/generate-test', {
      method: 'POST',
      body: JSON.stringify(filters)
    });
  }

  // Subscription endpoints
  async getPlans() {
    return this.request('/subscription/plans');
  }

  async applyGiftCode(code) {
    return this.request('/subscription/apply-giftcode', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  }

  // Payment endpoints
  async createOrder(planType, duration, amount) {
    return this.request('/payment/create-order', {
      method: 'POST',
      body: JSON.stringify({ planType, duration, amount })
    });
  }

  async verifyPayment(paymentData) {
    return this.request('/payment/verify', {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  }

  async calculateRefund() {
    return this.request('/payment/refund/calculate', {
      method: 'POST'
    });
  }

  // Mock test endpoints
  async getMockTests(exam) {
    return this.request(`/mocktest/list?exam=${exam}`);
  }

  async startMockTest(mockTestId) {
    return this.request(`/mocktest/${mockTestId}/start`, {
      method: 'POST'
    });
  }

  async submitMockTest(mockTestId, answers, timeTaken) {
    return this.request(`/mocktest/${mockTestId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers, timeTaken })
    });
  }

  async reviewMockTest(mockTestId) {
    return this.request(`/mocktest/${mockTestId}/review`);
  }

  // Analytics endpoints
  async getAnalytics() {
    return this.request('/analytics/overview');
  }

  // Feedback endpoints
  async submitFeedback(feedbackData) {
    return this.request('/feedback/submit', {
      method: 'POST',
      body: JSON.stringify(feedbackData)
    });
  }

  // Admin endpoints
  async adminLogin(email, password) {
    return this.request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async createCoAdmin(data) {
    return this.request('/admin/create-coadmin', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getCoAdmins() {
    return this.request('/admin/coadmins');
  }

  async deleteCoAdmin(id) {
    return this.request(`/admin/coadmin/${id}`, {
      method: 'DELETE'
    });
  }

  async addQuestion(questionData) {
    return this.request('/admin/questions', {
      method: 'POST',
      body: JSON.stringify(questionData)
    });
  }

  async bulkImportQuestions(csvData, exam, subject, chapter) {
    return this.request('/admin/questions/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ csvData, exam, subject, chapter })
    });
  }

  async searchQuestions(filters) {
    const params = new URLSearchParams(filters);
    return this.request(`/admin/questions/search?${params}`);
  }

  async updateQuestion(id, data) {
    return this.request(`/admin/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteQuestion(id) {
    return this.request(`/admin/questions/${id}`, {
      method: 'DELETE'
    });
  }

  async generateGiftCodes(count, duration) {
    return this.request('/admin/giftcodes/generate', {
      method: 'POST',
      body: JSON.stringify({ count, duration })
    });
  }
  // js/api.js - Add these new methods to your existing API class

// Add these methods to the API class:

// Check if user exists
async checkUser(email, phone) {
  return this.request('/auth/check-user', {
    method: 'POST',
    body: JSON.stringify({ email, phone })
  });
}

// Login with password
async loginWithPassword(email, phone, password) {
  return this.request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, phone, password })
  });
}

// Updated: Send OTP (only for registration)
async sendOTP(email, phone) {
  return this.request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email, phone })
  });
}

// Updated: Verify OTP with password (for registration)
async verifyOTP(email, phone, otp, password) {
  return this.request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, phone, otp, password })
  });
}
}

// Export singleton instance
const api = new API();

// Helper: Check if user is logged in
function isLoggedIn() {
  return !!localStorage.getItem('authToken');
}

// Helper: Get current user
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

// Helper: Save current user
function saveCurrentUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// Helper: Logout
function logout() {
  api.clearToken();
  localStorage.clear();
  window.location.href = '/pages/index.html';
}

// Helper: Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Helper: Show loading spinner
function showLoading() {
  const loader = document.getElementById('loading-spinner');
  if (loader) loader.style.display = 'flex';
}

function hideLoading() {
  const loader = document.getElementById('loading-spinner');
  if (loader) loader.style.display = 'none';
}