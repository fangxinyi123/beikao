// ==================== Supabase 云端同步系统 ====================
// 替换原来的纯 localStorage 账号系统
// 需要在 index.html 中先引入 Supabase SDK

// Supabase 配置
const SUPABASE_CONFIG = {
  url: 'https://gmnkebtoaxadityitklp.supabase.co',
  anonKey: 'sb_publishable_UUJh0srqIrr8PBVrhH4u9Q_P7B6RkU-'
};

let supabase = null;

// 初始化 Supabase 客户端
function initSupabase() {
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient === 'undefined') {
    return false;
  }
  if (supabase) return true;
  // 如果还是占位符配置，不初始化
  if (SUPABASE_CONFIG.url.includes('YOUR_PROJECT_ID')) return false;
  supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  return true;
}

// ==================== 认证模块 ====================
const Auth = {
  // 获取当前用户
  async get() {
    if (!initSupabase()) return _localGetUser();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 从 user_metadata 获取昵称
        const nickname = user.user_metadata?.nickname || user.email || '研友';
        return {
          username: user.email || user.id,
          nickname: nickname,
          userId: user.id,
          email: user.email,
          loginTime: new Date().toISOString()
        };
      }
      return null;
    } catch {
      return _localGetUser();
    }
  },

  // 是否已登录
  async isLoggedIn() {
    return !!(await this.get());
  },

  // 是否跳过登录
  isSkipped() {
    return localStorage.getItem('study_auth_skip') === 'true';
  },

  // 获取用户名
  async username() {
    const user = await this.get();
    return user ? user.username : null;
  },

  // 获取昵称
  async nickname() {
    const user = await this.get();
    if (user && user.nickname) return user.nickname;
    return user ? user.username : '匿名研友';
  },

  // 注册
  async register(email, password, nickname) {
    if (!initSupabase()) return { error: 'Supabase 未配置' };

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { nickname: nickname }
      }
    });

    if (error) {
      // 翻译常见错误
      if (error.message.includes('already registered')) {
        return { error: '该邮箱已注册，请直接登录' };
      }
      return { error: error.message };
    }

    // 注册成功后自动登录
    if (data.user) {
      // 保存到 user_data 表
      await CloudSync._initUserData(data.user.id, nickname);
      return { success: true, user: data.user };
    }

    return { success: true, needConfirm: true, message: '注册成功！请查看邮箱确认（如果开启了邮箱验证）' };
  },

  // 登录
  async login(email, password) {
    if (!initSupabase()) return { error: 'Supabase 未配置' };

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { error: '邮箱或密码错误' };
      }
      return { error: error.message };
    }

    // 登录成功后同步数据
    if (data.user) {
      await CloudSync.pullFromCloud(data.user.id);
    }

    return { success: true, user: data.user };
  },

  // 退出登录
  async logout() {
    await CloudSync.pushToCloud();
    if (initSupabase()) {
      try { await supabase.auth.signOut(); } catch(e) {}
    }
    localStorage.removeItem('study_current_user');
    // 退出后设为跳过登录模式，这样回到主页不会卡在认证页
    localStorage.setItem('study_auth_skip', 'true');
    window.location.href = 'index.html';
  }
};

// 本地 fallback 用户获取
function _localGetUser() {
  try {
    const raw = localStorage.getItem('study_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ==================== 云端数据同步 ====================
const CloudSync = {
  // 初始化用户数据行
  async _initUserData(userId, nickname) {
    if (!initSupabase()) return;
    try {
      // 检查是否已有数据
      const { data: existing } = await supabase
        .from('user_data')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!existing) {
        await supabase.from('user_data').insert({
          user_id: userId,
          nickname: nickname || '研友',
          data: {}
        });
      }
    } catch (e) {
      console.log('初始化用户数据失败:', e.message);
    }
  },

  // 推送本地数据到云端
  async pushToCloud() {
    if (!initSupabase()) return;
    const user = await Auth.get();
    if (!user || !user.userId) return;

    // 收集所有本地 study_* 数据
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

    try {
      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: user.userId,
          nickname: user.nickname || '研友',
          data: userData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) console.log('推送数据失败:', error.message);
    } catch (e) {
      console.log('推送数据异常:', e.message);
    }
  },

  // 从云端拉取数据
  async pullFromCloud(userId) {
    if (!initSupabase()) return;
    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('data, nickname')
        .eq('user_id', userId)
        .single();

      if (error || !data || !data.data) return;

      // 将云端数据写入 localStorage
      const userData = data.data;
      Object.keys(userData).forEach(key => {
        const storageKey = 'study_' + key;
        const value = userData[key];
        if (typeof value === 'string') {
          localStorage.setItem(storageKey, value);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(value));
        }
      });

      // 更新本地用户信息
      const currentUser = _localGetUser();
      if (currentUser) {
        currentUser.nickname = data.nickname || currentUser.nickname;
        localStorage.setItem('study_current_user', JSON.stringify(currentUser));
      }
    } catch (e) {
      console.log('拉取数据失败:', e.message);
    }
  },

  // 导出数据为文件（换设备备用方案）
  async exportData() {
    const user = await Auth.get();
    if (!user) {
      alert('请先登录后再导出数据');
      return;
    }

    // 先推送到云端
    await this.pushToCloud();

    // 收集本地数据
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

    const exportData = {
      exportType: 'beikao_backup',
      version: '2.0',
      username: user.username,
      nickname: user.nickname,
      exportedAt: new Date().toISOString(),
      userData: userData
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'beikao-backup-' + (user.username || 'user') + '-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  // 自动保存（每30秒推送到云端）
  scheduleAutoSave() {
    setInterval(async () => {
      const user = await Auth.get();
      if (user && user.userId) {
        await this.pushToCloud();
      }
    }, 30000);
  }
};

// ==================== 页面认证检查 ====================
async function checkAuthAndInit() {
  // 尝试初始化 Supabase
  initSupabase();

  // 检查是否跳过登录
  if (Auth.isSkipped()) return true;

  // 检查 Supabase 会话
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // 有有效会话，拉取云端数据
      await CloudSync.pullFromCloud(session.user.id);

      // 保存本地用户信息
      const nickname = session.user.user_metadata?.nickname || session.user.email || '研友';
      localStorage.setItem('study_current_user', JSON.stringify({
        username: session.user.email || session.user.id,
        nickname: nickname,
        userId: session.user.id,
        loginTime: new Date().toISOString()
      }));

      return true;
    }
  }

  // 检查本地登录
  const localUser = _localGetUser();
  if (localUser) {
    // 迁移：如果有本地账号但 Supabase 可用，提示升级
    return true;
  }

  // 未登录，跳转
  window.location.href = 'auth.html';
  return false;
}

// ==================== 自动同步 ====================
function startAutoSync() {
  CloudSync.scheduleAutoSave();
}

// ==================== 页面卸载时保存 ====================
window.addEventListener('beforeunload', () => {
  CloudSync.pushToCloud();
});

// 兼容旧代码的同步方法
const _oldSaveUserData = CloudSync.pushToCloud;
const _oldLoadUserData = CloudSync.pullFromCloud;
