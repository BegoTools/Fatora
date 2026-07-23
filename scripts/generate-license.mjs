#!/usr/bin/env node
// ============================================================
// Easy Store ERP - مولّد مفاتيح الترخيص (License Key Generator)
// ------------------------------------------------------------
// أداة جانبية تُستخدم بواسطة المطوّر/البائع لتوليد مفاتيح ترخيص
// للعملاء. تعمل offline بالكامل (لا سيرفر) وتُنتج مفتاحًا موقّعًا
// HMAC مرتبطًا ببصمة جهاز العميل.
//
// الاستخدام:
//   node scripts/generate-license.mjs <deviceFingerprint> <customerName> [expiryYYYY-MM-DD]
//
// مثال:
//   node scripts/generate-license.mjs a1b2c3... "متجر النور" 2026-12-31
//
// للحصول على بصمة الجهاز: افتح التطبيق → الإعدادات → الترخيص →
// «بصمة هذا الجهاز».
// ============================================================

import { webcrypto } from 'node:crypto';

const LICENSE_SIGNING_SECRET = 'easy_store_license_signing_v1';

async function sha256(input) {
  const buf = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signLicense(message) {
  const enc = new TextEncoder().encode(LICENSE_SIGNING_SECRET);
  const key = await webcrypto.subtle.importKey('raw', enc, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

async function main() {
  const [device, customerName, expiryArg] = process.argv.slice(2);

  if (!device || !customerName) {
    console.error('الاستخدام: node scripts/generate-license.mjs <deviceFingerprint> <customerName> [expiryYYYY-MM-DD]');
    console.error('مثال: node scripts/generate-license.mjs a1b2c3... "متجر النور" 2026-12-31');
    process.exit(1);
  }

  let expiryAt;
  if (expiryArg) {
    expiryAt = new Date(`${expiryArg}T23:59:59Z`).toISOString();
    if (Number.isNaN(new Date(expiryAt).getTime())) {
      console.error('تاريخ انتهاء غير صالح. استخدم صيغة YYYY-MM-DD');
      process.exit(1);
    }
  } else {
    // افتراضيًا: سنة من اليوم
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    expiryAt = d.toISOString();
  }

  const payload = {
    device,
    customerName,
    issuedAt: new Date().toISOString(),
    expiryAt,
    type: 'license',
  };

  const payloadStr = JSON.stringify(payload);
  const b64 = toBase64(payloadStr);
  const sig = await signLicense(payloadStr);
  const licenseKey = `${b64}.${sig}`;

  console.log('========================================');
  console.log('  Easy Store ERP — مفتاح الترخيص');
  console.log('========================================');
  console.log(`العميل:    ${customerName}`);
  console.log(`بصمة الجهاز: ${device}`);
  console.log(`الإصدار:   ${payload.issuedAt}`);
  console.log(`الانتهاء:  ${expiryAt}`);
  console.log('----------------------------------------');
  console.log('مفتاح الترخيص:');
  console.log(licenseKey);
  console.log('========================================');
}

main().catch((err) => {
  console.error('خطأ:', err);
  process.exit(1);
});
