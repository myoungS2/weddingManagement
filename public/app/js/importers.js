/* Wedding Management · © 2026 myoung. All rights reserved.
 * 역산 가이드·식순 채우기, 엑셀 가계부 붙여넣기. */
import { CAT_ALIAS, DDAY, GUIDE } from './constants.js';
import { closeSheet, openSheet } from './sheet.js';
import { state } from './state.js';
import { store } from './store.js';
import { $, addMonths, esc, num, rels, toast, today, uid } from './util.js';

/* ═══ 가이드 ═══════════════════════════════ */
export function seedGuide(){
  const wd = state.settings.weddingDate; if (!wd || wd.length!==10) return toast('설정에서 예식일을 먼저 정하세요');
  const have = new Set(state.tasks.map(t=>t.guideKey).filter(Boolean)); const items=[];
  GUIDE.forEach(g => g.items.forEach((title,i) => { const key=g.cat+':'+i+':'+title; if (have.has(key)) return; items.push({ id:uid(), title, group:g.g, due:addMonths(wd, g.months), done:false, who:'both', guideKey:key }); }));
  if (!items.length) return toast('가이드 항목이 이미 다 있습니다');
  store.putMany('tasks', items); toast(items.length+'개 할 일을 예식일에 맞춰 넣었습니다');
}
export function seedDday(){ const items = DDAY.map(([title,minutes],i)=>({ id:uid(), kind:'dday', title, minutes, sort:i+1, date:state.settings.weddingDate||'' })); store.putMany('events', items); }
export function importBudget(){
  openSheet('엑셀 가계부 붙여넣기', '<p class="small muted" style="margin-bottom:8px">엑셀에서 표를 복사해 붙여 넣으세요. 열 순서는 <b>카테고리, 항목, 금액, 계약일, 지출금액, 비고</b>입니다. 카테고리 칸이 비면 윗줄 것을 씁니다. 항목마다 업체 하나가 되고, 지출금액이 있으면 완료된 결제로 들어갑니다.</p><textarea id="ib-text" style="width:100%;min-height:240px;padding:10px;border:1px solid var(--line2);border-radius:var(--r);font-size:12.5px" placeholder="웨딩홀\t계약금\t1,000,000\t2027-01-01\t1,000,000\t○○웨딩홀&#10;\t대관료\t5,000,000\t2027-01-01\t\t&#10;\t식대\t15,000,000\t2027-01-01\t\t보증인원 200명"></textarea>', [
    { label:'가져오기', cls:'primary', onClick:()=>{
      let cat='etc', lastCatName=''; const vendors=[], payments=[];
      $('#ib-text').value.split(/\n/).forEach(line => {
        const c = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(x=>x.replace(/^"|"$/g,'').trim());
        if (c.length < 2) return;
        if (/합계|총\s*금액|총\s*합계/.test(c[0]) || /합계/.test(c[1]||'')) return;
        if (c[0]) { lastCatName=c[0]; const hit = CAT_ALIAS.find(([re])=>re.test(c[0])); cat = hit ? hit[1] : (state.categories.find(x=>x.name===c[0])||{}).id || 'etc'; }
        const name = c[1]; if (!name || /^항목$/.test(name)) return;
        const amount = num(c[2]), date = /\d{4}-\d{2}-\d{2}/.test(c[3]||'') ? c[3].match(/\d{4}-\d{2}-\d{2}/)[0] : '', spent = num(c[4]), memo = [c[5]||'', lastCatName && !state.categories.find(x=>x.id===cat) ? '('+lastCatName+')' : ''].filter(Boolean).join(' ');
        if (!amount && !spent && !memo) return;
        const id = uid();
        vendors.push({ id, name, category:cat, status: amount||date ? 'contracted' : 'candidate', amountMode:'direct', amount, payer:'both', contact:{name:'',phone:''}, memo: memo + (date ? (memo?' · ':'')+'계약일 '+date : ''), links:[], questions:[], extras:[], createdAt:today() });
        if (spent) payments.push({ id:uid(), vendorId:id, title:'예약금(계약금)', amount:spent, dueDate:date, paidAt:date||today(), payer:'both', method:'card', memo:'엑셀에서 가져옴' });
      });
      if (!vendors.length) return toast('가져올 줄이 없습니다');
      closeSheet(); store.putMany('vendors', vendors); if (payments.length) store.putMany('payments', payments); toast(vendors.length+'개 항목을 가져왔습니다. 결제자·수단은 업체에서 고치세요'); } }
  ]);
}
