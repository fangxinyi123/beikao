-- ==================== 不摆烂研习社 - Supabase 数据库设置 ====================
-- 在 Supabase SQL Editor 中执行此文件

-- 1. 用户数据同步表（支持跨设备登录数据同步）
CREATE TABLE IF NOT EXISTS user_data (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  nickname TEXT DEFAULT '研友',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);

-- RLS 策略：用户只能读写自己的数据
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 允许已认证用户读取自己的数据
CREATE POLICY "Users can read own data" ON user_data
  FOR SELECT USING (auth.uid() = user_id);

-- 允许已认证用户插入自己的数据
CREATE POLICY "Users can insert own data" ON user_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 允许已认证用户更新自己的数据
CREATE POLICY "Users can update own data" ON user_data
  FOR UPDATE USING (auth.uid() = user_id);

-- 允许已认证用户删除自己的数据
CREATE POLICY "Users can delete own data" ON user_data
  FOR DELETE USING (auth.uid() = user_id);


-- 2. 研友圈帖子表（已有，确保存在）
CREATE TABLE IF NOT EXISTS buddies_posts (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  avatar TEXT DEFAULT '👤',
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE buddies_posts ENABLE ROW LEVEL SECURITY;

-- 帖子：任何人可读
CREATE POLICY "Anyone can read posts" ON buddies_posts
  FOR SELECT USING (true);

-- 帖子：已认证用户可创建
CREATE POLICY "Auth users can create posts" ON buddies_posts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 帖子：创建者可删除
CREATE POLICY "Users can delete own posts" ON buddies_posts
  FOR DELETE USING (nickname = (SELECT raw_user_meta_data->>'nickname' FROM auth.users WHERE id = auth.uid()));


-- 3. 研友圈回复表（已有，确保存在）
CREATE TABLE IF NOT EXISTS buddies_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES buddies_posts(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE buddies_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read replies" ON buddies_replies
  FOR SELECT USING (true);

CREATE POLICY "Auth users can create replies" ON buddies_replies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete own replies" ON buddies_replies
  FOR DELETE USING (nickname = (SELECT raw_user_meta_data->>'nickname' FROM auth.users WHERE id = auth.uid()));


-- 4. 研友圈点赞表（已有，确保存在）
CREATE TABLE IF NOT EXISTS buddies_likes (
  id BIGSERIAL PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES buddies_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  UNIQUE(post_id, user_id)
);

ALTER TABLE buddies_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes" ON buddies_likes
  FOR SELECT USING (true);

CREATE POLICY "Auth users can like" ON buddies_likes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can unlike" ON buddies_likes
  FOR DELETE USING (auth.role() = 'authenticated');


-- 5. 题库贡献审核表（新增）
CREATE TABLE IF NOT EXISTS quiz_contributions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  nickname TEXT DEFAULT '匿名',
  subject TEXT NOT NULL,
  icon TEXT DEFAULT '📝',
  data JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quiz_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved contributions" ON quiz_contributions
  FOR SELECT USING (status = 'approved' OR auth.uid() = user_id);

CREATE POLICY "Auth users can contribute" ON quiz_contributions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- 6. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 user_data 添加触发器
DROP TRIGGER IF EXISTS update_user_data_updated_at ON user_data;
CREATE TRIGGER update_user_data_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
