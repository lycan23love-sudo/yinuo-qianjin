-- ============================================================
-- 一诺千金 MVP 数据库建表 SQL
-- 在 Supabase Dashboard → SQL Editor 中运行
-- ============================================================

-- 1. 用户扩展信息表（Supabase Auth 已有基础用户，这里存扩展字段）
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone       TEXT,
  nickname    TEXT NOT NULL DEFAULT '立誓者',
  avatar_url  TEXT,
  bio         TEXT,
  merit_coins INTEGER NOT NULL DEFAULT 500,   -- 初始赠送500善缘
  total_merit INTEGER NOT NULL DEFAULT 0,     -- 累计功德值（含已捐）
  completed_count INTEGER NOT NULL DEFAULT 0, -- 完成誓言数（决定额度）
  quota_limit INTEGER NOT NULL DEFAULT 3,     -- 当前额度上限
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 誓言表
CREATE TABLE public.pledges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  period         TEXT NOT NULL CHECK (period IN ('week','month','season','year')),
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  total_days     INTEGER NOT NULL,
  stake_coins    INTEGER NOT NULL DEFAULT 500,
  charity_target TEXT NOT NULL DEFAULT '山区图书馆计划',
  verify_type    TEXT NOT NULL DEFAULT 'screenshot' CHECK (verify_type IN ('screenshot','text','location')),
  is_public      BOOLEAN DEFAULT TRUE,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','done','fail','cooldown','abandoned')),
  cooldown_until TIMESTAMPTZ,          -- 冷静期结束时间
  current_streak INTEGER DEFAULT 0,   -- 当前连续天数
  max_streak     INTEGER DEFAULT 0,   -- 最长连续天数
  checkin_count  INTEGER DEFAULT 0,   -- 已打卡天数
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 打卡记录表
CREATE TABLE public.checkins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pledge_id    UUID NOT NULL REFERENCES public.pledges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_num      INTEGER NOT NULL,       -- 第几天
  checkin_date DATE NOT NULL,          -- 打卡日期（自然日）
  image_url    TEXT,                   -- 截图URL
  note         TEXT,                   -- 感悟文字
  mood         TEXT CHECK (mood IN ('great','grind','steady','danger')),
  coins_earned INTEGER DEFAULT 0,      -- 本次奖励金币
  streak       INTEGER DEFAULT 1,      -- 当时连续天数
  is_makeup    BOOLEAN DEFAULT FALSE,  -- 是否补卡
  status       TEXT DEFAULT 'valid' CHECK (status IN ('valid','disputed','pending')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pledge_id, checkin_date)      -- 一天只能打一次
);

-- 4. 金币流水账本（不可删除，只可追加）
CREATE TABLE public.coin_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,      -- 正=收入 负=支出
  type          TEXT NOT NULL CHECK (type IN (
                  'checkin','stake','stake_refund','donate',
                  'reward_streak','reward_milestone','reward_team',
                  'gift_register','witness_earn','question_cost'
                )),
  ref_id        UUID,                  -- 关联pledges/checkins/donations的ID
  note          TEXT,
  balance_after INTEGER NOT NULL,      -- 操作后余额（便于对账）
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 见证者押注表
CREATE TABLE public.witnesses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pledge_id    UUID NOT NULL REFERENCES public.pledges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('trust','doubt')),
  stake_coins  INTEGER NOT NULL DEFAULT 100,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active','won','lost')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pledge_id, user_id)
);

-- 6. 捐款记录表
CREATE TABLE public.donations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coins      INTEGER NOT NULL,
  org_name   TEXT NOT NULL,
  source     TEXT NOT NULL CHECK (source IN ('pledge_fail','manual','witness_pool')),
  ref_id     UUID,
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security（数据安全，必须开启）
-- ============================================================
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pledges     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witnesses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations   ENABLE ROW LEVEL SECURITY;

-- profiles：自己能读写自己的，公开信息所有人可读
CREATE POLICY "profiles_self_rw" ON public.profiles
  FOR ALL USING (auth.uid() = id);
CREATE POLICY "profiles_public_r" ON public.profiles
  FOR SELECT USING (true);

-- pledges：自己能读写自己的，公开誓言所有人可读
CREATE POLICY "pledges_self_rw" ON public.pledges
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pledges_public_r" ON public.pledges
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- checkins：自己能读写，公开誓言的打卡所有人可读
CREATE POLICY "checkins_self_rw" ON public.checkins
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "checkins_public_r" ON public.checkins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pledges p
            WHERE p.id = checkins.pledge_id AND p.is_public = true)
    OR auth.uid() = user_id
  );

-- coin_ledger：只能读自己的，不能直接写（通过函数操作）
CREATE POLICY "ledger_self_r" ON public.coin_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- witnesses：自己能操作，所有人可读
CREATE POLICY "witnesses_self_rw" ON public.witnesses
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "witnesses_public_r" ON public.witnesses
  FOR SELECT USING (true);

-- donations：自己能读写
CREATE POLICY "donations_self_rw" ON public.donations
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 核心函数：原子性金币操作（防止并发导致余额错误）
-- ============================================================
CREATE OR REPLACE FUNCTION add_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_ref_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- 锁定用户行，防并发
  SELECT merit_coins INTO v_balance FROM public.profiles
  WHERE id = p_user_id FOR UPDATE;

  v_balance := v_balance + p_amount;

  -- 余额不能为负
  IF v_balance < 0 THEN
    RAISE EXCEPTION '余额不足';
  END IF;

  -- 更新余额
  UPDATE public.profiles
  SET merit_coins = v_balance,
      total_merit = CASE WHEN p_amount > 0 THEN total_merit + p_amount ELSE total_merit END,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- 写流水
  INSERT INTO public.coin_ledger(user_id, amount, type, ref_id, note, balance_after)
  VALUES (p_user_id, p_amount, p_type, p_ref_id, p_note, v_balance);

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 触发器：新用户注册自动创建 profile
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, nickname)
  VALUES (NEW.id, NEW.phone, COALESCE(NEW.raw_user_meta_data->>'nickname', '立誓者'));

  -- 注册赠送500善缘
  PERFORM add_coins(NEW.id, 500, 'gift_register', NULL, '新用户注册赠送');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Supabase Storage：创建打卡图片桶
-- （在 Supabase Dashboard → Storage 里手动创建 "checkins" 桶，
--   设置为 Public，或运行以下 SQL）
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkins', 'checkins', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "checkins_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'checkins' AND auth.role() = 'authenticated');
CREATE POLICY "checkins_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'checkins');
