// 시험 파일: 결과 객체를 간단히 읽으려고 any를 쓴다.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prepareForAI, assertSafeForAI, findLeftovers, sanitize } from '../src/lib/sanitize.ts';
const ok = (c: boolean, m: string) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
// 1 허용 칸 구분
let r = prepareForAI({ item_type: 'accessory', fields: { item_name: '에코백', material: '면 100%', unit_price: '1500', supplier: '(주)굿즈' } });
ok(r.ok && (r as any).fields.material === "면 100%", "부속물품: 재질 % (면 100%)는 통과");
r = prepareForAI({ item_type: 'accessory', fields: { item_name: '에코백', material: '면', purpose: '판촉용 사은품', unit_price: '1500', supplier: '(주)굿즈' } });
ok(r.ok && !('unit_price' in (r as any).fields) && r.droppedFields.includes('supplier'), '부속물품: 단가·공급처 칸은 빠짐');
r = prepareForAI({ item_type: 'food', fields: { item_name: '떡볶이 밀키트', material: '면', main_ingredients: ['쌀떡', '고추장 소스'] } });
ok(r.ok && r.droppedFields.includes('material') && (r as any).fields.main_ingredients === '쌀떡, 고추장 소스', '식품: 부속물품 칸(material)은 빠지고 배열은 글로');
// 2 허용 칸 안 문장 속 민감정보
r = prepareForAI({ item_type: 'food', fields: { item_name: '떡볶이', description: '문의 02-1234-5678, kim@ex.com, 서울 강남구 테헤란로 12 3층, 단가 USD 2.5' } });
ok(r.ok && !/1234|kim@|테헤란|2\.5/.test(JSON.stringify((r as any).fields)), '문장 속 전화·이메일·주소·금액 지움: ' + JSON.stringify((r as any).fields));
// 3 못 지운 흔적 → 차단
r = prepareForAI({ item_type: 'food', fields: { item_name: '떡볶이', description: '해외 사무소 12 Orchard Rd, Singapore 238801' } });
ok(!r.ok, '해외 주소 차단: ' + (r.ok ? '' : r.reason));
r = prepareForAI({ item_type: 'food', fields: { description: '공급가 1,800 / 설탕 12.5%, 고춧가루 3%' } });
ok(!r.ok && r.leftovers.length >= 2, '통화 표시 없는 단가 · 배합 % 차단');
r = prepareForAI({ item_type: 'food', fields: { description: '담당: 홍길동' } });
ok(!r.ok, '담당자 이름 차단');
try { assertSafeForAI('제조원 주소 테헤란로 12'); ok(false, 'assert'); } catch (e) { ok(true, 'assertSafeForAI 차단: ' + (e as Error).message); }
ok(assertSafeForAI('원재료: 쌀, 소금, 주정').includes('쌀'), '정상 글은 통과');
// 오탐 확인: HS 코드, 내용량
ok(findLeftovers('HS 1902.30, 내용량 110g, 1904.90-0000').length === 0, 'HS 코드·내용량은 오탐 없음: ' + JSON.stringify(findLeftovers('HS 1902.30, 내용량 110g, 1904.90-0000')));
ok(findLeftovers(sanitize('HSK 1902309000, 세번 1902.30-9000').text).length === 0, 'HSK 10자리 숫자 오탐 없음: ' + JSON.stringify(findLeftovers('HSK 1902309000')));
ok(findLeftovers('계좌 110-123-456789').length > 0 && findLeftovers('연락 01012345678').length > 0, '계좌 · 하이픈 없는 휴대전화 차단');
r = prepareForAI({ item_type: 'food', fields: { item_name: '떡볶이', existing_classification: '1902309000' } });
ok(r.ok, '기존 HSK(existing_classification)는 통과');
r = prepareForAI({ item_type: 'food', fields: { description: '고춧가루 3%' } });
ok(!r.ok, '식품 HS 입력의 % 는 차단');
ok(findLeftovers('고춧가루(중국산) 3%', { allowPercent: true }).length === 0, '제품 자료 읽기: 라벨 표기 함량 % 는 허용');
ok(findLeftovers('품목보고번호: 20140487270112, 바코드 8801234567890').length === 0, '품목보고번호 · 바코드는 통과');
// --- 11/26 보완 ---
r = prepareForAI({ item_type: 'accessory', fields: { item_name: '스티커', shape: '원형 · 지름 50mm' } });
ok(r.ok && (r as any).fields.shape === '원형 · 지름 50mm', '부속물품 shape 칸 허용');
r = prepareForAI({ item_type: 'food', fields: { item_name: '떡', shape: '원통형' } });
ok(r.ok && r.droppedFields.includes('shape'), '식품은 shape 칸 빠짐');
// existing_classification
for (const [v, want] of [['190230', true], ['1902.30', true], ['1902.30-9000', true], [{ hs6: '190230', hsk10: '1902309000' }, true], [['190230', '1902309000'], true],
  ['19023', false], ['190230 (떡볶이용, 단가 1500)', false], ['HS 190230', false], [{ hs6: '190230', note: '김대리 확인' }, false], [{ hs6: '190230', hsk10: '1904909000' }, false], [{ hs6: 190230 }, true]] as [unknown, boolean][]) {
  const x = prepareForAI({ item_type: 'food', fields: { item_name: '떡', existing_classification: v } });
  ok(x.ok === want, `기존 코드 ${JSON.stringify(v)} → ${want ? '통과' : '차단'}${x.ok ? ' ' + (x as any).fields.existing_classification : ' · ' + (x as any).reason}`);
}
r = prepareForAI({ item_type: 'food', fields: { existing_classification: '1902309000' } }, { isKnownCode: (c) => c === '1902301000' });
ok(!r.ok, '코드표(isKnownCode)에 없는 코드는 차단');
// 객체 · 배열 안 민감정보
r = prepareForAI({ item_type: 'accessory', fields: { components: [{ name: '끈', material: '면' }, { name: '본체', material: '캔버스', price: 1200 }] } });
ok(!r.ok && r.leftovers.some((l) => l.sample.includes('price')), '배열 속 객체의 price 하위 칸 차단: ' + (r.ok ? '' : r.leftovers.map((l) => l.sample).join(',')));
r = prepareForAI({ item_type: 'accessory', fields: { description: { 용도: '판촉', 공급처: '(주)굿즈' } } });
ok(!r.ok, '객체 속 공급처 하위 칸 차단');
r = prepareForAI({ item_type: 'food', fields: { main_ingredients: ['쌀', '고추장', '담당: 홍길동'] } });
ok(!r.ok, '배열 값 속 담당자 이름 차단');
r = prepareForAI({ item_type: 'accessory', fields: { components: [{ name: '라벨', note: '12 Orchard Rd, Singapore' }] } });
ok(!r.ok, '객체 값 속 해외 주소 차단');
r = prepareForAI({ item_type: 'accessory', fields: { components: [{ name: '끈', note: '문의 02-1234-5678' }] } });
ok(r.ok && /\[전화\]/.test((r as any).fields.components) && !/1234/.test((r as any).fields.components), '객체 값 속 전화는 지우고 통과: ' + (r as any).fields?.components);
r = prepareForAI({ item_type: 'accessory', fields: { components: [{ name: '끈', material: '면' }, { name: '본체', material: '캔버스', price: '' }] } });
ok(r.ok && (r as any).fields.components === 'name: 끈; material: 면; name: 본체; material: 캔버스', '빈 값 하위 칸은 무시 · 평탄화: ' + (r as any).fields?.components);
r = prepareForAI({ item_type: 'accessory', fields: { components: { a: { b: { c: { d: { e: '깊음' } } } } } } });
ok(!r.ok, '너무 깊은 객체 차단');

