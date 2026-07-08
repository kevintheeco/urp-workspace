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
