/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 설정값과 통계용 선택지.
 */
/* ── 설정값 ── */
export const SITE       = 'Wedding Management';
export const SITE_LEAD  = '둘이 함께 쓰는 결혼 준비 장부';
export const SITE_DESC  = '예산·업체·일정·하객을 한곳에서. 플래너 없이 준비하는 커플을 위한 결혼 준비 관리';

export const CLIENT_ITER  = 600000;
export const SERVER_ITER  = 12000;
export const KEY_BYTES    = 32;
export const MIN_PW       = 10;
export const SESSION_DAYS = 30;
export const INVITE_DAYS  = 7;
export const MAX_MEMBERS  = 2;
export const MAX_ITEMS    = 2000;
export const MAX_DOC_LEN  = 100000;

/* 파일함. Worker 를 거쳐 올리므로 한 번에 보낼 수 있는 크기는 요청 본문 한도(무료 100MB)에 묶인다.
 * 더 큰 영상은 R2 multipart 로 나눠 올리는 길을 나중에 연다. 총량은 요금제로 가른다. */
export const MAX_FILE          = 100 * 1024 * 1024;
export const QUOTA_FREE        = 300 * 1024 * 1024;
export const QUOTA_PREMIUM     = 2 * 1024 * 1024 * 1024;
export const FILE_OWNERS       = ['vendor', 'event', 'memo', 'reference', 'invitation'];
export const FILE_KINDS        = ['contract', 'audio', 'video', 'image', 'doc', 'other'];

export const LOGIN_WINDOW_MS  = 15 * 60 * 1000;
export const LOGIN_MAX_FAIL   = 8;
export const LOGIN_LOCK_MS    = 15 * 60 * 1000;
export const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
export const SIGNUP_MAX       = 5;

export const SESSION_COOKIE = 'wm_session';
export const OAUTH_COOKIE   = 'wm_oauth';
export const OAUTH_TTL_MS   = 10 * 60 * 1000;
export const GOOGLE_AUTH    = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN   = 'https://oauth2.googleapis.com/token';
export const GOOGLE_ISS     = ['accounts.google.com', 'https://accounts.google.com'];

/* 통계용으로만 받는 값들 */
export const AGE_BANDS = ['20s', '30s', '40s'];
export const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '해외'];
export function validAge(v) { return AGE_BANDS.indexOf(String(v)) >= 0; }
export function validRegion(v) { return REGIONS.indexOf(String(v)) >= 0; }

/* 계획 안의 항목 종류. 모두 (plan_id, id, data) 모양이라 한 벌의 코드로 다룬다. */
export const COLLECTIONS = ['vendors', 'payments', 'events', 'tasks', 'guests', 'memos'];
