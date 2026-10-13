/* Wedding Management · © 2026 myoung. All rights reserved.
 * 화면 전체가 같이 쓰는 상태 하나. */
/* ═══ 상태 ═════════════════════════════════ */
export const state = {
  view:'home', sub:{ budget:'money', plan:'timeline', guest:'list', more:'menu', trip:'plan' },
  plan:null, settings:{}, categories:[], vendors:[], payments:[], events:[], tasks:[], guests:[], memos:[],
  files:[], refTags:[], refFileTags:[], refLikes:[], members:[], invites:[], usage:0, quota:0,
  user:null, admin:false, mode:'local', filesOn:false, kakao:false, loading:true, openCat:null, refTag:'all', refWho:'all', guestF:'all', month:null, admData:null, fx:null
};
export const COLS = ['vendors','payments','events','tasks','guests','memos'];
