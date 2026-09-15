"""Build the three independent tablet handwriting worksheets from the proven Q14 pad."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
Q14 = ROOT / "ink-film-14.html"

GUIDES = {
    14: [
        {
            "title": "왼쪽 식의 극값과 끝점",
            "where": "필기장 왼쪽 위",
            "text": "f₁(x)=2x³−6x+1  (x≤2)\nf₁′(x)=6x²−6=0 → x=−1, 1\nf(−1)=5, f(1)=−3\nf(2−)=f(2)=2·2³−6·2+1=5",
            "note": "왜 f(2)를 넣나요? x=2는 왼쪽 식에 포함되는 마지막 점입니다. 곡선을 어디서 끝내고 점을 채울지 정하려면 그 높이 5가 필요합니다. 오른쪽 식을 x=2까지 연장하면 9라서 실제 f(2)=5와 다릅니다. 이 차이 때문에 수평선의 교점 수도 달라집니다.",
        },
        {
            "title": "왼쪽 삼차곡선 그리기",
            "where": "필기장 가운데 왼쪽의 넓은 자리",
            "text": "1. 가로 x축·세로 y축을 그립니다.\n2. x=−1, 1, 2를 x축에 표시합니다. y=5, −3을 y축에 표시합니다.\n3. (−1,5) 극대, (1,−3) 극소, (2,5) 끝점을 찍습니다.\n4. 왼쪽 아래 → (−1,5)까지 상승 → (1,−3)까지 하강 → (2,5)까지 상승하는 한 줄 곡선을 그립니다.\n5. (2,5)는 채운 점. x>2 쪽은 아직 그리지 않습니다.",
            "note": "무슨 곡선을 그리나요? y=f₁(x)=2x³−6x+1의 x≤2 부분입니다. 오른쪽 이차함수와 합쳐 그리지 마세요. 점의 상대 높이를 먼저 잡고 부드럽게 이으면 됩니다. 화면의 ‘왼쪽 그래프 모양 보기’를 열면 모양을 확인할 수 있습니다.",
        },
        {
            "title": "오른쪽 식과 빈 시작점",
            "where": "① 필기장 오른쪽 위 새 식칸 → ② 2/7에서 그린 그래프의 x=2 바로 위",
            "text": "① 오른쪽 위 빈 칸에 새 식을 씁니다.\nf₂(x)=a(x−2)(x−b)+9  (x>2에서 쓰는 이차식)\n그 아래: f₂(2)=9, f₂(b)=9 / 실제 f(2)=5\n② 왼쪽에서 그렸던 그래프의 x=2로 돌아갑니다.\n(2,5) ●의 바로 위 높이 9에 (2,9) ○를 찍습니다.",
            "note": "① 붉은 점선 칸은 오른쪽 식 f₂와 경계의 두 높이를 비교해 적는 자리입니다. ② 파란 점선 칸은 앞서 그린 그래프를 찾아 빈 점을 찍는 자리입니다. f₂(2)=9는 오른쪽 식을 x=2까지 연장한 값이고 실제 f(2)=5라서 점을 겹쳐 칠할 수 없습니다. 칸이 좁으면 f₂(x)=를 한 줄, a(x−2)(x−b)+9를 다음 줄에 써도 됩니다. f₂(b)=9는 b>2일 때 실제 오른쪽 가지의 점입니다.",
        },
        {
            "title": "승주형 원문의 잘못된 시도",
            "where": "2/7의 그래프에서 (2,9) 빈 점 ○의 오른쪽 · 주황 점선 자리",
            "text": "① 기존 그래프의 (2,9) 빈 점 ○에서 시작합니다.\n② 그 점 오른쪽으로 곡선을 위로 올려, x=2와 x=b 사이에서 꼭대기를 만듭니다.\n③ 다시 내려와 x=b에서 높이 9를 지나게 이어 ∩ 모양을 만듭니다.\n④ 곧바로 지우지 마세요. 펜을 떼고 방금 그린 곡선과 오른쪽 식을 다시 봅니다.\n⑤ 학생이 혼자 이유를 찾으려다 막히는 멈춤을 남깁니다. 그 뒤에 5/7로 넘어갑니다.",
            "note": "단계 안의 주황 벡터 그림을 보고 선의 경로만 따라 그리세요. 수치 b=6은 위치를 보여주는 예시이며 실제 답의 a,b를 확정한 것이 아닙니다. 이 ∩은 a가 자연수라는 조건과 맞지 않는 학생의 실수입니다. 영상에는 틀린 획 뒤 학생의 자발적 검토와 막힘을 먼저 보여주세요. 실제로 몇 분이 지났는지는 중요하지 않습니다. 그다음 Provee가 첫 줄을 짚으면 5/7에서 이 곡선 획만 지우고 ∪로 바꿉니다.",
        },
        {
            "title": "자연수 조건으로 곡선 고치기",
            "where": "① 오른쪽 위에 a>0 → ② 같은 그래프의 (2,9) ○ 오른쪽",
            "text": "4/7에서 학생이 스스로 검토하다 막힌 뒤, Provee가 문제 첫 줄 ‘두 자연수 a, b’를 짚습니다.\n그 줄을 다시 보고 오른쪽 위에 직접 적습니다: a는 자연수 → a>0\n오른쪽 식의 x² 계수 a>0 → 곡선은 ∪\n4/7의 ∩ 곡선 획만 지웁니다.\n(2,9) ○에서 오른쪽 아래로 내려가 중간 꼭짓점을 지나, 다시 올라와 x=b의 높이 9를 지나게 ∪로 고쳐 그립니다.",
            "note": "왜 ∪인가요? 이차식의 x² 계수가 양수 a이기 때문입니다. 단계 안의 붉은 벡터 그림은 (a,b)=(3,6)일 때의 모양 예시입니다. 이 단계에서는 실제 a,b나 꼭짓점 높이를 확정하지 말고 높이를 m으로 남겨 두세요. (2,9)는 빈 점이고 b>2일 때 (b,9)는 실제 곡선의 점입니다.",
        },
        {
            "title": "b의 뜻 확인·수평선으로 교점 세기",
            "where": "① 기존 그래프 오른쪽 x축에 b? 표시 → ② 그래프를 지나는 y=t 가로선 → ③ 필기장 아래 왼쪽에 교점 개수",
            "text": "먼저 b의 뜻: f₂(x)=a(x−2)(x−b)+9에서 아직 모르는 자연수입니다.\nx=b를 넣으면 (x−b)=0 → f₂(b)=9. 따라서 b는 y=9를 다시 만나는 x좌표입니다.\n① 기존 x축의 2 오른쪽에 ‘b?’를 쓰세요. 지금 b=6 같은 숫자를 확정하지 않습니다.\n② b≤2면 오른쪽 가지(x>2)에 두 번째 y=9 점이 없고, −3<t<5에서 g(t)=3인 높이가 여러 개라 제외합니다.\n③ b>2면 (2,9) ○와 (b,9) ● 사이의 ∪ 꼭짓점: x=(2+b)/2, 높이 m=9−a(b−2)²/4.\n④ y=t 가로선을 아래→위로 옮기며 양쪽 곡선의 교점을 셉니다. m≠−3이면 g(t)=3인 높이가 여러 개, m=−3이면 k=−3 한 곳에서 g(k−),g(k),g(k+)=1,3,5 → 합 9입니다.",
            "note": "b는 답으로 찾기 전까지 미지수입니다. 화면의 벡터 그림에서 x=b는 오른쪽 ∪가 y=9를 다시 지나는 위치일 뿐, 특정 숫자를 뜻하지 않습니다. g(t)는 높이 t의 가로선이 전체 그래프와 만나는 점의 개수이고 m은 ∪의 가장 낮은 높이입니다. 문제를 위에서 다시 읽고 돌아온 시간은 필기 공백에 섞일 수 있으므로 그 공백을 곧바로 망설임으로 해석하지 않습니다.",
        },
        {
            "title": "자연수 후보와 답",
            "where": "① 필기장 아래 오른쪽에 후보 계산 → ② 위의 ‘시험지 문제 위에 표시하기’에서 선택지 ①",
            "text": "① 필기장 아래 오른쪽에 계산합니다.\nf₂((2+b)/2)=−3\n9−a(b−2)²/4=−3 → a(b−2)²=48\n(a,b)=(48,3), (12,4), (3,6)\na+b=51, 16, 9 → 최댓값 51\n② 시험지 문제 면으로 올라가 선택지 ① 51을 펜으로 체크합니다.",
            "note": "왜 자연수를 다시 보나요? m=−3은 그래프 조건이고, 마지막에는 자연수 a,b라는 문제 첫 줄을 숫자 조건에 적용해야 합니다. 세 후보를 모두 비교한 뒤 실제 시험지의 ①을 체크하는 손동작을 남겨 주세요. 문제 면과 풀이장 획은 한 저장 파일에 함께 들어갑니다.",
        },
    ],
    10: [
        {
            "title": "무엇을 구하는 문제인가",
            "where": "필기장 왼쪽 위",
            "text": "P,Q는 t=0에 원점 출발\nv₁(t)=t²−6t+5, v₂(t)=2t−7\nf(t)=P,Q 사이 거리\nf: [0,a] 증가 → [a,b] 감소 → [b,∞) 증가\n구할 것: t=a부터 t=b까지 Q가 움직인 거리",
            "note": "왜 먼저 구할 것을 쓰나요? 두 점 사이 거리 f(t)의 증감 경계 a,b를 찾은 뒤, 마지막 질문은 Q 한 점이 그 시간 동안 실제로 움직인 총 거리입니다. Q의 끝 위치에서 시작 위치를 뺀 값과 다를 수 있습니다.",
        },
        {
            "title": "속도를 위치로 바꾸기",
            "where": "필기장 왼쪽 가운데",
            "text": "x₁(t)=t³/3−3t²+5t+C₁\nx₂(t)=t²−7t+C₂\nC₁,C₂를 아직 지우거나 같은 값으로 합치지 않습니다.\n승주형의 C 질문이 들어갈 순간을 위해 잠깐 멈춥니다.",
            "note": "왜 C를 따로 남기나요? 속도를 부정적분하면 P와 Q의 위치에 각각 C₁,C₂가 생깁니다. 두 값이 같다고 아직 증명하지 않았으므로 임의로 소거하면 안 됩니다. 다음 두 단계에서 거리 표기와 원점 출발 조건을 차례로 확인합니다.",
        },
        {
            "title": "두 점 사이 거리 쓰기",
            "where": "필기장 가운데 위",
            "text": "승주형 학생의 첫 시도: f(t)=x₁(t)−x₂(t)\n‘거리’ 확인 후: f(t)=|x₁(t)−x₂(t)|\n=|t³/3−4t²+12t+C₁−C₂|\nC₁−C₂는 아직 남겨 둡니다.",
            "note": "왜 절댓값을 쓰나요? 거리는 음수가 될 수 없기 때문입니다. 지금은 두 상수를 아직 정하지 않아 C₁−C₂를 남겨야 합니다. 노션의 −2t² 정리는 계산 오류라 따라 쓰지 마세요. 이 문제에서는 상수를 바르게 정한 뒤 t≥0에서 위치 차가 0 이상임을 확인할 수 있습니다.",
        },
        {
            "title": "원점 출발 → C 해결 → a,b 찾기",
            "where": "필기장 가운데 왼쪽",
            "text": "문제의 ‘원점 출발’: x₁(0)=x₂(0)=0\n→ C₁=0, C₂=0\nf(t)=|x₁−x₂|=t(t−6)²/3  (t≥0)\nf′(t)=(t−2)(t−6)\n증가→감소→증가 경계: a=2, b=6",
            "note": "왜 이제 C가 0인가요? 두 점이 t=0에 원점에 있었다는 문제 문장을 각 위치식에 넣었기 때문입니다. 부정적분 후 초기 조건을 적용하는 방법도 맞습니다. 그다음 f를 미분해 증감 부호가 바뀌는 2와 6을 찾습니다. 아직 Q의 총 이동거리는 계산하지 않았습니다.",
        },
        {
            "title": "Q가 방향 바꾸는 시간",
            "where": "필기장 오른쪽 위, 시간선 그림",
            "text": "Q의 속도 v₂(t)=2t−7=0 → t=7/2\n2 < t < 7/2: v₂<0, 왼쪽으로 이동\n7/2 < t < 6: v₂>0, 오른쪽으로 이동\n시간선에 2 ── 7/2 ── 6을 그리고 방향 화살표를 표시",
            "note": "왜 7/2에서 나누나요? Q는 a=2부터 b=6까지 한쪽으로만 가지 않습니다. 속도의 부호가 바뀌는 t=7/2를 지나 되돌아오므로 두 구간의 이동 길이를 각각 더해야 합니다. 화면의 시간선 그림을 참고하세요.",
        },
        {
            "title": "각 구간의 이동 길이",
            "where": "필기장 오른쪽 가운데",
            "text": "2→7/2: ∫₂^(7/2)(7−2t)dt=9/4\n7/2→6: ∫_(7/2)^6(2t−7)dt=25/4\n총 이동거리=9/4+25/4=17/2",
            "note": "왜 첫 구간은 7−2t인가요? 그때 v₂가 음수라 이동 길이는 |v₂|=−v₂=7−2t입니다. 두 적분은 각각 양의 길이를 나타냅니다. 시작과 끝의 위치 차 4를 답으로 쓰면 되돌아간 길이를 놓칩니다.",
        },
        {
            "title": "답과 승주형 강조 연결",
            "where": "필기장 오른쪽 아래",
            "text": "a=2, b=6\nQ 이동거리=17/2 → ②\n원점 출발 조건으로 C₁=C₂=0을 정한 부분에 동그라미",
            "note": "승주형이 볼드로 강조한 것은 절댓값 대화보다 적분상수 C를 원점 출발 조건과 연결하는 여섯 문장입니다. 영상에서는 C를 확인하는 필기와 마지막 Q 이동거리 계산을 다른 순간으로 보여주세요.",
        },
    ],
    3: [
        {
            "title": "문제의 두 조건 표시",
            "where": "필기장 왼쪽 위",
            "text": "3π/2 < θ < 2π → θ는 제4사분면\nsin(−θ)=1/3\n구할 것: tan θ",
            "note": "왜 −θ를 표시하나요? 주어진 양수 1/3은 sin θ가 아니라 sin(−θ)의 값입니다. sin(−θ)=−sin θ이므로 실제 θ의 세로 좌표는 음수입니다. 문제 첫 줄의 사분면 조건이 답의 부호를 정합니다.",
        },
        {
            "title": "길이 3·1·2√2의 삼각형",
            "where": "필기장 가운데 왼쪽",
            "text": "기준각용 직각삼각형을 그립니다.\n빗변=3, 세로 길이=1\n밑변²=3²−1²=8 → 밑변=2√2\n길이만 표시하고 아직 θ의 부호를 정하지 않습니다.",
            "note": "어떤 그림인가요? 승주형 학생이 처음 그린 것은 길이를 찾는 기준각 삼각형입니다. 높이 1은 양의 ‘길이’이고 실제 제4사분면의 y좌표는 −1입니다. 화면의 그림에서 오른쪽 아래 방향을 확인할 수 있습니다.",
        },
        {
            "title": "승주형 학생의 양수 오답 시도",
            "where": "① 필기장 가운데 위에 양수 계산 → ② 위의 ‘시험지 문제 위에 표시하기’에서 선택지 ⑤",
            "text": "① 길이만 보고 1/(2√2)=√2/4를 씁니다.\n② 조건 첫 줄을 아직 확인하지 않은 학생의 장면: 시험지 문제 면으로 올라가 ⑤ √2/4를 그대로 펜으로 체크합니다.\n이 ⑤는 의도적 오답 시도이므로 바로 수정하지 말고 잠깐 남깁니다.",
            "note": "왜 ⑤를 실제로 체크하나요? 승주형 원문에서는 학생이 삼각형 길이는 맞게 구했지만 사분면을 빼먹어 양수 ⑤를 고르려 합니다. 대표님이 말한 ‘별생각 없이 ⑤ 체크’ 동작을 시험지 위에 직접 남길 수 있습니다. 영상에서 학생의 실수로 보여주는 획이며 정답은 아닙니다.",
        },
        {
            "title": "문제 첫 줄로 돌아가기",
            "where": "필기장 맨 위의 조건 → 그림",
            "text": "문제 조건 3π/2<θ<2π에 밑줄\nθ는 오른쪽 아래, 제4사분면\nsin θ=−1/3, cos θ>0",
            "note": "승주형 프루비가 강조한 질문은 ‘문제 맨 앞의 조건에서 θ가 제4사분면인데 체크했어?’입니다. 정답을 먼저 주기보다 학생이 빠뜨린 첫 줄을 다시 보게 합니다.",
        },
        {
            "title": "삼각형을 실제 방향으로 고치기",
            "where": "같은 그림 오른쪽 또는 새 그림",
            "text": "좌표축을 그리고 원점에서 오른쪽 아래로 빗변 3을 그립니다.\n끝점의 가로 방향 +2√2, 세로 방향 −1\n제4사분면에 θ 표시. 기존 길이 3·1·2√2는 유지",
            "note": "무슨 선을 그리나요? 원점에서 (2√2,−1) 쪽으로 내려가는 사선이 빗변입니다. 끝점에서 x축까지 세로 보조선을 그리면 아래쪽 높이의 부호가 −임을 볼 수 있습니다. 필요하면 이전 양수 표시만 지우세요.",
        },
        {
            "title": "탄젠트 부호 수정",
            "where": "필기장 오른쪽 가운데",
            "text": "tan θ=(세로 좌표)/(가로 좌표)\n=−1/(2√2)=−√2/4\n⑤ 양수 시도 → ② 음수 답",
            "note": "왜 음수인가요? 제4사분면에서는 x가 양수, y가 음수이므로 y/x가 음수입니다. 삼각형의 길이는 그대로 맞았고, 고친 것은 방향과 부호입니다.",
        },
        {
            "title": "조건 확인 장면 마무리",
            "where": "① 필기장 오른쪽 아래에 수정 답 → ② 시험지 문제 면의 기존 ⑤와 선택지 ②",
            "text": "sin(−θ)=1/3 ↔ sin θ=−1/3\nθ: 제4사분면\ntan θ=−√2/4 → ②\n시험지 문제 면에서 앞서 체크한 ⑤ 획을 지우고, 선택지 ②를 새로 체크합니다.",
            "note": "승주형 노션의 3번은 다섯 장면 모두 볼드입니다. 별생각 없이 ⑤를 체크한 획, 첫 줄을 확인한 흔적, 그 획을 지운 시점과 ②를 새로 체크한 획이 한 기록에 남으면 학생이 스스로 고친 과정이 보입니다.",
        },
    ],
}
GUIDES[14][1]["preview"] = "ink-film-14-left.svg"
GUIDES[14][3]["preview"] = "ink-film-14-wrong.svg"
GUIDES[14][4]["preview"] = "ink-film-14-reference.svg"
GUIDES[14][5]["preview"] = "ink-film-14-b.svg"
GUIDES[10][4]["preview"] = "ink-film-10-reference.svg"
GUIDES[3][1]["preview"] = "ink-film-3-reference.svg"
GUIDES[3][4]["preview"] = "ink-film-3-reference.svg"

def area(label: str, left: int, top: int, width: int, height: int) -> dict:
    return {"label": label, "left": left, "top": top, "width": width, "height": height}

for number, steps in {
    14: [
        [area("1/7 · 여기에 f₁ 미분과 f(2)", 5, 7, 49, 20)],
        [area("2/7 · 여기에 x≤2 삼차곡선", 5, 30, 61, 34)],
        [area("① 오른쪽 위에 f₂ 식·값 비교", 57, 7, 38, 21),
         area("② 기존 그래프 x=2 위에 (2,9) ○", 5, 30, 61, 34)],
        [area("4/7 · (2,9) ○에서 오른쪽 ∩", 42, 30, 24, 34)],
        [area("① 여기에 a>0 조건", 57, 7, 38, 21),
         area("② 같은 그래프에서 ∩ 지우고 ∪", 42, 30, 24, 34)],
        [area("① x축 오른쪽에 b? · 그래프에 y=t", 5, 30, 61, 34),
         area("② 아래에 g(t)·m 비교", 5, 68, 53, 23)],
        [area("7/7 · 자연수 후보와 최대 합", 62, 68, 33, 23)],
    ],
    10: [
        [area("1/7 · 속도·문제 조건", 5, 7, 52, 21)],
        [area("2/7 · P,Q 위치식과 C₁,C₂", 5, 33, 53, 25)],
        [area("3/7 · 거리와 절댓값", 5, 33, 53, 25)],
        [area("4/7 · 원점 출발과 a,b", 5, 33, 53, 25)],
        [area("5/7 · 2 ─ 7/2 ─ 6 시간선", 59, 7, 36, 25)],
        [area("6/7 · 두 구간 이동거리 적분", 59, 34, 36, 29)],
        [area("7/7 · 합과 답 ②", 62, 68, 33, 23)],
    ],
    3: [
        [area("1/7 · 문제 첫 줄·sin(−θ)", 5, 7, 52, 20)],
        [area("2/7 · 길이 3·1·2√2 삼각형", 5, 30, 61, 34)],
        [area("3/7 · 양수 ⑤ 시도", 5, 7, 52, 20)],
        [area("4/7 · 첫 줄 제4사분면 확인", 5, 7, 52, 20)],
        [area("5/7 · 오른쪽 아래 사선으로 수정", 5, 30, 61, 34)],
        [area("6/7 · 음수 tan θ 계산", 59, 34, 36, 29)],
        [area("7/7 · 답 ②", 62, 68, 33, 23)],
    ],
}.items():
    for step, areas in zip(GUIDES[number], steps):
        step["areas"] = areas

NAV = '<nav class="case-nav" aria-label="승주형 세 문제"><a href="ink-film-14.html">14번 · 그래프</a><a href="ink-film-10.html">10번 · 적분·이동거리</a><a href="ink-film-3.html">3번 · 사분면</a></nav>\n'
STYLE = '\n.case-nav{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.case-nav a{background:#fffdf9;border:1px solid var(--line);border-radius:9px;padding:9px 12px;color:var(--wine);font-size:13px;font-weight:700;text-decoration:none}.case-nav a:hover{border-color:var(--wine)}.graph-reference{background:#fffdf9;border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:10px 0;line-height:1.6}.graph-reference summary{cursor:pointer;color:var(--wine);font-weight:800}.graph-reference img{display:block;max-width:100%;width:min(760px,100%);height:auto;margin:9px auto}.graph-reference p{font-size:13px;color:#6b6259}.problem-card .choices{margin-top:9px;color:#645b52;font-size:14px}.guide-body pre{max-height:270px;overflow:auto}\n'
PREVIEW_STYLE = '.guide-preview{display:block;max-width:100%;width:440px;height:auto;margin:9px 0;border:1px solid var(--line);border-radius:7px}.guide-preview[hidden]{display:none}\n'

Q14_REFERENCE = '<details class="graph-reference" id="shapeReference"><summary>왼쪽 그래프 모양 보기 · 2/7에서 그리는 곡선</summary><img src="ink-film-14-reference.svg" alt="x가 −2 부근에서 왼쪽 아래로 시작해 (−1,5)까지 상승, (1,−3)까지 하강, (2,5)까지 상승하는 삼차곡선. (2,5)는 채운 점, 오른쪽 이차곡선은 빈 점 (2,9)에서 시작해 ∪ 모양이다."><p>2/7에서는 파란 왼쪽 삼차곡선만 그립니다. 오른쪽 붉은 ∪는 5/7에 그릴 최종 모양입니다. 도표는 (a,b)=(3,6)의 모양 예시이며, 실제 풀이에서는 먼저 a,b를 미지수로 둡니다.</p></details>\n'

BLOCKS = {
    10: '''
<section class="problem-card" aria-label="수능 10번 문제"><h2>2024학년도 수능 수학 10번 · 문제</h2>
<p>시각 t=0에 두 점 P,Q가 원점에서 출발해 수직선 위를 움직입니다. t≥0에서 각각의 속도는 아래와 같습니다.</p>
<p class="formula">v₁(t)=t²−6t+5<br>v₂(t)=2t−7</p>
<p>두 점 사이 거리 f(t)가 [0,a]에서 증가, [a,b]에서 감소, [b,∞)에서 증가합니다. <b>시각 a부터 b까지 Q가 실제로 움직인 거리</b>를 구하세요.</p>
<p class="choices">[4점] ① 15/2 &nbsp; ② 17/2 &nbsp; ③ 19/2 &nbsp; ④ 21/2 &nbsp; ⑤ 23/2</p>
<p class="plain">a,b는 두 점 사이 거리의 증감 경계입니다. 마지막 답은 Q의 이동거리라, Q가 중간에 방향을 바꾸는지 확인해야 합니다.</p></section>
<details class="graph-reference"><summary>10번에서 그릴 그림 보기 · Q의 시간선</summary><img src="ink-film-10-reference.svg" alt="시간 2, 7/2, 6을 표시한 선. Q는 2부터 7/2까지 왼쪽으로, 7/2부터 6까지 오른쪽으로 움직인다."><p>함수 그래프를 억지로 그릴 필요는 없습니다. 5/7에서 2, 7/2, 6을 적은 시간선과 방향 화살표를 그려 Q가 되돌아온다는 사실을 보여주세요.</p></details>
<details class="graph-card"><summary>왜 이 식을 쓰나요? · 10번 전체 흐름</summary><ol><li>원점 출발 → 적분상수 C₁,C₂를 각각 0으로 정합니다.</li><li>거리 f(t)=|x₁−x₂|를 쓰고 증감 경계 a=2,b=6을 찾습니다.</li><li>Q는 t=7/2에서 방향을 바꾸므로 속도의 절댓값을 두 구간으로 나눠 적분합니다.</li></ol><p class="fine">승주형 원문의 절댓값 교정은 일반 글씨이고, 실제 볼드는 C와 출발 조건을 되짚는 6문장입니다. 원문의 −2t² 계산과 ‘정적분만 가능’ 설명은 수학 오류라 정확한 풀이에 따라 쓰지 않습니다.</p></details>
<aside class="film-focus"><b>승주형 10번의 핵심:</b> 학생이 적분상수를 먼저 적었지만 원점에서 출발했다는 조건을 쓰지 못합니다. 질문 뒤 문제 문장으로 돌아가 C₁,C₂를 결정하는 순간을 남겨 주세요.</aside>
<details class="source-card" id="sourceText"><summary>승주형 10번 노션 원문 보기 · 붉은 줄이 실제 하이라이트</summary><ol class="source-flow" id="sourceConversation">
<li>(프루비) 야 이 유형 알지? 무조건 계산 실수 조심.</li>
<li>(학생) 오키. 일단 속도 적분해서 f(t) 구할게.<p class="formula-note">원문 수식: x₁(t)=t³/3−3t²+5t+C; x₂(t)=t²−7t+C; f(t)=x₁(t)−x₂(t)</p></li>
<li>(프루비) 왜 x_1 - x_2 야?</li>
<li>(학생) 음.. 아 맞네. ‘거리’라고 했으니까 절댓값 씌워야 해.<p class="formula-note">원문에는 x₁−x₂를 t³/3−2t²+12t로 적은 계산 오류도 있습니다.</p></li>
<li class="highlight"><span class="mark">승주형 하이라이트</span>(프루비) 잠깐. 적분상수 C를 저렇게 계산해도 될까?</li>
<li class="highlight"><span class="mark">승주형 하이라이트</span>(학생) 흠. 안 돼?</li>
<li class="highlight"><span class="mark">승주형 하이라이트</span>(프루비) 적분상수는 정해지지 않는 상수잖아. 여기서는 적분상수가 나오는 부정적분이 아니라 정적분을 이용해야 해. 문제에서 너가 빠뜨린 조건이 있어.</li>
<li class="highlight"><span class="mark">승주형 하이라이트</span>(학생) 뭐지?</li>
<li class="highlight"><span class="mark">승주형 하이라이트</span>(프루비) 원점에서 출발했대.</li>
<li class="highlight"><span class="mark">승주형 하이라이트</span>(학생) 아아, x(0)=0이구나. C가 애초에 없었네. 계속 계산한다…</li>
</ol><p class="source-note">붉은 줄은 승주형의 실제 볼드입니다. 정확한 풀이에서는 부정적분 후 초기 조건으로 C를 정해도 됩니다. 원문 수학 오류는 보관하고 안내에서 보정했습니다.</p></details>
''',
    3: '''
<section class="problem-card" aria-label="수능 3번 문제"><h2>2024학년도 수능 수학 3번 · 문제</h2>
<p class="formula">3π/2 &lt; θ &lt; 2π<br>sin(−θ)=1/3</p>
<p>이 조건을 만족하는 θ에 대해 <b>tan θ</b>를 구하세요.</p>
<p class="choices">[3점] ① −√2/2 &nbsp; ② −√2/4 &nbsp; ③ −1/4 &nbsp; ④ 1/4 &nbsp; ⑤ √2/4</p>
<p class="plain">첫 줄은 θ가 제4사분면이라는 뜻입니다. 주어진 양수는 sin(−θ)의 값이고 sin θ는 음수입니다.</p></section>
<details class="graph-reference"><summary>3번에서 그릴 그림 보기 · 제4사분면 삼각형</summary><img src="ink-film-3-reference.svg" alt="원점에서 오른쪽 아래 제4사분면으로 뻗는 길이 3의 빗변. 가로 방향은 2루트2, 세로 좌표는 마이너스 1이다."><p>2/7에서는 길이 3·1·2√2인 기준각 삼각형만 그려도 됩니다. 5/7에서 실제 θ의 사선이 오른쪽 아래로 향하게 고치고, 세로 방향을 −1로 표시하세요.</p></details>
<details class="graph-card"><summary>왜 양수 ⑤가 아니라 음수 ②인가요?</summary><ol><li>빗변 3·높이의 길이 1 → 밑변 2√2는 맞습니다.</li><li>θ는 제4사분면이므로 실제 세로 좌표는 −1, 가로는 +2√2입니다.</li><li>tan θ=−1/(2√2)=−√2/4이므로 ②입니다.</li></ol><p class="fine">승주형 학생은 길이만 보고 ⑤를 체크하려다가 첫 줄을 다시 읽습니다. 양수 계산은 원문 속 실수입니다.</p></details>
<aside class="film-focus"><b>승주형 3번의 핵심:</b> 길이는 맞게 구했는데 답의 부호를 놓쳤습니다. ⑤ 직전의 필기에서 문제 첫 줄로 돌아가고, 제4사분면을 확인해 ②로 바뀌는 과정을 남겨 주세요.</aside>
<details class="source-card" id="sourceText"><summary>승주형 3번 노션 원문 보기 · 다섯 줄 전부 실제 하이라이트</summary><ol class="source-flow" id="sourceConversation">
<li class="highlight"><span class="mark">승주형 하이라이트</span>(학생) sin 값이 1/3인 직각삼각형을 그림. 빗변의 길이 3, 높이 1</li>
<li class="highlight"><span class="mark">승주형 하이라이트</span>(학생) 밑변의 길이가 2루트2 임을 피타고라스 정리로 간단히 확인함</li>
<li class="highlight"><span class="mark">승주형 하이라이트</span>(학생) 그러고서 바로 tan값이 1/2루트2 = 루트2/4 라고 확정해버림 (답 5 체크하려는 찰나)</li>
<li class="highlight"><span class="mark">승주형 하이라이트</span>(프루비) 잠깐! 문제 맨 앞의 조건에서 세타가 제 4사분면의 각이야. 이거 체크했어?</li>
<li class="highlight"><span class="mark">승주형 하이라이트</span>(학생) 아! 제 4사분면의 각에 대해서는 탄젠트값이 음수지. (답 2)</li>
</ol><p class="source-note">붉은 줄은 승주형의 실제 볼드입니다. 원문에서 길이 1은 삼각형의 양의 길이이며, 실제 θ의 세로 좌표는 −1입니다.</p></details>
''',
}

TAGS = {
    10: ("승주 10번 · 계산·출발 조건", "C를 원점 출발로 정하고 Q 이동거리까지", "10번"),
    3: ("승주 3번 · 사분면 부호", "양수 시도에서 제4사분면 확인 후 수정", "3번"),
}

def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError(f"Expected exactly one marker: {old[:55]!r}, found {source.count(old)}")
    return source.replace(old, new, 1)

def set_guide(source: str, number: int) -> str:
    guide = json.dumps(GUIDES[number], ensure_ascii=False, separators=(",", ":"))
    result, count = re.subn(r"const GUIDE = \[.*?\];", lambda _: "const GUIDE = " + guide + ";", source)
    if count != 1:
        raise ValueError(f"Guide marker count {count}")
    return result

def guide_page(number: int) -> str:
    rows = []
    for i, step in enumerate(GUIDES[number], 1):
        rows.append("<tr><td>" + str(i) + "/7</td><td>" + html.escape(step["title"]) +
                    "</td><td>" + html.escape(step["where"]) + "</td><td><pre>" +
                    html.escape(step["text"]) + "</pre><p>" + html.escape(step["note"]) + "</p></td></tr>")
    return ('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>승주 {number}번 손풀이 전체 안내</title><style>body{{margin:0;background:#faf8f6;color:#302a29;font:16px/1.7 "Malgun Gothic",sans-serif}}main{{max-width:1050px;margin:auto;padding:24px}}'
            'a{color:#82273e}table{border-collapse:collapse;width:100%;background:white}td,th{padding:12px;border:1px solid #dfd8d0;vertical-align:top}th{background:#eee8e4}pre{white-space:pre-wrap;font:15px/1.55 "Malgun Gothic",sans-serif}td p{font-size:14px;color:#655b52}td:first-child{white-space:nowrap}@media(max-width:700px){main{padding:12px}table{font-size:13px}td,th{padding:7px}pre{font-size:13px}}</style></head><body><main>'
            f'<h1>승주 {number}번 — 단계별 손풀이 전체 안내</h1><p><a href="ink-film-{number}.html">필기 화면으로 돌아가기</a></p>'
            '<p>각 줄에는 실제로 쓸 내용과 왜 쓰는지를 함께 적었습니다. 그림은 필기 화면의 “그림 보기”에서 확인하세요. 단계 번호를 눌러도 이미 쓴 획은 지워지지 않습니다.</p>'
            '<table><thead><tr><th>단계</th><th>할 일</th><th>위치</th><th>쓸 내용과 이유</th></tr></thead><tbody>' +
            "".join(rows) + '</tbody></table></main></body></html>\n')

def svg_plot_14(include_right: bool = True) -> str:
    def xy(x: float, y: float) -> tuple[float, float]:
        return (82 + 65 * (x + 2.5), 400 - 24 * (y + 6))
    def line_path(fn, start: float, stop: float, step: float) -> str:
        pts = []
        x = start
        while x < stop:
            px, py = xy(x, fn(x))
            pts.append(f"{px:.1f},{py:.1f}")
            x += step
        px, py = xy(stop, fn(stop))
        pts.append(f"{px:.1f},{py:.1f}")
        return " ".join(pts)
    left = line_path(lambda x: 2*x**3 - 6*x + 1, -2.1, 2, .035)
    right = line_path(lambda x: 3*(x-2)*(x-6)+9, 2, 6.1, .035)
    x0, y0 = xy(0, 0)
    marks = ""
    x_marks = [(-1,"−1"),(1,"1"),(2,"2")] + ([(4,"4"),(6,"6")] if include_right else [])
    for x, label in x_marks:
        px, _ = xy(x,0)
        marks += f'<text x="{px:.1f}" y="{y0+25:.1f}" text-anchor="middle">{label}</text>'
    y_marks = [(-3,"−3"),(5,"5")] + ([(9,"9")] if include_right else [])
    for y, label in y_marks:
        _, py = xy(0,y)
        marks += f'<text x="{x0-11:.1f}" y="{py+5:.1f}" text-anchor="end">{label}</text>'
    points = []
    plot_points = [(-1,5,"(−1,5) 극대","#215c99",False),(1,-3,"(1,−3) 극소","#215c99",False),(2,5,"(2,5) ●","#215c99",False)]
    if include_right:
        plot_points += [(2,9,"(2,9) ○","#a53d4a",True),(4,-3,"꼭짓점 m","#a53d4a",False),(6,9,"(b,9)","#a53d4a",False)]
    for x,y,label,color,open_ in plot_points:
        px,py=xy(x,y)
        points.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="5" fill="{"white" if open_ else color}" stroke="{color}" stroke-width="2"/>'
                      f'<text x="{px+8:.1f}" y="{py-8:.1f}" fill="{color}">{label}</text>')
    right_curve = f'<polyline points="{right}" fill="none" stroke="#a53d4a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' if include_right else ''
    footer = ('<text x="108" y="448" fill="#215c99">파란색: 2/7에서 왼쪽 곡선만 그림</text><text x="417" y="448" fill="#a53d4a">붉은색: 5/7 이후 오른쪽 모양 예시</text>'
              if include_right else '<text x="108" y="448" fill="#215c99">2/7에서는 이 왼쪽 삼차곡선만 그립니다. x=2에서 멈춥니다.</text>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 465" role="img">
<style>text{{font:14px Arial,sans-serif;fill:#3d3935}}.axis{{stroke:#9c9388;stroke-width:1.5}}</style>
<rect width="750" height="465" fill="#fffdf9"/><line class="axis" x1="62" y1="{y0:.1f}" x2="710" y2="{y0:.1f}"/><line class="axis" x1="{x0:.1f}" y1="35" x2="{x0:.1f}" y2="425"/>
<text x="710" y="{y0-8:.1f}">x</text><text x="{x0+10:.1f}" y="40">y</text>{marks}
<line x1="70" y1="{xy(0,-3)[1]:.1f}" x2="706" y2="{xy(0,-3)[1]:.1f}" stroke="#c8b7a2" stroke-dasharray="6 5"/>
<text x="616" y="{xy(0,-3)[1]-10:.1f}">y=−3</text>
<polyline points="{left}" fill="none" stroke="#215c99" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
{right_curve}
{''.join(points)}
{footer}
</svg>\n'''

def svg_plot_14_wrong() -> str:
    """4/7의 의도적인 오답 시도: 오른쪽 이차곡선을 ∩으로 그린다."""
    def xy(x: float, y: float) -> tuple[float, float]:
        return 82 + 65 * (x + 2.5), 400 - 17 * (y + 6)

    def polyline(fn, start: float, stop: float) -> str:
        points = []
        count = 150
        for i in range(count + 1):
            x = start + (stop - start) * i / count
            px, py = xy(x, fn(x))
            points.append(f"{px:.1f},{py:.1f}")
        return " ".join(points)

    left = polyline(lambda x: 2*x**3 - 6*x + 1, -2.1, 2)
    wrong = polyline(lambda x: 9 - .75*(x-2)*(x-6), 2, 6)
    x0, y0 = xy(0, 0)
    x2, y5 = xy(2, 5)
    _, y9 = xy(2, 9)
    x4, y12 = xy(4, 12)
    x6, _ = xy(6, 9)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 465" role="img" aria-labelledby="title desc">
<title id="title">4/7 · 학생이 오른쪽 곡선을 ∩으로 잘못 그린 예시</title>
<desc id="desc">왼쪽 파란 삼차곡선은 x=2의 채운 점 (2,5)에서 끝난다. 그 위의 빈 점 (2,9)에서 주황색 잘못된 곡선이 오른쪽 위로 올라가 x=4 부근에서 꼭대기를 만든 뒤 아래로 내려와 (b,9)에 닿는다. 실제 문제의 오른쪽 이차곡선은 이 모양이 아니므로 다음 단계에서 주황색 선만 지운다.</desc>
<style>text{{font:14px 'Malgun Gothic','Noto Sans CJK KR',Arial,sans-serif;fill:#383b42}}.axis{{stroke:#a7a8ab;stroke-width:1.6}}.hint{{font-weight:700;fill:#a64c1c}}</style>
<rect width="750" height="465" rx="12" fill="#fffdf9"/>
<text x="28" y="29" font-size="17" font-weight="700">4/7 · 오른쪽 ∩을 그리는 학생의 실수</text>
<line class="axis" x1="62" y1="{y0:.1f}" x2="710" y2="{y0:.1f}"/>
<line class="axis" x1="{x0:.1f}" y1="43" x2="{x0:.1f}" y2="416"/>
<text x="714" y="{y0+5:.1f}">x</text><text x="{x0+8:.1f}" y="50">y</text>
<line x1="70" y1="{y9:.1f}" x2="700" y2="{y9:.1f}" stroke="#d5c6b6" stroke-dasharray="5 5"/>
<text x="{x0-10:.1f}" y="{y9+4:.1f}" text-anchor="end">9</text>
<text x="{x0-10:.1f}" y="{y5+4:.1f}" text-anchor="end">5</text>
<text x="{x0-10:.1f}" y="{xy(0,-3)[1]+4:.1f}" text-anchor="end">−3</text>
<text x="{x2:.1f}" y="{y0+25:.1f}" text-anchor="middle">2</text>
<text x="{x4:.1f}" y="{y0+25:.1f}" text-anchor="middle">가운데</text>
<text x="{x6:.1f}" y="{y0+25:.1f}" text-anchor="middle">b (위치 예시)</text>
<polyline points="{left}" fill="none" stroke="#215c99" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
<text x="31" y="67" fill="#215c99">f₁(x) · 이미 그린 왼쪽 곡선</text>
<circle cx="{x2:.1f}" cy="{y5:.1f}" r="5" fill="#215c99"/>
<text x="{x2+9:.1f}" y="{y5+5:.1f}" fill="#215c99">(2,5) ●</text>
<polyline points="{wrong}" fill="none" stroke="#bb6427" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="10 7"/>
<circle cx="{x2:.1f}" cy="{y9:.1f}" r="6" fill="#fffdf9" stroke="#bb6427" stroke-width="2.6"/>
<circle cx="{x4:.1f}" cy="{y12:.1f}" r="4" fill="#bb6427"/>
<circle cx="{x6:.1f}" cy="{y9:.1f}" r="4" fill="#bb6427"/>
<text class="hint" x="{x2-96:.1f}" y="{y9-18:.1f}">① (2,9) ○부터 시작</text>
<text class="hint" x="{x4-38:.1f}" y="{y12-16:.1f}">② 위로 올려 ∩ 꼭대기</text>
<text class="hint" x="{x6-72:.1f}" y="{y9+26:.1f}">③ 아래로 내려 (b,9)</text>
<path d="M {xy(2.8,10.52)[0]:.1f} {xy(2.8,10.52)[1]:.1f} l 11 -9 -4 13" fill="none" stroke="#bb6427" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M {xy(5.2,10.52)[0]:.1f} {xy(5.2,10.52)[1]:.1f} l 7 12 -13 -5" fill="none" stroke="#bb6427" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="28" y="424" width="694" height="30" rx="6" fill="#fff0df"/>
<text x="41" y="444" fill="#a64c1c">틀린 ∩을 남겨 혼자 검토하다 막힘 → Provee 질문 뒤 5/7에서 ∪로 고침</text>
</svg>\n'''

SVG14_B = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 390" role="img" aria-labelledby="title desc">
<title id="title">6/7 · 미지수 b가 그래프에서 가리키는 위치</title>
<desc id="desc">x가 2보다 큰 경우의 오른쪽 이차곡선만 나타낸 개념도이다. x=2의 y=9에는 빈 점이 있고, x=b의 y=9에는 채운 점이 있다. 두 점 가운데의 꼭짓점 x=(2+b)/2는 높이 m이다. b의 숫자는 아직 모른다.</desc>
<style>text{font:15px 'Malgun Gothic','Noto Sans CJK KR',Arial,sans-serif;fill:#393734}.strong{font-weight:700;fill:#8a1c2b}</style>
<rect width="750" height="390" rx="12" fill="#fffdf9"/>
<text x="29" y="31" font-size="18" font-weight="700">6/7 · b는 숫자를 아직 모르는 x좌표</text>
<text x="30" y="60">f₂(x)=a(x−2)(x−b)+9 → x=b를 넣으면 f₂(b)=9</text>
<line x1="75" y1="309" x2="690" y2="309" stroke="#9f9b95" stroke-width="1.8"/>
<line x1="76" y1="88" x2="76" y2="329" stroke="#9f9b95" stroke-width="1.8"/>
<text x="698" y="313">x</text><text x="85" y="98">y</text>
<line x1="76" y1="128" x2="668" y2="128" stroke="#c8b5a6" stroke-dasharray="6 5"/>
<text x="52" y="133">9</text>
<path d="M190 128 Q390 374 590 128" fill="none" stroke="#a53d4a" stroke-width="4.3" stroke-linecap="round"/>
<circle cx="190" cy="128" r="6" fill="#fffdf9" stroke="#a53d4a" stroke-width="2.5"/>
<circle cx="590" cy="128" r="6" fill="#a53d4a"/>
<circle cx="390" cy="251" r="5" fill="#a53d4a"/>
<line x1="190" y1="138" x2="190" y2="309" stroke="#d1c0b1" stroke-dasharray="4 5"/>
<line x1="390" y1="258" x2="390" y2="309" stroke="#d1c0b1" stroke-dasharray="4 5"/>
<line x1="590" y1="138" x2="590" y2="309" stroke="#d1c0b1" stroke-dasharray="4 5"/>
<text x="157" y="116" class="strong">(2,9) ○</text>
<text x="602" y="120" class="strong">(b,9) ●</text>
<text x="402" y="278" class="strong">꼭짓점 높이 m</text>
<text x="190" y="335" text-anchor="middle">2</text>
<text x="390" y="335" text-anchor="middle">(2+b)/2</text>
<text x="590" y="335" text-anchor="middle" class="strong">b?</text>
<rect x="27" y="348" width="696" height="29" rx="7" fill="#fff0df"/>
<text x="39" y="368">b&gt;2인 모양만 보여주는 개념도 · b의 실제 값은 7/7에서 후보를 찾습니다.</text>
</svg>\n'''

SVG10 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 280"><style>text{font:18px Arial,sans-serif;fill:#3d3935}</style><rect width="760" height="280" fill="#fffdf9"/><text x="35" y="39">Q의 속도 v₂(t)=2t−7</text><line x1="90" y1="145" x2="690" y2="145" stroke="#9c9388" stroke-width="3"/><g stroke="#3d3935" stroke-width="2"><line x1="135" y1="133" x2="135" y2="157"/><line x1="380" y1="133" x2="380" y2="157"/><line x1="625" y1="133" x2="625" y2="157"/></g><text x="125" y="187">2=a</text><text x="353" y="187">7/2</text><text x="610" y="187">6=b</text><path d="M350 106 H175 l22 -13 M175 106 l22 13" fill="none" stroke="#a53d4a" stroke-width="4"/><path d="M410 106 H590 l-22 -13 M590 106 l-22 13" fill="none" stroke="#215c99" stroke-width="4"/><text x="156" y="87">v₂&lt;0 · 왼쪽으로 9/4</text><text x="438" y="87">v₂&gt;0 · 오른쪽으로 25/4</text><text x="238" y="244">움직인 거리 = 9/4 + 25/4 = 17/2</text></svg>\n'''
SVG3 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 380"><style>text{font:17px Arial,sans-serif;fill:#3d3935}</style><rect width="760" height="380" fill="#fffdf9"/><line x1="85" y1="155" x2="690" y2="155" stroke="#9c9388" stroke-width="2"/><line x1="330" y1="35" x2="330" y2="330" stroke="#9c9388" stroke-width="2"/><text x="698" y="160">x</text><text x="335" y="31">y</text><path d="M330 155 L565 265 L565 155 Z" fill="#fbeded" stroke="#a53d4a" stroke-width="3"/><circle cx="330" cy="155" r="5" fill="#3d3935"/><text x="388" y="199">빗변 길이 3</text><text x="445" y="145">가로 +2√2</text><text x="572" y="216">세로 −1</text><text x="487" y="292">θ: 제4사분면</text><text x="46" y="315">길이 1은 양수지만, 세로 좌표는 −1</text><text x="46" y="346">tan θ = −1/(2√2) = −√2/4</text></svg>\n'''

def update_q14() -> str:
    source = Q14.read_text(encoding="utf-8")
    if '<nav class="case-nav"' not in source:
        source = replace_once(source, '<section class="problem-card"', NAV + '<section class="problem-card"')
    if '.case-nav{' not in source:
        source = replace_once(source, '</style>', STYLE + '</style>')
    if '.guide-preview{' not in source:
        source = replace_once(source, '</style>', PREVIEW_STYLE + '</style>')
    if '@media(max-width:1200px){.film-guide{position:relative}.bar{position:relative}}' not in source:
        source = replace_once(
            source,
            '@media(max-width:1200px){.film-guide{position:relative}}',
            '@media(max-width:1200px){.film-guide{position:relative}.bar{position:relative}}',
        )
    if 'id="guidePreview"' not in source:
        source = replace_once(source, '<pre id="guideText"></pre>',
                              '<pre id="guideText"></pre><img id="guidePreview" class="guide-preview" alt="현재 단계에서 손으로 그릴 그림 예시" hidden>')
    old_render = 'document.getElementById(\'guideNote\').textContent=s.note;document.getElementById(\'prevStep\')'
    new_render = ('document.getElementById(\'guideNote\').textContent=s.note;'
                  'const preview=document.getElementById(\'guidePreview\');preview.hidden=!s.preview;'
                  'if(s.preview)preview.src=s.preview;document.getElementById(\'prevStep\')')
    if 'preview.hidden=!s.preview' not in source:
        source = replace_once(source, old_render, new_render)
    if 'id="shapeReference"' not in source:
        source = replace_once(source, '<details class="graph-card"', Q14_REFERENCE + '<details class="graph-card"')
    if 'k가 여러 개라' not in source:
        source = replace_once(
            source,
            '단계별 ‘왜 이걸 쓰나요?’는 원문과 구분한 이해 설명입니다.</p>',
            '원문의 “b&lt;2면 k가 없다”는 표현은 정확히는 b≤2일 때 그런 k가 여러 개라 “정확히 하나” 조건을 어긴다는 뜻입니다. 단계별 ‘왜 이걸 쓰나요?’는 원문과 구분한 이해 설명입니다.</p>',
        )
    source = set_guide(source, 14)
    Q14.write_text(source, encoding="utf-8", newline="\n")
    return source

def make_case(base: str, number: int) -> str:
    title, sub, short = TAGS[number]
    page = base
    exam_sizes = {3: (1460, 452), 10: (1480, 936)}
    exam_w, exam_h = exam_sizes[number]
    page = replace_once(page, 'src="ink-film-14-exam.png"', f'src="ink-film-{number}-exam.png"')
    page = replace_once(page, 'data-w="1480" data-h="1088"', f'data-w="{exam_w}" data-h="{exam_h}"')
    page = replace_once(page, 'alt="2024학년도 수능 수학 14번 실제 문항과 다섯 선택지"',
                        f'alt="2024학년도 수능 수학 {number}번 실제 문항과 다섯 선택지"')
    page = replace_once(page, 'Provee — 승주 14번 태블릿 풀이', f'Provee — 승주 {number}번 태블릿 풀이')
    page = replace_once(page, '승주 14번 · 문제를 보며 평소처럼 풀기 · 지운 과정도 보존',
                        f'승주 {number}번 · 문제를 이해하며 손으로 풀기 · 지운 과정도 보존')
    start = page.index('<section class="problem-card"')
    end = page.index('<div class="tasks"', start)
    page = page[:start] + BLOCKS[number].strip() + "\n\n" + page[end:]
    old_task = "const TASKS = [{id:'csat2024-q14',tag:'승주 14번 · 광고 재현 필기',text:'조건을 보고 스스로 고친 뒤 끝까지 풀이',note:'새 자료'}];"
    new_task = ("const TASKS = [{id:'csat2024-q" + str(number) + "',tag:" + json.dumps(title, ensure_ascii=False) +
                ",text:" + json.dumps(sub, ensure_ascii=False) + ",note:'새 자료'}];")
    page = replace_once(page, old_task, new_task)
    page = replace_once(page, '승주 2024학년도 수능 14번 교육 시나리오', f'승주 2024학년도 수능 {number}번 교육 시나리오')
    page = replace_once(page, "'승주14번-필기-'", f"'승주{number}번-필기-'")
    page = replace_once(page, "'film-ink/q14/'", f"'film-ink/q{number}/'")
    page = replace_once(page, "const draftKey='provee-film-csat2024-q14-v1';",
                        f"const draftKey='provee-film-csat2024-q{number}-v1';")
    page = replace_once(page, 'href="ink-film-14-guide.html"', f'href="ink-film-{number}-guide.html"')
    page = set_guide(page, number)
    return page

def main() -> None:
    base = update_q14()
    (ROOT / "ink-film-14-reference.svg").write_text(svg_plot_14(), encoding="utf-8")
    (ROOT / "ink-film-14-left.svg").write_text(svg_plot_14(False), encoding="utf-8")
    (ROOT / "ink-film-14-wrong.svg").write_text(svg_plot_14_wrong(), encoding="utf-8")
    (ROOT / "ink-film-14-b.svg").write_text(SVG14_B, encoding="utf-8")
    (ROOT / "ink-film-10-reference.svg").write_text(SVG10, encoding="utf-8")
    (ROOT / "ink-film-3-reference.svg").write_text(SVG3, encoding="utf-8")
    for number in (14, 10, 3):
        (ROOT / f"ink-film-{number}-guide.html").write_text(guide_page(number), encoding="utf-8")
    for number in (10, 3):
        (ROOT / f"ink-film-{number}.html").write_text(make_case(base, number), encoding="utf-8", newline="\n")

if __name__ == "__main__":
    main()
