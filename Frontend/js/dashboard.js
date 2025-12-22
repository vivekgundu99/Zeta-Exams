// js/dashboard.js - Dashboard Logic

let accountMenuOpen = false;

// Initialize Dashboard
window.addEventListener('DOMContentLoaded', async () => {
  if (!isLoggedIn()) {
    window.location.href = '/pages/login.html';
    return;
  }
  
  await loadUserProfile();
  await loadDailyLimits();
  await loadFilters();
  
  // Check subscription for locked features
  checkFeatureAccess();
});

// Load User Profile
async function loadUserProfile() {
  try {
    const response = await api.getUserProfile();
    
    if (response.success) {
      const user = response.user;
      saveCurrentUser(user);
      
      // Update UI
      document.getElementById('user-greeting').textContent = `Welcome back, ${user.name || 'Student'}!`;
      document.getElementById('account-name').textContent = user.name || 'Student';
      document.getElementById('account-email').textContent = user.email;
      
      // Update subscription badge
      const badge = document.getElementById('subscription-badge');
      badge.querySelector('#subscription-type').textContent = user.subscriptionType.toUpperCase();
      badge.classList.add(user.subscriptionType);
      
      // Update life ambition
      if (user.lifeAmbition) {
        document.getElementById('life-ambition').textContent = user.lifeAmbition;
      } else {
        document.getElementById('goal-section').style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Failed to load profile:', error);
  }
}

// Load Daily Limits
async function loadDailyLimits() {
  try {
    const response = await api.checkLimits();
    
    if (response.success) {
      // Questions
      document.getElementById('questions-used').textContent = response.usage.questionsAttempted;
      document.getElementById('questions-limit').textContent = response.limits.questions;
      const questionsPercent = (response.usage.questionsAttempted / response.limits.questions) * 100;
      document.getElementById('questions-progress').style.width = questionsPercent + '%';
      
      // Chapter Tests
      document.getElementById('tests-used').textContent = response.usage.chapterTestsGenerated;
      document.getElementById('tests-limit').textContent = response.limits.chapterTests;
      const testsPercent = response.limits.chapterTests > 0 
        ? (response.usage.chapterTestsGenerated / response.limits.chapterTests) * 100 
        : 0;
      document.getElementById('tests-progress').style.width = testsPercent + '%';
      
      // Mock Tests
      document.getElementById('mock-used').textContent = response.usage.mockTestsAttempted;
      document.getElementById('mock-limit').textContent = response.limits.mockTests;
      const mockPercent = response.limits.mockTests > 0 
        ? (response.usage.mockTestsAttempted / response.limits.mockTests) * 100 
        : 0;
      document.getElementById('mock-progress').style.width = mockPercent + '%';
    }
  } catch (error) {
    console.error('Failed to load limits:', error);
  }
}

// Check Feature Access
function checkFeatureAccess() {
  const user = getCurrentUser();
  const subscription = user.subscriptionType;
  
  // Formulas & Flashcards - Gold only
  const formulasSection = document.getElementById('formulas-section');
  if (subscription !== 'gold') {
    formulasSection.querySelector('.locked-overlay').style.display = 'flex';
  } else {
    formulasSection.querySelector('.locked-overlay').style.display = 'none';
    loadFormulas();
  }
  
  // Mock Tests - Gold only
  const mockSection = document.getElementById('mock-tests-section');
  if (subscription !== 'gold') {
    mockSection.querySelector('.locked-overlay').style.display = 'flex';
  } else {
    mockSection.querySelector('.locked-overlay').style.display = 'none';
    loadMockTests();
  }
}

// Load Filters (Subjects)
async function loadFilters() {
  const user = getCurrentUser();
  const exam = user.selectedExam;
  
  try {
    const response = await api.getFilters(exam);
    
    if (response.success) {
      const subjectSelect = document.getElementById('subject');
      subjectSelect.innerHTML = '<option value="">Select Subject</option>';
      
      response.subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        subjectSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Failed to load subjects:', error);
  }
}

// Load Chapters
async function loadChapters() {
  const user = getCurrentUser();
  const exam = user.selectedExam;
  const subject = document.getElementById('subject').value;
  
  const chapterSelect = document.getElementById('chapter');
  const topicSelect = document.getElementById('topic');
  
  chapterSelect.innerHTML = '<option value="">Select Chapter</option>';
  topicSelect.innerHTML = '<option value="all">All Topics</option>';
  chapterSelect.disabled = !subject;
  topicSelect.disabled = true;
  
  if (!subject) return;
  
  try {
    const response = await api.getChapters(exam, subject);
    
    if (response.success) {
      response.chapters.forEach(chapter => {
        const option = document.createElement('option');
        option.value = chapter;
        option.textContent = chapter;
        chapterSelect.appendChild(option);
      });
      
      chapterSelect.disabled = false;
    }
  } catch (error) {
    console.error('Failed to load chapters:', error);
  }
}

// Load Topics
async function loadTopics() {
  const user = getCurrentUser();
  const exam = user.selectedExam;
  const subject = document.getElementById('subject').value;
  const chapter = document.getElementById('chapter').value;
  
  const topicSelect = document.getElementById('topic');
  topicSelect.innerHTML = '<option value="all">All Topics</option>';
  topicSelect.disabled = !chapter;
  
  if (!chapter) return;
  
  try {
    const response = await api.getTopics(exam, subject, chapter);
    
    if (response.success) {
      response.topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        topicSelect.appendChild(option);
      });
      
      topicSelect.disabled = false;
    }
  } catch (error) {
    console.error('Failed to load topics:', error);
  }
}

// Start Practice
function startPractice() {
  const subject = document.getElementById('subject').value;
  const chapter = document.getElementById('chapter').value;
  
  if (!subject || !chapter) {
    showToast('Please select subject and chapter', 'error');
    return;
  }
  
  // Get selected topics
  const topicSelect = document.getElementById('topic');
  const selectedTopics = Array.from(topicSelect.selectedOptions).map(opt => opt.value);
  
  // Get selected question types
  const typeSelect = document.getElementById('questionType');
  const selectedTypes = Array.from(typeSelect.selectedOptions).map(opt => opt.value);
  
  // Store in sessionStorage and navigate
  sessionStorage.setItem('practiceFilters', JSON.stringify({
    subject,
    chapter,
    topics: selectedTopics,
    questionTypes: selectedTypes
  }));
  
  window.location.href = '/pages/practice.html';
}

// Generate Small Test
async function generateSmallTest() {
  const user = getCurrentUser();
  const subject = document.getElementById('subject').value;
  const chapter = document.getElementById('chapter').value;
  
  if (!subject || !chapter) {
    showToast('Please select subject and chapter', 'error');
    return;
  }
  
  // Get selected topics
  const topicSelect = document.getElementById('topic');
  const selectedTopics = Array.from(topicSelect.selectedOptions).map(opt => opt.value);
  
  showLoading();
  
  try {
    const response = await api.generateTest({
      exam: user.selectedExam,
      subject,
      chapters: [chapter],
      topics: selectedTopics.includes('all') ? [] : selectedTopics
    });
    
    hideLoading();
    
    if (response.success) {
      // Store test data and navigate
      sessionStorage.setItem('smallTest', JSON.stringify(response.questions));
      window.location.href = '/pages/test.html';
    }
  } catch (error) {
    hideLoading();
    if (error.message.includes('limit')) {
      showToast(error.message, 'warning');
    } else {
      showToast(error.message || 'Failed to generate test', 'error');
    }
  }
}

// Load Mock Tests
async function loadMockTests() {
  const user = getCurrentUser();
  
  try {
    const response = await api.getMockTests(user.selectedExam);
    
    if (response.success) {
      const listEl = document.getElementById('mock-tests-list');
      listEl.innerHTML = '';
      listEl.style.display = 'block';
      
      response.mockTests.forEach(test => {
        const card = document.createElement('div');
        card.className = 'mock-test-card';
        card.innerHTML = `
          <div class="mock-test-info">
            <h4>${test.name}</h4>
            <p>${test.totalQuestions} Questions • ${test.duration} Minutes</p>
          </div>
          <div class="mock-test-status">
            <span class="status-badge ${test.status}">${test.status.toUpperCase()}</span>
          </div>
          <div class="mock-test-actions">
            ${test.status === 'unattempted' 
              ? `<button class="btn btn-primary" onclick="startMockTest('${test._id}')">Attempt Test</button>`
              : `<button class="btn btn-outline" onclick="reviewMockTest('${test._id}')">Review Answers</button>`
            }
          </div>
        `;
        listEl.appendChild(card);
      });
    }
  } catch (error) {
    console.error('Failed to load mock tests:', error);
  }
}

// Start Mock Test
function startMockTest(testId) {
  sessionStorage.setItem('mockTestId', testId);
  window.location.href = '/pages/mock-test.html';
}

// Review Mock Test
function reviewMockTest(testId) {
  window.location.href = `/pages/mock-review.html?id=${testId}`;
}

// Load Formulas
async function loadFormulas() {
  // This will be implemented when formula endpoints are ready
  console.log('Loading formulas...');
}

// Toggle Account Menu
function openAccountMenu() {
  const menu = document.getElementById('account-menu');
  accountMenuOpen = !accountMenuOpen;
  
  if (accountMenuOpen) {
    menu.classList.add('show');
  } else {
    menu.classList.remove('show');
  }
}

// Close account menu when clicking outside
document.addEventListener('click', (e) => {
  const menu = document.getElementById('account-menu');
  const accountBtn = document.querySelector('.header-right .icon-btn:last-child');
  
  if (accountMenuOpen && !menu.contains(e.target) && !accountBtn.contains(e.target)) {
    menu.classList.remove('show');
    accountMenuOpen = false;
  }
});

// Add CSS for mock test cards
const mockTestStyle = document.createElement('style');
mockTestStyle.textContent = `
  .mock-test-card {
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    padding: 20px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  
  .mock-test-info h4 {
    margin-bottom: 8px;
    color: var(--text-primary);
  }
  
  .mock-test-info p {
    color: var(--text-secondary);
    font-size: 14px;
  }
  
  .status-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-badge.unattempted {
    background: var(--gray-200);
    color: var(--gray-700);
  }
  
  .status-badge.attempted {
    background: var(--success);
    color: white;
  }
`;
document.head.appendChild(mockTestStyle);
// Load Attempted Questions
async function loadAttemptedQuestions() {
  try {
    const response = await api.getUserProfile();
    
    if (response.success) {
      const user = response.user;
      const attempted = user.attemptedQuestions || [];
      
      // Calculate stats
      const total = attempted.length;
      const correct = attempted.filter(q => q.isCorrect).length;
      const wrong = total - correct;
      const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;
      
      // Update stats
      document.getElementById('total-attempted').textContent = total;
      document.getElementById('total-correct').textContent = correct;
      document.getElementById('total-wrong').textContent = wrong;
      document.getElementById('accuracy-percent').textContent = accuracy + '%';
      
      // Store data for viewing
      sessionStorage.setItem('attemptedQuestions', JSON.stringify(attempted));
      
      // Redirect to attempted questions page
      window.location.href = '/pages/attempted-questions.html';
    }
  } catch (error) {
    showToast('Failed to load attempted questions', 'error');
  }
}

function filterAttemptedQuestions() {
  // Filter logic for attempted questions
  loadAttemptedQuestions();
}