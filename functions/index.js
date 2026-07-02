/* URP 워크스페이스 — 푸시 알림 Cloud Functions
 * ws_tasks 생성 → 담당/자문/공유자에게 푸시
 * ws_later / ws_grats / ws_mygrats 생성 → CEO에게 푸시
 */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const SITE = 'https://kevintheeco.github.io/urp-workspace/';

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
