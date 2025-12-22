// js/admin.js - Admin Dashboard Logic

// Initialize Admin Dashboard
window.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    window.location.href = '/pages/admin-login.html';
    return;
  }
  
  // Load initial tab
  await adminLoadQuestions();
});

// Switch Tabs
function switchTab(tabName) {
  // Remove active from all nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Add active to clicked nav item
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Show selected tab content
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  // Load data for specific tabs
  switch(tabName) {
    case 'questions':
      adminLoadQuestions();
      break;
    case 'coadmins':
      loadCoAdmins();
      break;
    case 'feedback':
      loadFeedback();
      break;
  }
}

// Load Questions
async function adminLoadQuestions() {
  const exam = document.getElementById('filter-exam').value;
  const subject = document.getElementById('filter-subject').value;
  
  showLoading();
  
  try {
    const response = await api.searchQuestions({ exam, subject });
    
    hideLoading();
    
    if (response.success) {
      const listEl = document.getElementById('questions-list');
      listEl.innerHTML = '';
      
      if (response.questions.length === 0) {
        listEl.innerHTML = '<p class="text-muted text-center">No questions found</p>';
        return;
      }
      
      response.questions.forEach(q => {
        const row = document.createElement('div');
        row.className = 'data-row';
        row.innerHTML = `
          <div class="data-cell">
            <strong>${q.exam} - ${q.subject}</strong>
            <p>${q.chapter} / ${q.topic}</p>
          </div>
          <div class="data-cell">
            <p class="question-preview">${q.questionText.substring(0, 100)}...</p>
            <span class="badge">${q.questionType}</span>
          </div>
          <div class="data-cell actions">
            <button class="btn btn-sm btn-outline" onclick="editQuestion('${q._id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteQuestion('${q._id}')">Delete</button>
          </div>
        `;
        listEl.appendChild(row);
      });
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to load questions', 'error');
  }
}

// Search Questions
let searchTimeout;
function adminSearchQuestions() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(adminLoadQuestions, 500);
}

