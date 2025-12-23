// Mock Test Logic with Offline Support
let mockTestData = null;
let currentQuestionIndex = 0;
let answers = [];
let flaggedQuestions = new Set();
let timerInterval = null;
let remainingTime = 0;

window.addEventListener('DOMContentLoaded', async () => {
    const testId = sessionStorage.getItem('mockTestId');
    if (!testId) {
        window.history.back();
        return;
    }

    await loadMockTest(testId);
});

// Load Complete Mock Test (All Data for Offline)
async function loadMockTest(testId) {
    showLoading();

    try {
        const response = await api.startMockTest(testId);
        hideLoading();

        if (response.success) {
            mockTestData = response.mockTest;
            remainingTime = mockTestData.duration * 60; // Convert to seconds

            // Initialize answers array
            answers = new Array(mockTestData.totalQuestions).fill(null);

            // Setup UI
            document.getElementById('test-name').textContent = mockTestData.name;
            generateQuestionGrid();
            startTimer();
            loadQuestion(0);

            // Store in localStorage for offline access
            localStorage.setItem('currentMockTest', JSON.stringify({
                data: mockTestData,
                answers,
                flagged: Array.from(flaggedQuestions),
                startTime: Date.now(),
                remainingTime
            }));
        }
    } catch (error) {
        hideLoading();
        showToast(error.message || 'Failed to load mock test', 'error');
    }
}

// Generate Question Grid
function generateQuestionGrid() {
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';

    for (let i = 0; i < mockTestData.totalQuestions; i++) {
        const block = document.createElement('div');
        block.className = 'question-block unanswered';
        block.textContent = i + 1;
        block.onclick = () => loadQuestion(i);
        grid.appendChild(block);
    }
}

// Load Specific Question
function loadQuestion(index) {
    currentQuestionIndex = index;
    const question = mockTestData.questions[index];

    document.getElementById('question-num').textContent = index + 1;
    document.getElementById('subject-badge').textContent = question.subject;
    document.getElementById('mock-question-text').textContent = question.questionText;

    // Update active block
    document.querySelectorAll('.question-block').forEach((block, i) => {
        block.classList.toggle('active', i === index);
    });

    // Show question image if exists
    const imageDiv = document.getElementById('mock-question-image');
    if (question.questionImageUrl) {
        imageDiv.innerHTML = `<img src="${question.questionImageUrl}" style="max-width: 100%;">`;
        imageDiv.style.display = 'block';
    } else {
        imageDiv.style.display = 'none';
    }

    // Show appropriate input
    if (question.questionType === 'MCQ') {
        showMCQOptions(question.options, answers[index]);
    } else {
        showNumericalInput(answers[index]);
    }
}

// Timer
function startTimer() {
    timerInterval = setInterval(() => {
        remainingTime--;

        const hours = Math.floor(remainingTime / 3600);
        const minutes = Math.floor((remainingTime % 3600) / 60);
        const seconds = remainingTime % 60;

        document.getElementById('timer').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (remainingTime <= 0) {
            clearInterval(timerInterval);
            submitMockTest();
        }

        // Save progress every 30 seconds
        if (remainingTime % 30 === 0) {
            saveProgress();
        }
    }, 1000);
}

// Submit Mock Test
async function submitMockTest() {
    if (!confirm('Are you sure you want to submit the test?')) return;

    clearInterval(timerInterval);
    showLoading();

    const timeTaken = (mockTestData.duration * 60) - remainingTime;

    try {
        const response = await api.submitMockTest(
            mockTestData._id,
            answers.map((ans, i) => ({
                questionNumber: i + 1,
                selectedAnswer: ans
            })),
            timeTaken
        );

        hideLoading();

        if (response.success) {
            // Clear stored data
            localStorage.removeItem('currentMockTest');
            sessionStorage.removeItem('mockTestId');

            // Show results
            alert(`Test Submitted!\n\nScore: ${response.results.score}\nCorrect: ${response.results.correctAnswers}\nWrong: ${response.results.wrongAnswers}`);
            
            window.location.href = getCurrentUser().selectedExam === 'JEE' 
                ? '/pages/jee-dashboard.html' 
                : '/pages/neet-dashboard.html';
        }
    } catch (error) {
        hideLoading();
        // If offline, save locally and sync later
        if (!navigator.onLine) {
            localStorage.setItem('pendingMockTestSubmission', JSON.stringify({
                testId: mockTestData._id,
                answers,
                timeTaken
            }));
            showToast('Test saved. Will sync when online.', 'info');
        } else {
            showToast(error.message || 'Failed to submit test', 'error');
        }
    }
}
// Show MCQ Options
function showMCQOptions(options, currentAnswer) {
    const container = document.getElementById('mock-options');
    container.innerHTML = '';
    container.style.display = 'block';
    
    options.forEach(option => {
        const optionEl = document.createElement('div');
        optionEl.className = 'option';
        if (currentAnswer === option.label) {
            optionEl.classList.add('selected');
        }
        optionEl.innerHTML = `
            <span class="option-label">${option.label}</span>
            <span class="option-text">${option.text}</span>
        `;
        optionEl.onclick = () => selectAnswer(option.label);
        container.appendChild(optionEl);
    });
}

// Show Numerical Input
function showNumericalInput(currentAnswer) {
    const container = document.getElementById('mock-numerical');
    container.style.display = 'block';
    document.getElementById('mock-numerical-answer').value = currentAnswer || '';
    document.getElementById('mock-options').style.display = 'none';
}

// Select Answer
function selectAnswer(answer) {
    answers[currentQuestionIndex] = answer;
    
    // Update question block status
    const block = document.querySelectorAll('.question-block')[currentQuestionIndex];
    block.classList.remove('unanswered');
    block.classList.add('answered');
    
    // Update UI
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    event.target.closest('.option').classList.add('selected');
    
    saveProgress();
}

// Save and Next
function saveAndNext() {
    // Save numerical answer if applicable
    const numericalInput = document.getElementById('mock-numerical-answer');
    if (numericalInput.style.display !== 'none' && numericalInput.value) {
        answers[currentQuestionIndex] = numericalInput.value;
    }
    
    // Move to next question
    if (currentQuestionIndex < mockTestData.totalQuestions - 1) {
        loadQuestion(currentQuestionIndex + 1);
    }
}

// Clear Response
function clearResponse() {
    answers[currentQuestionIndex] = null;
    const block = document.querySelectorAll('.question-block')[currentQuestionIndex];
    block.classList.add('unanswered');
    block.classList.remove('answered', 'flagged');
    
    // Clear UI
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    document.getElementById('mock-numerical-answer').value = '';
}

// Flag Question
function flagQuestion() {
    const block = document.querySelectorAll('.question-block')[currentQuestionIndex];
    block.classList.toggle('flagged');
    
    if (block.classList.contains('flagged')) {
        flaggedQuestions.add(currentQuestionIndex);
    } else {
        flaggedQuestions.delete(currentQuestionIndex);
    }
    
    saveProgress();
}

// Save Progress
function saveProgress() {
    localStorage.setItem('currentMockTest', JSON.stringify({
        data: mockTestData,
        answers,
        flagged: Array.from(flaggedQuestions),
        currentIndex: currentQuestionIndex,
        remainingTime
    }));
}