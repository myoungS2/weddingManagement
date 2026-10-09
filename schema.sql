-- Wedding Management · © 2026 myoung. All rights reserved.
-- Wedding Management — D1 스키마
--
-- 데이터는 "결혼 계획(plan)" 단위로 묶입니다. 한 계획에는 커플 두 사람(나 + 파트너)만 들어오고,
-- 둘은 똑같이 읽고 씁니다. 워커는 언제나 "이 사람이 이 계획의 멤버인가"를 먼저 확인하고
-- 모든 질의를 plan_id 로 겁니다. 남의 계획은 SQL 단계에서 안 걸립니다.
--
-- 계획 안의 항목(업체·결제·일정·할 일·하객·메모)은 모두 같은 모양입니다:
--   (plan_id, id, data JSON, updated_at, updated_by, created_by)
-- 화면이 쓰는 필드는 data 안에 있고, 통계·정렬에 필요한 몇 칸만 가상 컬럼으로 비춥니다.
-- 필드가 늘어도 마이그레이션 없이 data 에 넣으면 됩니다.

/* ─── 사람 ─────────────────────────────── */
CREATE TABLE IF NOT EXISTS users (
  email         TEXT PRIMARY KEY,       -- 소문자로 저장
  name          TEXT,
  pw            TEXT,                   -- pbkdf2$반복수$소금$해시. 구글 전용 계정은 NULL
  session_epoch INTEGER NOT NULL DEFAULT 1,
  current_plan  TEXT,                   -- 마지막으로 보던 계획
  created_at    TEXT NOT NULL,
  last_login    TEXT,
  provider      TEXT NOT NULL DEFAULT 'password',  -- password | google | both
  google_sub    TEXT,                   -- 구글이 주는 사람 고유 번호
  age_band      TEXT,                   -- 20s | 30s | 40s | NULL(안 밝힘)  — 통계용
  referred_by   TEXT                    -- 추천 초대로 들어왔으면 추천인 이메일
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_sub);

-- 로그인·가입 시도 횟수. 키는 'e:이메일' / 'i:아이피' / 's:아이피' / 'p:이메일'
CREATE TABLE IF NOT EXISTS login_attempts (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  first_at INTEGER NOT NULL,
  until    INTEGER
);

/* ─── 결혼 계획 ─────────────────────────── */
CREATE TABLE IF NOT EXISTS plans (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  owner_key    TEXT NOT NULL,
  data         TEXT NOT NULL DEFAULT '{}',   -- 설정: weddingDate, budget, groom, bride, region, venue, alarm …
  tier         TEXT NOT NULL DEFAULT 'free', -- free | premium (계획당 1회 결제. 결제 자체는 purchases 에)
  tier_until   TEXT,                         -- 기한이 있는 혜택이면 여기. NULL 이면 영구
  created_at   TEXT NOT NULL,
  updated_at   TEXT,
  wedding_date TEXT GENERATED ALWAYS AS (json_extract(data, '$.weddingDate')) VIRTUAL,
  region       TEXT GENERATED ALWAYS AS (json_extract(data, '$.region'))      VIRTUAL,
  budget       INTEGER GENERATED ALWAYS AS (json_extract(data, '$.budget'))   VIRTUAL
);
CREATE INDEX IF NOT EXISTS idx_plans_date ON plans(wedding_date);