// Bulk Import Questions
async function bulkImportQuestions() {
  const exam = document.getElementById('import-exam').value;
  const subject = document.getElementById('import-subject').value.trim();
  const chapter = document.getElementById('import-chapter').value.trim();
  const csvData = document.getElementById('import-csv').value.trim();
  
  if (!subject || !chapter || !csvData) {
    showToast('Please fill all fields', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const response = await api.bulkImportQuestions(csvData, exam, subject, chapter);
    
    hideLoading();
    
    if (response.success) {
      showToast(`${response.count} questions imported successfully!`, 'success');
      
      // Clear form
      document.getElementById('import-csv').value = '';
      
      // Reload questions
      switchTab('questions');
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to import questions', 'error');
  }
}

// Generate Gift Codes
async function generateGiftCodes() {
  const count = parseInt(document.getElementById('gift-count').value);
  const duration = document.getElementById('gift-duration').value;
  
  if (!count || count < 1 || count > 100) {
    showToast('Please enter a valid number (1-100)', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const response = await api.generateGiftCodes(count, duration);
    
    hideLoading();
    
    if (response.success) {
      showToast(`${count} gift codes generated!`, 'success');
      
      // Display codes
      const resultEl = document.getElementById('gift-codes-result');
      resultEl.innerHTML = '<h3>Generated Codes:</h3>';
      
      const codesList = document.createElement('div');
      codesList.className = 'codes-grid';
      
      response.codes.forEach(code => {
        const codeEl = document.createElement('div');
        codeEl.className = 'gift-code-item';
        codeEl.innerHTML = `
          <code>${code}</code>
          <button class="btn btn-sm btn-text" onclick="copyToClipboard('${code}')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2H10L14 6V14H4V2ZM10 6H14L10 2V6Z"/>
            </svg>
          </button>
        `;
        codesList.appendChild(codeEl);
      });
      
      resultEl.appendChild(codesList);
      
      // Add download button
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn-primary btn-block';
      downloadBtn.textContent = 'Download as CSV';
      downloadBtn.onclick = () => downloadGiftCodes(response.codes);
      resultEl.appendChild(downloadBtn);
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to generate gift codes', 'error');
  }
}

// Copy to Clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast('Copied to clipboard!', 'success');
}

// Download Gift Codes
function downloadGiftCodes(codes) {
  const csv = codes.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gift-codes-${Date.now()}.csv`;
  a.click();
}

// Load Co-Admins
async function loadCoAdmins() {
  showLoading();
  
  try {
    const response = await api.getCoAdmins();
    
    hideLoading();
    
    if (response.success) {
      const listEl = document.getElementById('coadmins-list');
      listEl.innerHTML = '';
      
      if (response.coAdmins.length === 0) {
        listEl.innerHTML = '<p class="text-muted text-center">No co-admins found</p>';
        return;
      }
      
      response.coAdmins.forEach(admin => {
        const row = document.createElement('div');
        row.className = 'data-row';
        row.innerHTML = `
          <div class="data-cell">
            <strong>${admin.name}</strong>
            <p>${admin.email}</p>
          </div>
          <div class="data-cell">
            <span class="badge ${admin.isActive ? 'success' : 'danger'}">
              ${admin.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div class="data-cell actions">
            <button class="btn btn-sm btn-danger" onclick="deleteCoAdmin('${admin._id}')">
              Remove
            </button>
          </div>
        `;
        listEl.appendChild(row);
      });
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to load co-admins', 'error');
  }
}

// Delete Co-Admin
async function deleteCoAdmin(id) {
  if (!confirm('Are you sure you want to remove this co-admin?')) return;
  
  showLoading();
  
  try {
    const response = await api.deleteCoAdmin(id);
    
    hideLoading();
    
    if (response.success) {
      showToast('Co-admin removed successfully', 'success');
      loadCoAdmins();
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to remove co-admin', 'error');
  }
}

// Load Feedback
async function loadFeedback() {
  // Placeholder - implement when feedback endpoint is ready
  const listEl = document.getElementById('feedback-list');
  listEl.innerHTML = '<p class="text-muted text-center">Feedback functionality coming soon</p>';
}

// Export Refunds
function exportRefunds() {
  showToast('Exporting refund requests...', 'info');
  // Implementation for exporting refund requests to Excel
}

// Show Add Co-Admin Modal
function showAddCoAdminModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add Co-Admin</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="coadmin-name" placeholder="Full Name">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="coadmin-email" placeholder="email@example.com">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="coadmin-password" placeholder="Enter password">
        </div>
        <button class="btn btn-primary btn-block" onclick="createCoAdmin()">
          Create Co-Admin
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'flex';
}

// Create Co-Admin
async function createCoAdmin() {
  const name = document.getElementById('coadmin-name').value.trim();
  const email = document.getElementById('coadmin-email').value.trim();
  const password = document.getElementById('coadmin-password').value;
  
  if (!name || !email || !password) {
    showToast('Please fill all fields', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const response = await api.createCoAdmin({ name, email, password });
    
    hideLoading();
    
    if (response.success) {
      showToast('Co-admin created successfully!', 'success');
      document.querySelector('.modal').remove();
      loadCoAdmins();
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to create co-admin', 'error');
  }
}

// Delete Question
async function deleteQuestion(id) {
  if (!confirm('Are you sure you want to delete this question?')) return;
  
  showLoading();
  
  try {
    const response = await api.deleteQuestion(id);
    
    hideLoading();
    
    if (response.success) {
      showToast('Question deleted successfully', 'success');
      adminLoadQuestions();
    }
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Failed to delete question', 'error');
  }
}

// Add CSS for Admin Panel
const adminStyle = document.createElement('style');
adminStyle.textContent = `
  .admin-page {
    min-height: 100vh;
    background: var(--bg-secondary);
  }
  
  .admin-header {
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
    padding: 20px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .admin-layout {
    display: flex;
    min-height: calc(100vh - 80px);
  }
  
  .admin-sidebar {
    width: 260px;
    background: var(--bg-primary);
    border-right: 1px solid var(--border-color);
    padding: 24px 0;
  }
  
  .admin-nav {
    display: flex;
    flex-direction: column;
  }
  
  .nav-item {
    padding: 16px 24px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text-secondary);
    transition: var(--transition);
    font-weight: 500;
  }
  
  .nav-item:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .nav-item.active {
    background: var(--primary);
    color: white;
  }
  
  .admin-content {
    flex: 1;
    padding: 32px;
  }
  
  .tab-content {
    display: none;
  }
  
  .tab-content.active {
    display: block;
    animation: fadeIn 0.3s ease;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  
  .search-filters {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }
  
  .search-filters select,
  .search-filters input {
    padding: 10px 16px;
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--bg-primary);
  }
  
  .data-table {
    background: var(--bg-primary);
    border-radius: var(--border-radius);
    padding: 16px;
  }
  
  .data-row {
    display: grid;
    grid-template-columns: 2fr 3fr 1fr;
    gap: 16px;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .data-row:last-child {
    border-bottom: none;
  }
  
  .data-cell.actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  
  .question-preview {
    color: var(--text-secondary);
    font-size: 14px;
  }
  
  .badge {
    display: inline-block;
    padding: 4px 8px;
    background: var(--gray-200);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }
  
  .badge.success {
    background: var(--success);
    color: white;
  }
  
  .badge.danger {
    background: var(--danger);
    color: white;
  }
  
  .import-card {
    background: var(--bg-primary);
    border-radius: var(--border-radius);
    padding: 32px;
  }
  
  .code-block {
    background: var(--bg-secondary);
    padding: 16px;
    border-radius: var(--border-radius-sm);
    overflow-x: auto;
    font-family: monospace;
    font-size: 14px;
  }
  
  .gift-code-generator {
    background: var(--bg-primary);
    border-radius: var(--border-radius);
    padding: 32px;
  }
  
  .codes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin: 24px 0;
  }
  
  .gift-code-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: var(--border-radius-sm);
  }
  
  .gift-code-item code {
    font-family: monospace;
    font-weight: 600;
  }
  
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  
  .modal-content {
    background: var(--bg-primary);
    border-radius: var(--border-radius-lg);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-close {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-secondary);
  }
  
  .modal-body {
    padding: 24px;
  }
  
  .btn-sm {
    padding: 6px 12px;
    font-size: 14px;
  }
  
  .btn-danger {
    background: var(--danger);
    color: white;
  }
  
  .btn-danger:hover {
    background: #dc2626;
  }
`;
document.head.appendChild(adminStyle);