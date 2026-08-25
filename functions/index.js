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

/* ===== 📚 공부할거 — 서버 자동분석 폐기(2026-07-20). 검색·기억 없는 raw API 호출이라 8칸 스펙과 어긋나 요나단 세션 경로로 통일. claudeText는 아침 브리핑용으로 유지 ===== */
async function claudeText(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 3000, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: prompt }] })
  }).then(x => x.json());
  return (r && r.content && r.content[0] && r.content[0].text) || '';
}

/* ===== 🌅 아침 능동 브리핑 — 어푸가 팀 현황을 종합해 대표에게 선제 브리핑 (평일 08시 KST) ===== */
async function buildMorningBrief() {
  const today = seoulDateKey();   // 패딩 없음 — ws_availability(today())와 일치
  const yd = new Date(Date.now() + 9 * 3600 * 1000 - 86400000);
  const pad = n => String(n).padStart(2, '0');   // ws_checkins는 패딩 있음(ckToday())
  const kd = new Date(Date.now() + 9 * 3600 * 1000);
  const todayP = `${kd.getUTCFullYear()}-${pad(kd.getUTCMonth() + 1)}-${pad(kd.getUTCDate())}`;
  const yestP = `${yd.getUTCFullYear()}-${pad(yd.getUTCMonth() + 1)}-${pad(yd.getUTCDate())}`;
  const nameBy = {};
  try { const ms = await db.collection('ws_members').get(); ms.forEach(m => { nameBy[m.id] = (m.data() || {}).name || m.id; }); } catch (e) {}
  let ctx = `오늘=${today}\n\n[팀 체크인(어제~오늘)]\n`;
  try {
    const ck = await db.collection('ws_checkins').get();
    const rows = ck.docs.map(d => d.data()).filter(r => r && (r.date === todayP || r.date === yestP));
    if (rows.length) rows.forEach(c => { ctx += `- ${nameBy[c.email] || c.email}: 한것[${(c.done || '-').slice(0, 70)}] 막힌것[${(c.blocked || '-').slice(0, 70)}] 할것[${(c.plan || c.next || '-').slice(0, 70)}]\n`; });
    else ctx += '(체크인 없음)\n';
  } catch (e) { ctx += '(체크인 조회 실패)\n'; }
  ctx += '\n[오늘 가능시간]\n';
  try {
    const av = await db.collection('ws_availability').where('date', '==', today).get();
    if (av.size) av.forEach(d => { const r = d.data() || {}; ctx += `- ${nameBy[r.email] || r.email}: ${r.allDayNo ? '종일불가' : ((r.hours || []).length + '칸')}\n`; });
    else ctx += '(미입력)\n';
  } catch (e) {}
  ctx += '\n[미처리 요청]\n';
  try {
    const rq = await db.collection('ws_yonathan_calls').where('done', '==', false).get();
    if (rq.size) rq.forEach(d => { const r = d.data() || {}; ctx += `- ${r.fromName || '누군가'}: ${(r.text || '').slice(0, 90)}\n`; });
    else ctx += '(없음)\n';
  } catch (e) {}
  const prompt = `너는 URP(니가교수) 대표 김수민의 슬랙 비서 '어푸'다. 아래 팀 현황을 보고 대표가 하루를 시작할 때 딱 필요한 것만 골라 아침 브리핑을 써라. 규칙: 짧은 인사 한 줄로 시작, 전체 5줄 이내, 막힌 것·처리할 요청·오늘 놓치면 안 되는 것을 우선, 없는 건 억지로 만들지 말고 조용한 날이면 짧게. 따뜻하고 간결한 한국어.\n\n${ctx}`;
  const brief = await claudeText(prompt);
  return { brief: brief || '', ctx };
}
async function sendMorningBrief() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !process.env.ANTHROPIC_API_KEY) { console.warn('아침 브리핑: 토큰/키 미설정'); return 0; }
  const { brief } = await buildMorningBrief();
  if (!brief) return 0;
  const msg = `🌅 *아침 브리핑*\n\n${brief}`;
  let sent = 0, ceos = [];
  try { ceos = await ceoEmails(''); } catch (e) {}
  for (const email of ceos) {
    const uid = await slackFindUser(token, email);
    if (!uid) continue;
    try {
      const open = await fetch('https://slack.com/api/conversations.open', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ users: uid }) }).then(x => x.json());
      if (!open.ok) continue;
      await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: open.channel.id, text: msg, username: '어푸', icon_emoji: ':owl:' }) });
      sent++;
    } catch (e) {}
  }
  return sent;
}
exports.morningBrief = functions.pubsub.schedule('0 8 * * 1-5').timeZone('Asia/Seoul').onRun(async () => {
  const n = await sendMorningBrief(); console.log('아침 브리핑 발송:', n); return null;
});
/* 즉시 테스트용(self-key 보호) — 배포 검증 후 그대로 둬도 무해 */
exports.testMorningBrief = functions.https.onRequest(async (req, res) => {
  if (req.get('x-relay-key') !== process.env.CLAUDE_RELAY_KEY) { res.status(403).send('forbidden'); return; }
  const n = await sendMorningBrief();
  res.json({ ok: true, sent: n });
});

