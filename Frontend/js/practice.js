// js/practice.js - Question Practice Logic

let questions = [];
let currentQuestionIndex = 0;
let currentQuestion = null;
let startTime = Date.now();
let selectedAnswer = null;

// Initialize Practice
window.addEventListener('DOMContentLoaded', async () => {
  if (!isLoggedIn()) {
    window.location.href = '/pages/login.html';
    return;
  }
  
  const filters = JSON.parse(sessionStorage.getItem('practiceFilters'));
  
  if (!filters) {
    showToast('No practice session found', 'error');
    window.history.back();
    return;
  }
  
  await loadQuestions(filters);
});

// Load Questions (30 at a time)
async function loadQuestions(filters) {
  showLoading();
  
  try {
    const user = getCurrentUser();
    const response = await api.getPracticeQuestions({
      exam: user.selectedExam,
      subject: filters.subject,
      chapters: [filters.chapter],
      topics: filters.topics.includes('all') ? [] : filters.topics,
      questionTypes: filters.questionTypes.includes('all') ? [] : filters.questionTypes,
      offset: 0
    });
    
    hideLoading();
    
    if (response.success && response.questions.length > 0) {
      questions = response.questions;
      
      // Update header
      document.getElementById('practice-title').textContent = filters.subject;
      document.getElementById('practice-subtitle').textContent = filters.chapter;
      
      // Load first question
      loadQuestion(0);
    } else {
      showToast('No unattempted questions available', 'info');
      setTimeout(() => window.history.back(), 2000);
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to load questions', 'error');
  }
}

// Load Specific Question
function loadQuestion(index) {
  if (index >= questions.length) {
    showToast('All questions completed!', 'success');
    setTimeout(() => window.history.back(), 2000);
    return;
  }
  
  currentQuestionIndex = index;
  currentQuestion = questions[index];
  selectedAnswer = null;
  startTime = Date.now();
  
  // Hide result card
  document.getElementById('result-card').style.display = 'none';
  document.querySelector('.question-card').style.display = 'block';
  
  // Update counter
  document.getElementById('question-counter').textContent = `${index + 1} / ${questions.length}`;
  document.getElementById('current-question-num').textContent = index + 1;
  
  // Update type badge
  document.getElementById('question-type').textContent = currentQuestion.questionType;
  
  // Update question text
  document.getElementById('question-text').textContent = currentQuestion.questionText;
  
  // Show/hide image container
  const imageContainer = document.getElementById('question-image-container');
  if (currentQuestion.questionImageUrl) {
    imageContainer.style.display = 'block';
    document.getElementById('question-image').style.display = 'none';
    document.getElementById('question-image').innerHTML = '';
  } else {
    imageContainer.style.display = 'none';
  }
  
  // Show appropriate input type
  if (currentQuestion.questionType === 'MCQ') {
    document.getElementById('mcq-options').style.display = 'block';
    document.getElementById('numerical-input').style.display = 'none';
    
    // Load options
    currentQuestion.options.forEach(option => {
      const optionEl = document.querySelector(`.option[data-option="${option.label}"]`);
      optionEl.querySelector('.option-text').textContent = option.text;
      optionEl.classList.remove('selected');
    });
  } else {
    document.getElementById('mcq-options').style.display = 'none';
    document.getElementById('numerical-input').style.display = 'block';
    document.getElementById('numerical-answer').value = '';
  }
}

// Load Question Image
async function loadQuestionImage() {
  try {
    const response = await api.getQuestionImage(currentQuestion._id);
    
    if (response.success && response.imageUrl) {
      const imageDiv = document.getElementById('question-image');
      imageDiv.innerHTML = `<img src="${response.imageUrl}" alt="Question Diagram" style="max-width: 100%; border-radius: 8px;">`;
      imageDiv.style.display = 'block';
    }
  } catch (error) {
    showToast('Failed to load image', 'error');
  }
}

// Select MCQ Option
function selectOption(option) {
  selectedAnswer = option;
  
  // Remove previous selection
  document.querySelectorAll('.option').forEach(opt => {
    opt.classList.remove('selected');
  });
  
  // Add selection
  document.querySelector(`.option[data-option="${option}"]`).classList.add('selected');
}

// Skip Question
function skipQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
    loadQuestion(currentQuestionIndex + 1);
  } else {
    showToast('No more questions', 'info');
  }
}

// Submit Answer
async function submitAnswer() {
  let userAnswer = null;
  
  if (currentQuestion.questionType === 'MCQ') {
    userAnswer = selectedAnswer;
    if (!userAnswer) {
      showToast('Please select an option', 'error');
      return;
    }
  } else {
    userAnswer = document.getElementById('numerical-answer').value;
    if (!userAnswer) {
      showToast('Please enter your answer', 'error');
      return;
    }
  }
  
  const timeTaken = Math.floor((Date.now() - startTime) / 1000);
  
  showLoading();
  
  try {
    const response = await api.verifyAnswer(
      currentQuestion._id,
      userAnswer,
      timeTaken
    );
    
    hideLoading();
    
    if (response.success) {
      showResult(response);
    }
  } catch (error) {
    hideLoading();
    
    if (error.message.includes('limit')) {
      showToast(error.message, 'warning');
      setTimeout(() => {
        window.location.href = getCurrentUser().selectedExam === 'JEE' 
          ? '/pages/jee-dashboard.html' 
          : '/pages/neet-dashboard.html';
      }, 3000);
    } else {
      showToast(error.message || 'Failed to submit answer', 'error');
    }
  }
}

