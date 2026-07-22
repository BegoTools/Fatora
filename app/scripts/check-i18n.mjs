// scripts/check-i18n.mjs
// -----------------------------------------------------------------------------
// فحص شامل لعدم تطابق مفاتيح الترجمة في مشروع Fatora.
//
// يفحص:
//   (1) المفاتيح الثابتة:  t('a.b.c')  /  t("a.b.c")  /  t('a.b.c', opts)
//   (2) المفاتيح الديناميكية ذات المصادر المعروفة (enum sources):
//        t(`ns.${var}`)  حيث var يأخذ قيمًا محددة من الأنواع (types) في الكود.
//   (3) التطابق بين اللغتين: كل مفتاح في EN يجب أن يكون في AR والعكس.
//
// يُرجع exit 1 (يفشل الـ build) لو وُجد أي مفتاح ناقص أو غير متطابق.
// يُستخدم في CI / pre-commit وعند `npm run build` لمنع ظهور مفاتيح الترجمة الخام.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const i18nPath = path.join(SRC, 'i18n.ts');

// --- 1) تحميل كائن resources من src/i18n.ts ---
const full = fs.readFileSync(i18nPath, 'utf8');
const startIdx = full.indexOf('const resources =');
const afterEq = full.indexOf('{', startIdx);
let depth = 0, end = -1;
for (let i = afterEq; i < full.length; i++) {
  const ch = full[i];
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const objText = full.slice(afterEq, end);
const resources = new Function('return ' + objText)();

function flatten(obj, prefix, out) {
  for (const k of Object.keys(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) flatten(obj[k], key, out);
    else out.push(key);
  }
}
const enArr = [], arArr = [];
flatten(resources.en.translation, '', enArr);
flatten(resources.ar.translation, '', arArr);
const enSet = new Set(enArr), arSet = new Set(arArr);

// --- 2) مصادر المفاتيح الديناميكية (curated enum sources) ---
// كل مفتاح ديناميكي t(`ns.${var}`) يجب أن نعرف قيم var الممكنة.
// هذه القائمة يجب تحديثها عند إضافة enum جديد للأنواع.
const DYNAMIC_ENUM_SOURCES = [
  { ns: 'common', values: ['cash', 'card', 'wallet', 'credit', 'installment', 'paid', 'partial', 'unpaid'] },
  { ns: 'common', values: ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] },
  { ns: 'treasury', values: ['accounts', 'transactions', 'assets'] },
  { ns: 'treasury', values: ['safe', 'bank', 'wallet'] },
  { ns: 'treasury', values: ['income', 'expense', 'transfer', 'transfer_in', 'transfer_out'] },
  { ns: 'hr', values: ['employees', 'attendance', 'payroll', 'advances'] },
  { ns: 'hr', values: ['draft', 'approved', 'paid'] },
  { ns: 'hr.fields', values: ['present', 'absent', 'late', 'leave', 'holiday', 'category', 'department'] },
  { ns: 'sales', values: ['terminal', 'invoices', 'customers'] },
  { ns: 'purchases', values: ['orders', 'suppliers'] },
  { ns: 'expenses.cat', values: ['office','utilities','salaries','rent','supplies','marketing','maintenance','other'] },
  { ns: 'inventory', values: ['receipt', 'issue', 'damage', 'adjust'] },
  { ns: 'nav', values: ['dashboard','inventory','sales','customers','returns','exchange','purchases','expenses','treasury','reports','hr','settings'] },
  { ns: 'permissions', values: ['view', 'create', 'edit', 'delete'] },
];

// قيم ModuleId — تستخدم في t(`${currentModule}.title`) و t(`${currentModule}.subtitle`)
const MODULE_IDS = ['dashboard','inventory','sales','customers','returns','exchange','purchases','expenses','treasury','reports','hr','settings'];

// --- 3) المشي في الكود لجمع كل المفاتيح الثابتة المستخدمة ---
const used = new Set();
const exts = ['.ts', '.tsx'];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!exts.includes(path.extname(p))) continue;
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((line) => {
      // يطابق: t('key')  /  t("key")  /  t('key', ...)  /  t("key", ...)
      // الشرط [^A-Za-z0-9_] يمنع مطابقة استدعاءات مثل formatT('key') أو myt('key')
      const re = /[^A-Za-z0-9_]t\(\s*['"]([a-zA-Z0-9_.\-]+)['"]\s*(?:,|\))/g;
      let m;
      while ((m = re.exec(line))) used.add(m[1]);
    });
  }
}
walk(SRC);

// --- 4) المقارنة ---
const usedArr = [...used].sort();
const missingEn = usedArr.filter((k) => !enSet.has(k));
const missingAr = usedArr.filter((k) => !arSet.has(k));

// مفاتيح ديناميكية مفقودة
const dynamicMissing = [];
for (const src of DYNAMIC_ENUM_SOURCES) {
  for (const v of src.values) {
    const k = `${src.ns}.${v}`;
    if (!enSet.has(k)) dynamicMissing.push(`${k} [en]`);
    if (!arSet.has(k)) dynamicMissing.push(`${k} [ar]`);
  }
}
// module.title / module.subtitle
for (const mod of MODULE_IDS) {
  for (const suf of ['.title', '.subtitle']) {
    const k = mod + suf;
    if (!enSet.has(k)) dynamicMissing.push(`${k} [en]`);
    if (!arSet.has(k)) dynamicMissing.push(`${k} [ar]`);
  }
}

// مفاتيح غير متطابقة بين اللغتين (في ملف الترجمة نفسه)
const onlyEn = enArr.filter((k) => !arSet.has(k));
const onlyAr = arArr.filter((k) => !enSet.has(k));

// --- 5) التقرير ---
let ok = true;
const errors = [];

if (missingEn.length) {
  ok = false;
  errors.push(`✗ Missing in EN: ${missingEn.join(', ')}`);
}
if (missingAr.length) {
  ok = false;
  errors.push(`✗ Missing in AR: ${missingAr.join(', ')}`);
}
if (dynamicMissing.length) {
  ok = false;
  errors.push(`✗ Missing dynamic keys: ${dynamicMissing.join(', ')}`);
}
if (onlyEn.length) {
  ok = false;
  errors.push(`✗ In EN file but not AR: ${onlyEn.join(', ')}`);
}
if (onlyAr.length) {
  ok = false;
  errors.push(`✗ In AR file but not EN: ${onlyAr.join(', ')}`);
}

if (ok) {
  console.log(`✓ i18n check passed — ${usedArr.length} static keys + ${DYNAMIC_ENUM_SOURCES.reduce((s, x) => s + x.values.length, 0)} dynamic enum keys present in both en & ar.`);
  process.exit(0);
} else {
  console.error('\n❌ i18n check FAILED — raw keys would leak to the UI:\n');
  for (const e of errors) console.error('  ' + e);
  console.error('\n→ Add the missing keys to src/i18n.ts in BOTH `en` and `ar` blocks.');
  process.exit(1);
}
