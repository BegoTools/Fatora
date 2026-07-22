// ============================================================
// Easy Store ERP - QR ضريبي (Tax QR — TLV Base64)
// ------------------------------------------------------------
// يولّد سلسلة Base64 بصيغة Tag-Length-Value (TLV) متوافقة الشكل
// مع الفواتير الضريبية (النمط المصري ETA). يحتوي على:
//   1) اسم البائع
//   2) الرقم الضريبي للبائع
//   3) تاريخ ووقت الفاتورة
//   4) الإجمالي شامل الضريبة
//   5) قيمة الضريبة
// ملاحظة: هذه صيغة متوافقة الشكل فقط — لا ربط حكومي فعلي
// (الربط خارج النطاق حسب القيد).
// ============================================================

import type { CompanySettings } from '@/types';

// علامات (Tags) معيار ETA
const TAG_SELLER_NAME = 1;
const TAG_VAT_NUMBER = 2;
const TAG_TIMESTAMP = 3;
const TAG_TOTAL = 4;
const TAG_TAX = 5;

// ============================================================
// تحويل نص إلى UTF-8 بايتات (دعم عربي صحيح)
// ============================================================
function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * بناء حقل TLV واحد: tag(1) + length(1) + value(n)
 * - length يُمثّل عدد البايتات (يفترض قيمة أقل من 256).
 */
function buildTLV(tag: number, value: string): Uint8Array {
  const valueBytes = utf8Bytes(value);
  const out = new Uint8Array(2 + valueBytes.length);
  out[0] = tag & 0xff;
  out[1] = valueBytes.length & 0xff;
  out.set(valueBytes, 2);
  return out;
}

function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  // استخدام btoa على النص الثنائي الآمن
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export interface TaxQrInput {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO أو YYYY-MM-DDTHH:MM:SS
  totalInclTax: number;
  taxAmount: number;
}

/**
 * توليد سلسلة QR الضريبية بصيغة TLV-Base64.
 */
export function generateTaxQr(input: TaxQrInput): string {
  const fields: Uint8Array[] = [
    buildTLV(TAG_SELLER_NAME, input.sellerName),
    buildTLV(TAG_VAT_NUMBER, input.vatNumber),
    buildTLV(TAG_TIMESTAMP, input.timestamp),
    buildTLV(TAG_TOTAL, input.totalInclTax.toFixed(2)),
    buildTLV(TAG_TAX, input.taxAmount.toFixed(2)),
  ];
  const combined = concatBytes(fields);
  return bytesToBase64(combined);
}

/**
 * بناء مدخلات QR من إعدادات الشركة وبيانات الفاتورة.
 */
export function buildTaxQrFromInvoice(
  company: CompanySettings,
  sellerNameFallback: string,
  timestamp: string,
  totalInclTax: number,
  taxAmount: number
): TaxQrInput {
  return {
    sellerName: company.nameAr || company.name || sellerNameFallback,
    vatNumber: company.taxId || '',
    timestamp,
    totalInclTax,
    taxAmount,
  };
}

/**
 * فك ترميز TLV-Base64 (للاختبار والتحقق).
 */
export function decodeTaxQr(base64: string): TaxQrInput {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const fields: Partial<TaxQrInput> = {};
  let i = 0;
  while (i + 1 < bytes.length) {
    const tag = bytes[i];
    const len = bytes[i + 1];
    i += 2;
    if (i + len > bytes.length) break;
    const valueBytes = bytes.subarray(i, i + len);
    const value = new TextDecoder().decode(valueBytes);
    i += len;
    switch (tag) {
      case TAG_SELLER_NAME: fields.sellerName = value; break;
      case TAG_VAT_NUMBER: fields.vatNumber = value; break;
      case TAG_TIMESTAMP: fields.timestamp = value; break;
      case TAG_TOTAL: fields.totalInclTax = parseFloat(value); break;
      case TAG_TAX: fields.taxAmount = parseFloat(value); break;
    }
  }
  return {
    sellerName: fields.sellerName || '',
    vatNumber: fields.vatNumber || '',
    timestamp: fields.timestamp || '',
    totalInclTax: fields.totalInclTax || 0,
    taxAmount: fields.taxAmount || 0,
  };
}