CREATE TABLE IF NOT EXISTS plan_members (
  plan_id   TEXT NOT NULL,
  user_key  TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'partner',   -- owner | partner (권한은 같음)
  joined_at TEXT NOT NULL,
  PRIMARY KEY (plan_id, user_key)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON plan_members(user_key);

-- 초대 링크 하나로 두 종류를 다룹니다.
--   plan     : 파트너를 내 계획에 합류시킨다 (/join/<token>). plan_id 필수.
--   referral : 친구에게 앱을 추천한다 (/r/<token>). 받은 사람은 자기 계획을 새로 갖는다. plan_id NULL.
-- 둘 다 1회용, 7일 뒤 만료, 안 쓴 링크는 취소할 수 있습니다.
CREATE TABLE IF NOT EXISTS invites (
  token      TEXT PRIMARY KEY,
  type       TEXT NOT NULL,               -- plan | referral
  plan_id    TEXT,
  role       TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    TEXT,
  used_by    TEXT
);
CREATE INDEX IF NOT EXISTS idx_invites_plan ON invites(plan_id);
CREATE INDEX IF NOT EXISTS idx_invites_by   ON invites(created_by);

-- 결제 기록. 결제 수단(토스페이먼츠 등)은 아직 안 붙었고, 관리자가 수동으로 넣는 것부터 시작합니다.
-- 기록이 들어오면 plans.tier 를 올립니다. 환불은 refunded_at 을 채우고 tier 를 내립니다.
CREATE TABLE IF NOT EXISTS purchases (
  id           TEXT PRIMARY KEY,
  plan_id      TEXT NOT NULL,
  user_key     TEXT NOT NULL,
  product      TEXT NOT NULL,              -- premium | storage_1g | …
  amount       INTEGER NOT NULL,           -- 원
  provider     TEXT NOT NULL DEFAULT 'manual',  -- manual | toss | …
  provider_ref TEXT,
  created_at   TEXT NOT NULL,
  refunded_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_purchases_plan ON purchases(plan_id);

/* ─── 계획 안의 항목들 ──────────────────────
 * 업체 = 예산 항목. data: { name, category, status(candidate|contracted|dropped),
 *   amountMode(direct|formula), amount, unitPrice, qty, extra, payer(groom|bride|both|groomFamily|brideFamily),
 *   contact{name,phone}, memo, links[], questions[{q,a,done}], extras[{title,amount}], sort }
 */
CREATE TABLE IF NOT EXISTS vendors (
  plan_id    TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  created_by TEXT,
  category   TEXT    GENERATED ALWAYS AS (json_extract(data, '$.category')) VIRTUAL,
  status     TEXT    GENERATED ALWAYS AS (json_extract(data, '$.status'))   VIRTUAL,
  amount     INTEGER GENERATED ALWAYS AS (json_extract(data, '$.amount'))   VIRTUAL,
  PRIMARY KEY (plan_id, id)
);
CREATE INDEX IF NOT EXISTS idx_vendors_cat ON vendors(category);

-- 결제: 계약금·중도금·잔금·할부 회차. data: { vendorId, title, amount, dueDate, paidAt, payer, method, memo }
CREATE TABLE IF NOT EXISTS payments (
  plan_id    TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  created_by TEXT,
  vendor_id  TEXT GENERATED ALWAYS AS (json_extract(data, '$.vendorId')) VIRTUAL,
  due_date   TEXT GENERATED ALWAYS AS (json_extract(data, '$.dueDate'))  VIRTUAL,
  PRIMARY KEY (plan_id, id)
);
CREATE INDEX IF NOT EXISTS idx_payments_vendor ON payments(plan_id, vendor_id);

-- 일정: 확정 일정(투어·가봉·상견례)과 식순 단계. data: { date, time, title, memo, vendorId, kind(event|dday), minutes }
CREATE TABLE IF NOT EXISTS events (
  plan_id    TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  created_by TEXT,
  date       TEXT GENERATED ALWAYS AS (json_extract(data, '$.date')) VIRTUAL,
  PRIMARY KEY (plan_id, id)
);

-- 할 일: 역산 가이드 항목과 직접 추가한 항목. data: { title, group, due, done, who, guideKey }
CREATE TABLE IF NOT EXISTS tasks (
  plan_id    TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  created_by TEXT,
  PRIMARY KEY (plan_id, id)
);

-- 하객. data: { side(groom|bride), rel, name, plus, rsvp(''|y|n), memo, gift, meal }
CREATE TABLE IF NOT EXISTS guests (
  plan_id    TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  created_by TEXT,
  PRIMARY KEY (plan_id, id)
);

-- 메모(축사·서약문·아이디어). data: { title, body }
CREATE TABLE IF NOT EXISTS memos (
  plan_id    TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  created_by TEXT,
  PRIMARY KEY (plan_id, id)
);

/* ─── 파일함 ───────────────────────────────
 * 파일은 한 표에 두고 "붙은 곳"을 종류 + id 로 가리킵니다.
 *   owner_type: vendor | event | memo | reference | invitation
 * 본체는 R2 에 있고 여기에는 메타데이터만 둡니다. 붙은 곳이 지워지면 파일도 지웁니다.
 */
CREATE TABLE IF NOT EXISTS files (
  id           TEXT PRIMARY KEY,
  plan_id      TEXT NOT NULL,
  owner_type   TEXT NOT NULL,
  owner_id     TEXT,
  kind         TEXT NOT NULL,             -- contract | audio | video | image | doc | other
  name         TEXT NOT NULL,
  size         INTEGER NOT NULL,
  content_type TEXT,
  object_key   TEXT NOT NULL,
  memo         TEXT,
  who          TEXT,                     -- 레퍼런스 대상: groom | bride | NULL(공통)
  created_by   TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_plan  ON files(plan_id);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(plan_id, owner_type, owner_id);

/* ─── 레퍼런스 보드 ────────────────────────
 * 레퍼런스 한 장 = files 의 한 행(owner_type='reference'). 태그는 N:M, 좋아요는 사람별.
 */
CREATE TABLE IF NOT EXISTS ref_tags (
  plan_id TEXT NOT NULL,
  id      TEXT NOT NULL,
  name    TEXT NOT NULL,
  sort    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, id)
);
CREATE TABLE IF NOT EXISTS ref_file_tags (
  plan_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  tag_id  TEXT NOT NULL,
  PRIMARY KEY (plan_id, file_id, tag_id)
);
CREATE TABLE IF NOT EXISTS ref_likes (
  plan_id  TEXT NOT NULL,
  file_id  TEXT NOT NULL,
  user_key TEXT NOT NULL,
  PRIMARY KEY (plan_id, file_id, user_key)
);

/* ─── 마스터 (관리자만 쓰기) ────────────────
 * 카테고리: 예산·업체·가이드가 같이 씁니다. 이름을 바꾸면 쓰던 항목에 자동 반영되도록 id 로 참조합니다.
 */
CREATE TABLE IF NOT EXISTS categories (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO categories (id, name, sort) VALUES
  ('venue',      '예식장',        10),
  ('planner',    '플래너',        20),
  ('studio',     '스튜디오',      30),
  ('dress',      '드레스',        40),
  ('makeup',     '헤어/메이크업', 50),
  ('snap',       '스냅/영상',     60),
  ('ceremony',   '본식',          65),   -- 사회자 · 축가 · 본식 스냅 · DVD · 축의대
  ('ring',       '예물(반지)',    70),
  ('suit',       '예복',          80),
  ('parents',    '혼주',          85),   -- 혼주 한복 · 혼주 메이크업
  ('invitation', '청첩장/답례품', 90),
  ('gathering',  '청첩장 모임',   95),   -- 청첩장 돌리는 식사 자리
  ('honeymoon',  '신혼여행',     100),
  ('etc',        '기타',         110);

-- 웨딩홀 마스터. 카카오 장소 ID 가 키라서 표기 차이로 쪼개지지 않습니다.
-- 약관상 저장할 수 있는 건 장소 ID·장소명·place_url 뿐입니다. 주소·좌표는 실시간 호출로만 씁니다.
CREATE TABLE IF NOT EXISTS venues (
  id             TEXT PRIMARY KEY,         -- 'k:<kakao_place_id>' 또는 수동 등록이면 'm:<uuid>'
  kakao_place_id TEXT,
  name           TEXT NOT NULL,
  place_url      TEXT,
  region         TEXT,                     -- 시/도 구 (우리 쪽 필드)
  hall           TEXT,                     -- 홀 이름 (우리 쪽 필드)
  status         TEXT NOT NULL DEFAULT 'ok',  -- ok | pending(수동 추가 요청, 검수 대기) | merged
  merged_into    TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_kakao ON venues(kakao_place_id);
CREATE INDEX IF NOT EXISTS idx_venues_status ON venues(status);