// 영문 주소 (11/27 추가): 라벨 자료에 영어로 적힌 한국 · 베트남 주소
{
  const kr = sanitize('Manufactured by HYEYUM, 123, Samsung-ro, Yeongtong-gu, Suwon-si, Gyeonggi-do, Republic of Korea\nStore in a cool, dry place');
  ok(!/Samsung|Yeongtong|Suwon|Gyeonggi/.test(kr.text) && /Store in a cool, dry place/.test(kr.text) && /HYEYUM/.test(kr.text), '영문 한국 주소 지움, 다른 문장은 그대로: ' + kr.text.replace(/\n/g, ' / '));
  const vn = sanitize('Importer: CNI VINA, 12 Nguyen Van Linh, Ward 5, District 7, Ho Chi Minh City, Vietnam');
  ok(!/Nguyen|Ward 5|District 7|Ho Chi Minh/.test(vn.text), '베트남 주소 지움: ' + vn.text);
  ok(findLeftovers('공장: Bundang-gu 어딘가').length > 0, '지우고 남은 영문 주소 낱말은 차단');
  ok(findLeftovers('Ingredients: Rice, Salt, Tomato Powder. Store in a cool, dry place. Country of Origin: Republic of Korea').length === 0, '영문 원재료 · 보관 문구 · 원산지는 차단하지 않음');
}
