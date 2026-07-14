/* URP 워크스페이스 — 푸시 알림 Cloud Functions
 * ws_tasks 생성 → 담당/자문/공유자에게 푸시
 * ws_later / ws_grats / ws_mygrats 생성 → CEO에게 푸시
 */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const SITE = 'https://youareprofessor.github.io/urp-workspace/';

/* 서울(KST) 기준 오늘 날짜 키 — 클라이언트 형식 "Y-M-D"(0패딩 없음)와 일치 */
function seoulDateKey() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${kst.getUTCMonth() + 1}-${kst.getUTCDate()}`;
}

async function collectTokens(emails) {
  const set = new Set();
  for (const email of emails) {
    if (!email) continue;
    try {
      const snap = await db.collection('ws_members').doc(email).get();
      const toks = (snap.exists && snap.data().fcmTokens) || [];
      toks.forEach(t => t && set.add(t));
    } catch (e) { /* skip */ }
  }
  return [...set];
}

async function ceoEmails(excludeEmail) {
  const q = await db.collection('ws_members').where('code', '==', 'CEO').get();
  return q.docs.map(d => d.id).filter(e => e && e !== excludeEmail);
}

async function nameOf(email) {
  try { const s = await db.collection('ws_members').doc(email).get(); return (s.exists && s.data().name) || email; }
  catch (e) { return email; }
}

async function pushTo(tokens, title, body) {
  if (!tokens || !tokens.length) return;
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: { notification: { icon: '/urp-workspace/assets/forest.jpg' }, fcmOptions: { link: SITE } }
  });
  // 만료/무효 토큰 정리
  const bad = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const c = (r.error && r.error.code) || '';
      if (c.includes('registration-token-not-registered') || c.includes('invalid-argument')) bad.push(tokens[i]);
    }
  });
  if (bad.length) {
    const members = await db.collection('ws_members').get();
    for (const m of members.docs) {
      const toks = m.data().fcmTokens || [];
      const keep = toks.filter(t => !bad.includes(t));
      if (keep.length !== toks.length) await m.ref.update({ fcmTokens: keep });
    }
  }
}

/* 새 업무 → 담당/자문/공유자 (지시자 본인 제외) */
exports.onTaskCreate = functions.firestore.document('ws_tasks/{id}').onCreate(async (snap) => {
  const t = snap.data() || {};
  const recips = [t.assigneeEmail, ...(t.consultedEmails || []), ...(t.informedEmails || [])]
    .filter(Boolean).filter(e => e !== t.fromEmail);
  const tokens = await collectTokens([...new Set(recips)]);
  await pushTo(tokens, '🚗 새 업무', `${t.title || ''} — ${t.fromName || ''}님이 맡김`);
});

/* Later Must 등록 → CEO */
exports.onLaterCreate = functions.firestore.document('ws_later/{id}').onCreate(async (snap) => {
  const d = snap.data() || {};
  const tokens = await collectTokens(await ceoEmails(d.authorEmail));
  const body = d.shared ? `${d.authorName || ''}: ${(d.content || '').slice(0, 50)}`
    : `${d.authorName || ''}님이 Later Must에 담았어요`;
  await pushTo(tokens, '📌 Later Must 등록', body);
});

/* 팀 감사 나눔 → CEO */
exports.onGratShare = functions.firestore.document('ws_grats/{id}').onCreate(async (snap) => {
  const d = snap.data() || {};
  const tokens = await collectTokens(await ceoEmails(d.authorEmail));
  await pushTo(tokens, '🌿 팀 감사 나눔', `${d.authorName || ''}님이 팀과 감사를 나눴어요`);
});

/* 오늘의 감사 기록 → CEO (오늘 날짜만 — 과거 이전분 폭주 방지) */
exports.onMyGratCreate = functions.firestore.document('ws_mygrats/{id}').onCreate(async (snap) => {
  const d = snap.data() || {};
  if (d.date && d.date !== seoulDateKey()) return;
  const tokens = await collectTokens(await ceoEmails(d.email));
  const nm = await nameOf(d.email);
  await pushTo(tokens, '🌿 오늘의 감사', `${nm}님이 오늘의 감사를 기록했어요`);
});

/* 새 공지 → 슬랙 #공지 채널에 어푸가 알림 */
exports.onNoticeCreate = functions.firestore.document('ws_notices/{id}').onCreate(async (snap) => {
  const n = snap.data() || {};
  if (n.archived) return;
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_NOTICE_CHANNEL;
  if (!token || !channel) { console.warn('슬랙 토큰/채널 미설정 — 공지 알림 건너뜀'); return; }
  const type = n.type || '일반';
  const icon = type === '긴급' ? '🚨' : type === '정보' ? 'ℹ️' : '📢';
  const lines = [
    `${icon} *새 공지 · ${type}*`,
    `*${n.title || '(제목 없음)'}*`,
  ];
  if (n.content) lines.push(n.content);
  if (n.authorName) lines.push(`\n— ${n.authorName}`);
  lines.push(`\n<${SITE}|워크스페이스에서 보기>`);
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ channel, text: lines.join('\n'), username: '어푸', icon_emoji: ':robot_face:', unfurl_links: false })
    });
    const j = await res.json();
    if (!j.ok) console.error('공지→슬랙 실패:', j.error);
  } catch (e) { console.error('공지→슬랙 오류:', e); }
});

/* 새 미래스캔 요청 → 슬랙에 어푸가 알림 (요나단·어푸가 받아 EnvironmentScan 생성) */
exports.onFuturescanCreate = functions.firestore.document('ws_futurescan/{id}').onCreate(async (snap) => {
  const f = snap.data() || {};
  if (f.status === 'done') return;
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_NOTICE_CHANNEL;
  if (!token || !channel) { console.warn('슬랙 토큰/채널 미설정 — 미래스캔 알림 건너뜀'); return; }
  const lines = [
    `🔮 *새 미래스캔 요청*`,
    `*주제:* ${f.topic || '(주제 없음)'}`,
    f.requesterName ? `— ${f.requesterName}님 요청` : '',
    `\n요나단·어푸가 EnvironmentScan(STEEPs·미래신호·시나리오)으로 생성해 주세요.`,
    `\n<${SITE}|워크스페이스에서 보기>`,
  ].filter(Boolean);
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ channel, text: lines.join('\n'), username: '어푸', icon_emoji: ':crystal_ball:', unfurl_links: false })
    });
    const j = await res.json();
    if (!j.ok) console.error('미래스캔→슬랙 실패:', j.error);
  } catch (e) { console.error('미래스캔→슬랙 오류:', e); }
});

/* 새 미팅 잡기 → 참여자(만든 사람 제외) */
exports.onMeetingPollCreate = functions.firestore.document('ws_meetingpolls/{id}').onCreate(async (snap) => {
  const p = snap.data() || {};
  const emails = (p.participants || []).map(x => x.email).filter(e => e && e !== p.createdByEmail);
  const tokens = await collectTokens(emails);
  await pushTo(tokens, '🗓 새 미팅 잡기', `${p.title || ''} — ${p.createdByName || ''}님이 시간 투표를 요청했어요`);
});

/* 미팅 확정 → 참여자 전원 */
exports.onMeetingPollConfirm = functions.firestore.document('ws_meetingpolls/{id}').onUpdate(async (change) => {
  const before = change.before.data() || {};
  const after = change.after.data() || {};
  if (before.status === 'confirmed' || after.status !== 'confirmed') return;
  const emails = (after.participants || []).map(x => x.email).filter(Boolean);
  const tokens = await collectTokens(emails);
  await pushTo(tokens, '✓ 미팅 확정', `${after.title || ''} — ${after.confirmedDate || ''} ${String(after.confirmedHour).padStart(2, '0')}:00`);
});

/* 클로드 릴레이 — Anthropic이 홍콩(어푸 워커 콜로) 차단 → 미국(us-central1) 함수가 대신 호출.
 * urp-agents 워커가 x-relay-key 헤더 + Anthropic 요청 본문을 POST → 그대로 forward → 원본 응답 반환. */
exports.claudeRelay = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('POST only'); return; }
  if (req.get('x-relay-key') !== process.env.CLAUDE_RELAY_KEY) { res.status(403).json({ error: { type: 'forbidden', message: 'bad relay key' } }); return; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    const text = await r.text();
    res.status(r.status).set('content-type', 'application/json; charset=utf-8').send(text);
  } catch (e) {
    res.status(502).json({ error: { type: 'relay_error', message: String(e && e.message) } });
  }
});

/* ===== 공유 캘린더 새 팀 일정 → 슬랙 #일정 (개인 구글 동기화분은 제외) ===== */
exports.onCalendarCreate = functions.firestore.document('ws_calendar/{id}').onCreate(async (snap) => {
  const e = snap.data() || {};
  if (e.source === 'google') return;   // 개인 구글에서 딸려온 일정(교회 등)은 알림 제외 — 포털에 직접 올린 팀 일정만
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CAL_CHANNEL;
  if (!token || !channel) { console.warn('슬랙 토큰/일정채널 미설정 — 캘린더 알림 건너뜀'); return; }
  const when = (e.date || '') + (e.endDate ? ` ~ ${e.endDate}` : '') + (e.startTime ? ` ${e.startTime}${e.endTime ? '~' + e.endTime : ''}` : '');
  const lines = [
    `📅 *새 일정*`,
    `*${e.text || '(제목 없음)'}*`,
    when ? `🗓 ${when}` : '',
    (e.author || e.authorName) ? `— ${e.author || e.authorName}` : '',
    `\n<${SITE}|워크스페이스에서 보기>`,
  ].filter(Boolean);
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ channel, text: lines.join('\n'), username: '어푸', icon_emoji: ':calendar:', unfurl_links: false })
    });
    const j = await res.json();
    if (!j.ok) console.error('캘린더→슬랙 실패:', j.error);
  } catch (err) { console.error('캘린더→슬랙 오류:', err); }
});

/* ===== 타임트래커 미기입 알림 → 어푸가 슬랙 DM (평일 10·13·17시 KST, 대표 포함 전원) ===== */
async function slackFindUser(token, email, name) {
  try {
    const r = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), { headers: { Authorization: 'Bearer ' + token } }).then(x => x.json());
    if (r.ok && r.user) return r.user.id;
  } catch (e) { /* scope 없으면 아래로 폴백 */ }
  try {
    const l = await fetch('https://slack.com/api/users.list?limit=200', { headers: { Authorization: 'Bearer ' + token } }).then(x => x.json());
    const u = (l.members || []).find(m => {
      if (m.is_bot || m.deleted) return false;
      const p = m.profile || {};
      return p.email === email || (name && (p.real_name === name || p.display_name === name));
    });
    if (u) return u.id;
  } catch (e) { /* skip */ }
  return null;
}

exports.timetrackerNudge = functions.pubsub.schedule('0 10,13,17 * * 1-5').timeZone('Asia/Seoul').onRun(async () => {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) { console.warn('슬랙 토큰 미설정 — 타임트래커 알림 건너뜀'); return null; }
  const today = seoulDateKey();
  // 오늘 가능시간을 실제로 칠한 사람(hours 1칸 이상) 집합
  const av = await db.collection('ws_availability').where('date', '==', today).get();
  const filled = new Set();
  av.forEach(d => { const v = d.data() || {}; if ((v.hours || []).length > 0) filled.add(v.email); });
  // 전체 멤버 중 안 칠한 사람에게 어푸가 DM (대표 포함 전원, 현우는 명단에서 이미 빠짐)
  const members = await db.collection('ws_members').get();
  const msg = `⏱ 오늘 타임트래커에 가능시간이 아직 비어 있어요! 잠깐 칠해주세요 🙏\n<${SITE}|워크스페이스 열기>`;
  let sent = 0, missed = 0;
  for (const m of members.docs) {
    const email = m.id; const v = m.data() || {};
    if (filled.has(email)) continue;
    const uid = await slackFindUser(token, email, v.name);
    if (!uid) { missed++; console.warn('타임트래커 알림: 슬랙 유저 못 찾음 —', email, v.name); continue; }
    try {
      const open = await fetch('https://slack.com/api/conversations.open', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ users: uid }) }).then(x => x.json());
      if (!open.ok) { missed++; continue; }
      await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: open.channel.id, text: msg, username: '어푸', icon_emoji: ':owl:' }) });
      sent++;
    } catch (e) { missed++; }
  }
  console.log(`타임트래커 알림(${today}): ${sent}명 발송, ${missed}명 실패`);
  return null;
});

/* 팀원이 요나단 부르기로 요청·건의 → 대표(CEO)에게 어푸가 슬랙 DM (즉시 알림) */
exports.onYonathanCallCreate = functions.firestore.document('ws_yonathan_calls/{id}').onCreate(async (snap) => {
  const c = snap.data() || {};
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) { console.warn('슬랙 토큰 미설정 — 요청 알림 건너뜀'); return null; }
  const who = c.fromName || '누군가';
  const text = (c.text || '').replace(/\n/g, '\n> ');
  const msg = `🌤 *${who}* 님이 요청을 남겼어요\n> ${text}\n\n<${SITE}|받은 요청함에서 보기>`;
  let ceos = [];
  try { ceos = await ceoEmails(c.fromEmail); } catch (e) { ceos = []; }
  for (const email of ceos) {
    const uid = await slackFindUser(token, email);
    if (!uid) { console.warn('요청 알림: 슬랙 유저 못 찾음 —', email); continue; }
    try {
      const open = await fetch('https://slack.com/api/conversations.open', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ users: uid }) }).then(x => x.json());
      if (!open.ok) continue;
      await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: open.channel.id, text: msg, username: '어푸', icon_emoji: ':owl:' }) });
    } catch (e) { console.error('요청→슬랙 오류:', e); }
  }
  console.log(`요청 알림: ${who} → CEO ${ceos.length}명`);
  return null;
});

/* ===== 📚 공부할거 자동분석 — '지금 분석' → ws_study_jobs 생성 → 서버가 링크 읽고 클로드로 도입분석 카드 → Surf In(ws_docs) 저장 ===== */
const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
function isYoutubeUrl(url) { return /(?:youtube\.com|youtu\.be)/i.test(url || ''); }
function studySectionsToBlocks(sections) {
  const blocks = [];
  for (const s of sections || []) {
    if (s.h) blocks.push({ type: 'header', data: { text: String(s.h), level: s.level || 3 } });
    else if (s.h2) blocks.push({ type: 'header', data: { text: String(s.h2), level: 2 } });
    else if (s.p) blocks.push({ type: 'paragraph', data: { text: String(s.p) } });
    else if (s.ul) blocks.push({ type: 'list', data: { style: 'unordered', items: (s.ul || []).map(t => ({ content: String(t), items: [] })) } });
    else if (s.ol) blocks.push({ type: 'list', data: { style: 'ordered', items: (s.ol || []).map(t => ({ content: String(t), items: [] })) } });
    else if (s.hr) blocks.push({ type: 'delimiter', data: {} });
    else if (s.quote) blocks.push({ type: 'paragraph', data: { text: '<i>' + s.quote + '</i>' } });
  }
  return blocks;
}
async function fetchWebText(url) {
  try {
    const html = await fetch(url, { headers: { 'User-Agent': UA_BROWSER, 'Accept-Language': 'ko,en;q=0.9' } }).then(r => r.text());
    return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim().slice(0, 14000);
  } catch (e) { return ''; }
}
async function claudeText(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
  }).then(x => x.json());
  return (r && r.content && r.content[0] && r.content[0].text) || '';
}
exports.onStudyJobCreate = functions.firestore.document('ws_study_jobs/{id}').onCreate(async (snap) => {
  const job = snap.data() || {};
  const email = job.email, itemId = job.itemId, text = job.text || '', link = job.link || '';
  if (!email || !itemId) return null;
  const ref = db.collection('ws_myboard').doc(email);
  async function setStudy(status, extra) {
    try {
      const doc = await ref.get(); if (!doc.exists) return;
      const study = doc.data().study || [];
      const idx = study.findIndex(x => x.id === itemId); if (idx < 0) return;
      study[idx].status = status;
      if (extra) Object.assign(study[idx], extra);
      await ref.update({ study });
    } catch (e) { console.error('study 상태 업데이트 실패', e); }
  }
  if (!process.env.ANTHROPIC_API_KEY) { console.warn('ANTHROPIC_API_KEY 없음 — 자동분석 건너뜀'); await setStudy('new'); return null; }
  if (isYoutubeUrl(link)) { console.log('유튜브 링크 — 자막 API 연결 전이라 보류:', link); await setStudy('new'); return null; }
  try {
    await setStudy('analyzing');
    let source = text ? ('제목/메모: ' + text + '\n\n') : '';
    if (link) { const web = await fetchWebText(link); source += '링크: ' + link + '\n\n본문:\n' + (web || '(본문을 읽지 못함 — 제목·링크만으로 분석)'); }
    if (!source.trim()) source = text || link;
    const prompt = `당신은 교육 스타트업 "니가교수(URP)"의 도입검토 분석가입니다. 아래 자료를 우리 팀 도입 관점에서 한국어로 분석하세요. 반드시 아래 JSON만 출력(설명·코드블록 금지):
{"title":"짧은 제목","sections":[{"h":"한 줄 요약"},{"p":"..."},{"h":"핵심 내용"},{"ul":["..."]},{"h":"니가교수 적용점"},{"ul":["..."]},{"h":"도입 가능성"},{"p":"높음/중간/낮음 + 이유"},{"h":"리스크·한계"},{"ul":["..."]},{"h":"필요 리소스"},{"p":"..."},{"h":"다음 액션"},{"ul":["..."]},{"h":"출처"},{"p":"${link || '(링크 없음)'}"}]}

[자료]
${source}`;
    const out = await claudeText(prompt);
    let parsed = null;
    try { const m = out.match(/\{[\s\S]*\}/); parsed = JSON.parse(m ? m[0] : out); } catch (e) {}
    let title, sections;
    if (parsed && Array.isArray(parsed.sections)) { title = parsed.title || text || '요나단 분석'; sections = parsed.sections; }
    else { title = text || '요나단 분석'; sections = [{ h: '분석' }, { p: out || '분석 결과를 생성하지 못했어요.' }]; }
    const blocks = studySectionsToBlocks(sections);
    const nm = await nameOf(email);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection('ws_docs').add({
      title, data: { blocks }, shared: !!job.shared,
      authorName: nm || '요나단', authorEmail: email, authorCode: '', yonathan: true,
      createdAt: now, updatedAt: now
    });
    await setStudy('done', { docId: docRef.id, seen: false });
    console.log('공부할거 자동분석 완료:', email, itemId, docRef.id);
  } catch (e) {
    console.error('자동분석 오류:', e);
    await setStudy('new');
  }
  return null;
});
