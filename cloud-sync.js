// ==================== 本地账号系统 ====================
// 完全基于 localStorage，无需任何第三方服务
// 数据隔离：每个用户的数据存在 study_all_user_data 中

const Auth = {
  // 获取当前登录用户
  get() {
    try {
      const raw = localStorage.getItem('study_current_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  // 是否已登录
  isLoggedIn() {
    return !!this.get();
  },

  // 是否跳过登录
  isSkipped() {
    return localStorage.getItem('study_auth_skip') === 'true';
  },

  // 获取用户名
  username() {
    const user = this.get();
    return user ? user.username : null;
  },

  // 获取昵称
  nickname() {
    const user = this.get();
    if (user && user.nickname) return user.nickname;
    return user ? user.username : '匿名研友';
  },

  // 退出登录
  logout() {
    // 退出前保存当前数据到用户专属存储
    CloudSync.saveUserData();
    localStorage.removeItem('study_current_user');
    localStorage.removeItem('study_auth_skip');
    window.location.href = 'auth.html';
  }
};

// ==================== 数据导入导出（换设备同步）====================
const CloudSync = {
  // 保存当前用户数据到专属存储
  saveUserData() {
    if (!Auth.isLoggedIn()) return;
    const username = Auth.username();
    
    // 收集所有 study_* 数据
    const userData = {};
    const prefix = 'study_';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(prefix) && 
          key !== 'study_accounts' && 
          key !== 'study_current_user' && 
          key !== 'study_all_user_data' &&
          key !== 'study_auth_skip') {
        try {
          userData[key.substring(prefix.length)] = JSON.parse(localStorage.getItem(key));
        } catch {
          userData[key.substring(prefix.length)] = localStorage.getItem(key);
        }
      }
    }

    const allUserData = JSON.parse(localStorage.getItem('study_all_user_data') || '{}');
    allUserData[username] = userData;
    localStorage.setItem('study_all_user_data', JSON.stringify(allUserData));
  },

  // 从专属存储加载当前用户数据
  loadUserData() {
    if (!Auth.isLoggedIn()) return;
    const username = Auth.username();
    const allUserData = JSON.parse(localStorage.getItem('study_all_user_data') || '{}');
    const userData = allUserData[username];
    
    if (userData) {
      Object.keys(userData).forEach(key => {
        const storageKey = 'study_' + key;
        const value = userData[key];
        if (typeof value === 'string') {
          localStorage.setItem(storageKey, value);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(value));
        }
      });
    }
  },

  // 导出当前用户数据为文件
  exportData() {
    if (!Auth.isLoggedIn()) {
      alert('请先登录后再导出数据');
      return;
    }

    // 先保存当前数据
    this.saveUserData();

    const username = Auth.username();
    const allUserData = JSON.parse(localStorage.getItem('study_all_user_data') || '{}');
    const accounts = JSON.parse(localStorage.getItem('study_accounts') || '{}');

    // 只导出当前用户的账号信息
    const userAccount = {};
    if (accounts[username]) {
      userAccount[username] = accounts[username];
    }

    const exportData = {
      exportType: 'beikao_backup',
      version: '1.0',
      username: username,
      nickname: Auth.nickname(),
      exportedAt: new Date().toISOString(),
      accounts: userAccount,
      userData: allUserData[username] || {}
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'beikao-backup-' + username + '-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  // 自动同步：每30秒保存一次用户数据
  scheduleAutoSave() {
    setInterval(() => {
      if (Auth.isLoggedIn()) {
        this.saveUserData();
      }
    }, 30000);
  }
};

// ==================== 页面加载时的认证检查 ====================
function checkAuthAndInit() {
  // 如果未登录且未跳过，跳转到登录页
  if (!Auth.isLoggedIn() && !Auth.isSkipped()) {
    window.location.href = 'auth.html';
    return false;
  }

  // 已登录用户：加载其数据
  if (Auth.isLoggedIn()) {
    CloudSync.loadUserData();
  }

  return true;
}

// ==================== 定期自动保存 ====================
function startAutoSync() {
  CloudSync.scheduleAutoSave();
}

// ==================== 页面卸载时保存 ====================
window.addEventListener('beforeunload', () => {
  if (Auth.isLoggedIn()) {
    CloudSync.saveUserData();
  }
});