// Show Result
function showResult(result) {
  // Hide question card
  document.querySelector('.question-card').style.display = 'none';
  
  // Show result card
  const resultCard = document.getElementById('result-card');
  resultCard.style.display = 'block';
  
  // Update result icon and title
  const icon = document.getElementById('result-icon');
  const title = document.getElementById('result-title');
  
  if (result.isCorrect) {
    icon.innerHTML = `
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="#10b981"/>
        <path d="M25 40L35 50L55 30" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>
      </svg>
    `;
    title.textContent = 'Correct! 🎉';
    title.style.color = '#10b981';
  } else {
    icon.innerHTML = `
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="#ef4444"/>
        <path d="M25 25L55 55M55 25L25 55" stroke="white" stroke-width="5" stroke-linecap="round"/>
      </svg>
    `;
    title.textContent = 'Incorrect';
    title.style.color = '#ef4444';
  }
  
  // Update answers
  document.getElementById('user-answer').textContent = selectedAnswer || document.getElementById('numerical-answer').value;
  document.getElementById('correct-answer').textContent = result.correctAnswer;
  
  // Show question again
  document.getElementById('result-question-text').textContent = result.questionText;
  
  // Show options if MCQ
  const resultOptions = document.getElementById('result-options');
  if (result.options && result.options.length > 0) {
    resultOptions.style.display = 'block';
    resultOptions.innerHTML = '';
    
    result.options.forEach(option => {
      const optionEl = document.createElement('div');
      optionEl.className = 'option';
      
      if (option.label === result.correctAnswer) {
        optionEl.classList.add('correct');
      }
      
      optionEl.innerHTML = `
        <span class="option-label">${option.label}</span>
        <span class="option-text">${option.text}</span>
      `;
      
      resultOptions.appendChild(optionEl);
    });
  } else {
    resultOptions.style.display = 'none';
  }
}

// Next Question
function nextQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
    loadQuestion(currentQuestionIndex + 1);
  } else {
    showToast('Practice session completed!', 'success');
    setTimeout(() => {
      window.location.href = getCurrentUser().selectedExam === 'JEE' 
        ? '/pages/jee-dashboard.html' 
        : '/pages/neet-dashboard.html';
    }, 2000);
  }
}

// Exit Practice
function exitPractice() {
  if (confirm('Are you sure you want to exit? Your progress will be saved.')) {
    window.history.back();
  }
}

// Add CSS for practice page
const practiceStyle = document.createElement('style');
practiceStyle.textContent = `
  .practice-page {
    min-height: 100vh;
    background: var(--bg-secondary);
  }
  
  .practice-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
  }
  
  .practice-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
    padding: 20px;
    background: var(--bg-primary);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-sm);
  }
  
  .practice-info h3 {
    margin-bottom: 4px;
    color: var(--text-primary);
  }
  
  .practice-info p {
    color: var(--text-secondary);
    font-size: 14px;
  }
  
  .practice-stats {
    font-size: 18px;
    font-weight: 600;
    color: var(--primary);
  }
  
  .question-card {
    background: var(--bg-primary);
    border-radius: var(--border-radius-lg);
    padding: 32px;
    box-shadow: var(--shadow-lg);
  }
  
  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  
  .question-type-badge {
    padding: 6px 12px;
    background: var(--primary);
    color: white;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  
  .question-number {
    color: var(--text-secondary);
    font-weight: 600;
  }
  
  .question-content {
    margin-bottom: 32px;
  }
  
  .question-text {
    font-size: 18px;
    line-height: 1.8;
    color: var(--text-primary);
    margin-bottom: 20px;
  }
  
  .options-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }
  
  .option {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: var(--transition);
  }
  
  .option:hover {
    border-color: var(--primary);
    background: var(--bg-secondary);
  }
  
  .option.selected {
    border-color: var(--primary);
    background: rgba(99, 102, 241, 0.1);
  }
  
  .option.correct {
    border-color: var(--success);
    background: rgba(16, 185, 129, 0.1);
  }
  
  .option-label {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border-radius: 50%;
    font-weight: 700;
    flex-shrink: 0;
  }
  
  .option.selected .option-label {
    background: var(--primary);
    color: white;
  }
  
  .option.correct .option-label {
    background: var(--success);
    color: white;
  }
  
  .option-text {
    flex: 1;
    font-size: 16px;
  }
  
  .numerical-container {
    margin-bottom: 24px;
  }
  
  .numerical-container label {
    display: block;
    margin-bottom: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .numerical-container input {
    width: 100%;
    padding: 16px;
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 18px;
  }
  
  .question-actions {
    display: flex;
    gap: 12px;
  }
  
  .question-actions .btn {
    flex: 1;
  }
  
  .result-card {
    background: var(--bg-primary);
    border-radius: var(--border-radius-lg);
    padding: 40px;
    box-shadow: var(--shadow-lg);
    text-align: center;
  }
  
  .result-icon {
    margin-bottom: 24px;
    animation: scaleIn 0.5s ease;
  }
  
  .result-card h3 {
    font-size: 28px;
    margin-bottom: 24px;
  }
  
  .result-details {
    background: var(--bg-secondary);
    padding: 20px;
    border-radius: var(--border-radius);
    margin-bottom: 24px;
    text-align: left;
  }
  
  .result-details p {
    margin-bottom: 12px;
    font-size: 16px;
  }
  
  .result-question {
    text-align: left;
    margin-bottom: 24px;
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
`;
document.head.appendChild(practiceStyle);