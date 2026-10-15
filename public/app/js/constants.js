/* Wedding Management · © 2026 myoung. All rights reserved.
 * 고정 값: 상태·결제 종류·카테고리 별칭·역산 가이드·기본 식순. */
/* ═══ 상수 ═════════════════════════════════ */
export const STATUS = { contracted:'계약', candidate:'미정', dropped:'탈락' };
export const PAYER = { both:'공동', groom:'신랑', bride:'신부', groomFamily:'신랑 측 가족', brideFamily:'신부 측 가족' };
export const METHOD = { card:'카드', cash:'현금', transfer:'계좌이체', other:'기타' };
export const PAY_TYPES = ['예약금(계약금)','중도금','잔금','할부','추가금','기타'];
/* 결제자를 신랑 / 신부 / 공동 세 열로 모은다. 양가 부담은 그 쪽 열에 */
export const payerCol = p => p==='groom'||p==='groomFamily' ? 'groom' : p==='bride'||p==='brideFamily' ? 'bride' : 'both';
export const SIDE = { groom:'신랑', bride:'신부' };
export const DEF_RELS = ['가족','친척','친구','직장','지인'];
export const KINDS = { contract:'계약서', audio:'음악', video:'영상', image:'사진', doc:'문서', other:'기타' };
export const TRIP_TYPES = { flight:'항공', hotel:'숙소', tour:'투어·액티비티', transport:'교통·렌터카', insurance:'보험·유심', etc:'기타' };
export const CURRENCIES = ['USD','EUR','JPY','THB','VND','PHP','IDR','MYR','SGD','AUD','NZD','GBP','CHF','HKD','TWD','CAD','MXN','TRY','AED','MVR','CZK','HUF'];
export const DEF_TAGS = ['헤어','메이크업','드레스','신랑 예복','부케','촬영 컨셉','장소/배경','본식 데코','청첩장'];
/* 역산 준비 가이드. months = 예식일 몇 개월 전까지 끝낼 것. 기획 노트의 D-12~D-7 구간 그대로. */
export const GUIDE = [
  { g:'예식장 (D-12~10개월)', months:10, cat:'venue', items:['예식장 투어 3곳 이상','식대·보증인원·대관료 비교','예식장 계약'] },
  { g:'스드메 (D-10~8개월)', months:8, cat:'studio', items:['플래너 쓸지 결정','스튜디오 고르기','드레스샵 투어','헤어·메이크업 예약'] },
  { g:'촬영·예물·신혼여행 (D-6~4개월)', months:4, cat:'snap', items:['웨딩 촬영','예물 맞추기','예복 맞추기','신혼여행 항공·숙소','상견례'] },
  { g:'청첩장·가봉 (D-3~2개월)', months:2, cat:'invitation', items:['청첩장 디자인·주문','모바일 청첩장','하객 명단 정리','드레스 가봉','본식 스냅 예약'] },
  { g:'식순·잔금 (D-1개월)', months:1, cat:'etc', items:['식순 확정','사회자·축가 섭외','입장곡·퇴장곡 파일 전달','잔금 일정 확인','답례품·식권 준비'] },
  { g:'마지막 주 (D-7)', months:0.25, cat:'etc', items:['보증인원 확정 통보','혼주 의상·동선 확인','축의대 담당 정하기','당일 준비물 챙기기'] }
];
/* 한국식 기본 식순. 시작 시각 하나 + 소요시간 체인 */
export const DDAY = [['신부대기실 오픈',60],['혼주 맞이·접수',30],['본식 시작',30],['원판 사진 촬영',20],['식사·하객 인사',60],['폐백',30],['2부·마무리',40]];
export const LS = 'wm.v1';

/* 엑셀 가계부 붙여넣기. 한 줄 = 카테고리, 항목, 금액, 계약일, 지출금액, 비고 (탭 또는 쉼표).
 * 카테고리 칸이 비어 있으면 바로 윗줄 것을 이어 쓴다(병합 셀). 합계 줄은 건너뛴다. */
export const CAT_ALIAS = [[/웨딩홀|예식장|홀/,'venue'],[/플래너/,'planner'],[/스드메|스튜디오/,'studio'],[/드레스/,'dress'],[/메이크업|헤어/,'makeup'],[/스냅|영상|dvd/i,'snap'],[/본식|사회|축가|축의/,'ceremony'],[/예물|반지|밴드/,'ring'],[/예복|수트|정장/,'suit'],[/혼주|한복/,'parents'],[/모임|식사|밥/,'gathering'],[/청첩|답례/,'invitation'],[/신혼여행|허니문/,'honeymoon']];
