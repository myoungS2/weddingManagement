# Wedding Management

> © 2026 myoung. All rights reserved. 이 저장소는 열람용이며 코드·문구·로고·일러스트의 무단 사용을 금합니다. [LICENSE](LICENSE)

플래너 없이 결혼을 준비하는 커플이 **둘이 함께 쓰는 결혼 준비 장부**.
예산·업체·일정·하객·파일을 한곳에 두고, 예식일 기준으로 준비 순서를 역산해 준다.

구조: Cloudflare Worker 하나 + D1 + R2 + `index.html` 한 장.

---

## 폴더

```
wedding_management/
├── index.html          앱 전부. 워커가 문자열로 읽어 CSP nonce 를 붙여 내보낸다. <style>·<script> 는 각각 하나만.
├── src/worker.js       로그인(구글·초대 전용 이메일), 세션, 계획 API, 파일(R2), 관리자, 약관
├── schema.sql          D1 스키마. 처음 한 번 적용
├── assets/             로고(logo-doves.webp), 레터링(wordmark-ribbon.webp), 인트로 시안(intro.html)
├── wrangler.toml       바인딩: DB(D1), FILES(R2)
├── .dev.vars.example   로컬 환경변수 견본 → .dev.vars 로 복사
└── package.json        dev / deploy / db:local / db:remote / check
```

## 데이터 모양

- **plan**(결혼 계획) 단위로 묶인다. 한 계획에 커플 두 사람만 들어오고 권한은 같다. 모든 질의는 `plan_id` 로 걸린다.
- 계획 안의 항목은 전부 같은 모양: `(plan_id, id, data JSON, updated_at, updated_by, created_by)`.
  `vendors` `payments` `events` `tasks` `guests` `memos`. 필드가 늘어도 `data` 에 넣으면 되고, 통계·정렬용 몇 칸만 가상 컬럼으로 비춘다.
- **업체 = 예산 항목.** 상태 `contracted(계약) / candidate(미정) / dropped(탈락)`. 금액은 직접 입력 또는 `단가 × 수량 + 추가`.
  결제(계약금·잔금), 확인 질문, 추가금, 첨부가 업체 아래 달린다. 업체를 지우면 같이 지워진다.
- **파일**은 `files` 한 표에 두고 "붙은 곳"을 `owner_type + owner_id` 로 가리킨다 (`vendor | event | memo | reference | invitation`). 본체는 R2, 메타데이터만 D1.
- **레퍼런스**는 `owner_type='reference'` 인 파일 + 태그 N:M(`ref_file_tags`) + 사람별 좋아요(`ref_likes`).
- **초대**는 `invites` 한 표: `plan`(파트너 합류, `/join/<token>`) 과 `referral`(친구 추천, `/r/<token>`). 1회용, 7일.
- **요금제** 자리: `plans.tier (free | premium)`, `purchases`. 결제 수단은 아직 없고 관리자가 수동으로 넣는다. 지금 게이트는 파일 총량(300MB / 2GB)뿐.

## API 요약

| 경로 | 설명 |
|---|---|
| `GET /api/me` | 로그인한 사람, 현재 계획, 파일 저장소 켜짐 여부 |
| `GET /api/state` | 계획 설정·멤버·초대 + 모든 항목 + 파일 + 레퍼런스 태그/좋아요 + 카테고리 + 용량 |
| `PUT /api/plan` | 설정 병합 저장 (예식일·총예산·이름·지역·웨딩홀·카테고리별 예산·참석률…) |
| `PUT/DELETE /api/<col>/<id>` · `PUT /api/<col>` | 항목 하나 / 여러 개 (`<col>` = vendors payments events tasks guests memos) |
| `POST /api/plan/invite` · `POST /api/referral` · `DELETE /api/invite/<token>` | 초대 링크 |
| `POST /api/files?owner=&id=&kind=&name=` | 파일 올리기(본문 = 파일). `GET /file/<id>` 는 Range 지원, `?dl=1` 이면 내려받기 |
| `POST /api/ref/tags` · `PUT /api/ref/<fileId>/tags` · `POST /api/ref/<fileId>/like` | 레퍼런스 |
| `GET /api/venues?q=` · `POST /api/venues` | 웨딩홀 콤보박스: 자체 마스터 → 카카오(`KAKAO_REST_KEY` 있을 때) → 수동 등록 요청 |
| `/api/admin/*` | 회원·계획·카테고리·웨딩홀 요청 승인·수동 결제 (`ADMIN_EMAIL` 만) |