/* ===== 📕 클로징 리포트 밤 현황 — 대표에게만 (팀원 독촉 DM 없음, 2026-08-25 대표 지시) =====
 * 8/19 대면세션 루틴: 풀타임(수민·지민·정범)=평일 매일 / 파트타임=주 3일 본인 지정.
 * ws_closings는 0패딩 날짜(ckToday 형식)를 쓴다 — seoulDateKey()(패딩 없음)와 섞지 말 것. */
const CLOSING_FULLTIME = ['soomin020114@gmail.com', 'tangbole0430@gmail.com', 'sjmjis0208@gmail.com'];
function seoulPaddedKey(offsetDays) {
  const k = new Date(Date.now() + 9 * 3600 * 1000 + (offsetDays || 0) * 86400000);
  const p = n => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}`;
}
function dowOf(dateStr) { const a = dateStr.split('-').map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay(); }
function closingWeekKey(dateStr) {
  const a = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(a[0], a[1] - 1, a[2]));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));   // 월요일 기준
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
// offsetDays: 0=오늘, -1=어제. 자정에 돌리므로 기본은 '방금 끝난 하루'(어제).
async function buildClosingBrief(offsetDays) {
  const date = seoulPaddedKey(offsetDays == null ? -1 : offsetDays);
  const dow = dowOf(date);
  const wk = closingWeekKey(date);
  const members = await db.collection('ws_members').get();
  const daysBy = {};
  try {
    const ds = await db.collection('ws_closing_days').where('weekKey', '==', wk).get();
    ds.forEach(d => { const r = d.data() || {}; daysBy[r.email] = r.days || []; });
  } catch (e) { /* skip */ }
  const rows = {};
  try {
    const cs = await db.collection('ws_closings').where('date', '==', date).get();
    cs.forEach(d => { const r = d.data() || {}; rows[r.email] = r; });
  } catch (e) { /* skip */ }

  const done = [], excused = [], missing = [], unset = [];
  members.forEach(m => {
    const email = m.id, v = m.data() || {}, nm = v.name || email;
    const full = CLOSING_FULLTIME.includes(email);
    const due = full ? (dow >= 1 && dow <= 5) : (daysBy[email] || []).includes(dow);
    const r = rows[email];
    if (r && r.status === '제출') done.push(`${nm} ${r.hours || '?'}시간${r.note ? ' — ' + String(r.note).slice(0, 40) : ''}`);
    else if (r && r.status === '사전보고') excused.push(`${nm} — ${String(r.excuse || '').slice(0, 50)}${r.advanceHours >= 24 ? ' (24시간 전 ✓)' : ''}`);
    else if (due) missing.push(nm);
    else if (!full && !(daysBy[email] || []).length) unset.push(nm);
  });

  const dueCount = done.length + excused.length + missing.length;
  let msg = `📕 *클로징 리포트 현황* — ${date}\n`;
  msg += `제출 ${done.length} · 사전보고 ${excused.length} · 미제출 ${missing.length}\n`;
  if (done.length) msg += `\n✅ ${done.join('\n✅ ')}`;
  if (excused.length) msg += `\n🕗 ${excused.join('\n🕗 ')}`;
  if (missing.length) msg += `\n⛔ 아직 안 낸 사람: ${missing.join(', ')}`;
  if (unset.length) msg += `\n🗓 이번 주 클로징 데이 미지정: ${unset.join(', ')}`;
  msg += `\n\n<${SITE}|워크스페이스에서 보기>`;
  return { msg, dueCount, quiet: dueCount === 0 && !unset.length };
}
async function sendClosingBrief(offsetDays) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) { console.warn('클로징 현황: 슬랙 토큰 미설정'); return 0; }
  const { msg, quiet } = await buildClosingBrief(offsetDays);
  if (quiet) { console.log('클로징 현황: 의무 제출자 없는 날 — 건너뜀'); return 0; }
  let sent = 0, ceos = [];
  try { ceos = await ceoEmails(''); } catch (e) {}
  for (const email of ceos) {
    const uid = await slackFindUser(token, email);
    if (!uid) continue;
    try {
      const open = await fetch('https://slack.com/api/conversations.open', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ users: uid }) }).then(x => x.json());
      if (!open.ok) continue;
      await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: open.channel.id, text: msg, username: '어푸', icon_emoji: ':owl:' }) });
      sent++;
    } catch (e) { console.error('클로징 현황→슬랙 오류:', e); }
  }
  return sent;
}
/* 자정(KST)에 '방금 끝난 하루'를 집계 → 화~토 00:00이 곧 월~금 밤이다 (2026-08-25 대표 지시) */
exports.closingBrief = functions.pubsub.schedule('0 0 * * 2-6').timeZone('Asia/Seoul').onRun(async () => {
  const n = await sendClosingBrief(-1); console.log('클로징 현황 발송:', n); return null;
});
/* 배포 검증용 — 문구만 보려면 ?dry=1, 날짜 바꾸려면 ?offset=0 (0=오늘, -1=어제) */
exports.testClosingBrief = functions.https.onRequest(async (req, res) => {
  if (req.get('x-relay-key') !== process.env.CLAUDE_RELAY_KEY) { res.status(403).send('forbidden'); return; }
  const off = req.query.offset != null ? Number(req.query.offset) : -1;
  if (req.query.dry) { const b = await buildClosingBrief(off); res.json({ ok: true, dry: true, ...b }); return; }
  const n = await sendClosingBrief(off);
  res.json({ ok: true, sent: n });
});
