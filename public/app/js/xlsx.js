/* Wedding Management · © 2026 myoung. All rights reserved.
 * 아주 작은 엑셀(.xlsx) 읽기·쓰기. 라이브러리 없이 첫 시트의 글자만 다룬다.
 * 읽기: zip 을 풀어(DecompressionStream) 첫 시트를 [[칸,…],…] 로. 쓰기: 압축 없는 zip 으로 양식 한 장. */

/* ── zip ── */
const td = new TextDecoder();
async function inflate(bytes){
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function unzip(buf){
  const dv = new DataView(buf); let e = buf.byteLength - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('엑셀(.xlsx) 파일이 아닙니다');
  const files = {}; let p = dv.getUint32(e + 16, true);
  for (let i = 0, n = dv.getUint16(e + 10, true); i < n; i++) {
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    files[td.decode(new Uint8Array(buf, p + 46, nl))] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
    p += 46 + nl + xl + cl;
  }
  return async name => {
    const f = files[name]; if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
    const raw = new Uint8Array(buf, start, f.size);
    return td.decode(f.method === 8 ? await inflate(raw) : raw);
  };
}
const xml = s => new DOMParser().parseFromString(s, 'application/xml');
const tags = (node, name) => [...node.getElementsByTagName(name)];

/* 첫 시트를 2차원 글자 배열로 */
export async function readXlsx(buf){
  const get = unzip(buf);
  /* 첫 시트 경로: workbook.xml 의 첫 sheet → rels 의 Target. 못 찾으면 sheet1 */
  let path = 'xl/worksheets/sheet1.xml';
  try {
    const wb = xml(await get('xl/workbook.xml')), rels = xml(await get('xl/_rels/workbook.xml.rels'));
    const rid = tags(wb, 'sheet')[0].getAttribute('r:id');
    const t = tags(rels, 'Relationship').find(r => r.getAttribute('Id') === rid).getAttribute('Target');
    path = t.startsWith('/') ? t.slice(1) : 'xl/' + t;
  } catch (e) {}
  const sheet = await get(path); if (!sheet) throw new Error('엑셀에서 시트를 찾지 못했습니다');
  const ss = await get('xl/sharedStrings.xml');
  /* 공유 문자열. 일본어 읽기(rPh) 같은 덧붙임은 빼고 본문 t 만 */
  const shared = ss ? tags(xml(ss), 'si').map(si => tags(si, 't').filter(t => t.parentNode.nodeName !== 'rPh').map(t => t.textContent).join('')) : [];
  const rows = [];
  tags(xml(sheet), 'row').forEach(r => {
    const row = [];
    tags(r, 'c').forEach((c, i) => {
      const ref = c.getAttribute('r'), col = ref ? [...ref.replace(/\d+$/, '')].reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1 : i;
      const type = c.getAttribute('t'), v = tags(c, 'v')[0];
      row[col] = type === 's' ? shared[+v.textContent] ?? '' : type === 'inlineStr' ? tags(c, 't').map(t => t.textContent).join('') : type === 'b' ? (v && v.textContent === '1' ? 'O' : '') : v ? v.textContent : '';
    });
    rows[(+r.getAttribute('r') || rows.length + 1) - 1] = Array.from(row, x => x ?? '');
  });
  return Array.from(rows, x => x || []);
}

/* ── 쓰기 ── */
const te = new TextEncoder();
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = b => { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
function zip(entries){   // 압축 없이(stored) 묶는다
  const parts = [], cen = []; let off = 0;
  for (const [name, text] of entries) {
    const nb = te.encode(name), data = te.encode(text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [8, 0, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, nb.length, 2]].forEach(([o, v, n]) => n === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
    const c = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, nb.length, 2], [42, off, 4]].forEach(([o, v, n]) => n === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true));
    parts.push(h, nb, data); cen.push(c, nb); off += 30 + nb.length + data.length;
  }
  const size = cen.reduce((s, x) => s + x.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [8, entries.length, 2], [10, entries.length, 2], [12, size, 4], [16, off, 4]].forEach(([o, v, n]) => n === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true));
  return new Blob([...parts, ...cen, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = i => (i >= 26 ? colName(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + i % 26);

/* rows: [[글자,…],…] 첫 줄은 머리글로 굵게. widths: 칸 너비. lists: { 열번호: [고를 값,…] } 는 드롭다운 */
export function writeXlsx(rows, { widths = [], lists = {}, sheet = 'Sheet1', listRows = 500 } = {}){
  const cells = rows.map((r, y) => '<row r="' + (y + 1) + '">' + r.map((v, x) => v === '' || v == null ? '' :
    '<c r="' + colName(x) + (y + 1) + '" t="inlineStr"' + (y === 0 ? ' s="1"' : '') + '><is><t>' + esc(v) + '</t></is></c>').join('') + '</row>').join('');
  const dv = Object.entries(lists).map(([x, opts]) => '<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="' + colName(+x) + '2:' + colName(+x) + listRows + '"><formula1>"' + esc(opts.join(',')) + '"</formula1></dataValidation>');
  const ws = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    (widths.length ? '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' : '') +
    '<sheetData>' + cells + '</sheetData>' + (dv.length ? '<dataValidations count="' + dv.length + '">' + dv.join('') + '</dataValidations>' : '') + '</worksheet>';
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + esc(sheet) + '" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml', ws]
  ]);
}