로그인 화면(`/auth/login` `signup` `start` `password`)과 `/join` `/r` 수락 화면은 워커가 그린다. `index.html` 에는 없다.

---

## 로컬에서 돌리기

```bash
npm install
cp .dev.vars.example .dev.vars        # ALLOW_OPEN=1 이면 로그인 없이 바로 앱이 뜬다
npm run db:local                      # 로컬 D1 에 schema.sql 적용 (처음 한 번)
npm run dev                           # http://localhost:8790
```

R2 도 로컬에서 디스크에 흉내 내므로 파일 올리기까지 그대로 된다.
`index.html` 을 파일로 직접 열어도 동작은 하지만(브라우저 저장), 파일·함께 쓰기는 서버가 있어야 한다.

## 배포

```bash
npx wrangler d1 create wedding-management          # database_id 를 wrangler.toml 에 적는다
npm run db:remote
npx wrangler r2 bucket create wedding-management-files
npx wrangler secret put SESSION_SECRET             # openssl rand -base64 48
npx wrangler secret put GOOGLE_CLIENT_ID           # 구글 클라우드 콘솔. 리디렉션 URI: https://<도메인>/auth/google/callback
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put CONTACT_EMAIL            # 약관·개인정보 페이지의 연락처
npx wrangler secret put KAKAO_REST_KEY             # 선택. 없으면 웨딩홀 검색이 자체 마스터만 본다
npm run deploy
```

`wrangler.toml` 의 `routes` 주석을 풀어 도메인을 붙인다. 구글 OAuth 동의 화면은 `/privacy` `/terms` 가 있어야 게시된다(워커가 서빙한다).

## 아직 안 한 것 (다음 순서)

1. **파일 100MB 넘는 영상**: 지금은 Worker 요청 본문 한도에 묶인다. R2 multipart 로 나눠 올리는 길을 연다.
2. **당일 전달 zip**: CSP 가 외부 스크립트를 막아 JSZip 을 못 쓴다. 워커에서 묶거나 작은 zip 구현을 인라인으로.
3. **청첩장(웨딩 웹사이트) + RSVP + 하객 사진 QR**: `invitation/` 프로젝트를 들여온다. RSVP 가 하객 명단에 바로 들어가게.
4. **결제**: 토스페이먼츠 일반결제. 사업자등록·통신판매업 신고가 먼저다. `purchases` 에 기록하고 `plans.tier` 를 올리는 자리는 있다.
5. **백업 워크플로**: GitHub Actions 로 매일 `wrangler d1 export` → 암호화 → 아티팩트 보관.
6. 접근성: 더보기 목록과 카드가 `div` 클릭이다. `button` 으로 바꾼다.
7. **하객 탭 복구 시** 아이콘·빈 상태는 `assets/art/envelope.webp`(청첩장). `index.html` 의 숨긴 `data-view="guest"` 버튼을 되살리면 된다.
8. **시안 템플릿 내려받기**: 웨딩 촬영 시안(감독님께)과 헤어·메이크업 시안(실장님께)을 빈 양식으로 만들어 메모·레퍼런스 화면에서 내려받게 한다. 앱 안에서 레퍼런스 태그별 사진을 자동으로 채워 PDF 로 뽑는 것이 목표.

---

© 2026 myoung. All rights reserved.
