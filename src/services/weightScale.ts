// ============================================================
// Easy Store ERP - محلل باركود أجهزة الموازين الإلكترونية (Weight Scale Barcode)
// ------------------------------------------------------------
// صيغة القياس العالمية المعتمدة لباركود الموازين (13 رقم):
//   النمط: [البادئة 2 رقم: "21" أو "22"] + [كود الصنف 5 أرقام] + [الوزن أو السعر 5 أرقام] + [خانة التحقق 1 رقم]
//   مثال: 2100123015004 -> كود الصنف 00123، الوزن 1.500 كجم (أو السعر 15.00 ج.م)
// ============================================================

export interface ParsedWeightScaleBarcode {
  isWeightScaleBarcode: boolean;
  prefix: string;
  itemCode: string;
  weightOrValue: number; // الوزن بالكجم أو القيمة بالجنية
  rawBarcode: string;
}

export function parseWeightScaleBarcode(
  barcode: string,
  allowedPrefixes: string[] = ['21', '22', '27']
): ParsedWeightScaleBarcode {
  const clean = barcode.trim();
  if (clean.length !== 13 || !/^\d{13}$/.test(clean)) {
    return { isWeightScaleBarcode: false, prefix: '', itemCode: '', weightOrValue: 0, rawBarcode: clean };
  }

  const prefix = clean.substring(0, 2);
  if (!allowedPrefixes.includes(prefix)) {
    return { isWeightScaleBarcode: false, prefix: '', itemCode: '', weightOrValue: 0, rawBarcode: clean };
  }

  const itemCode = clean.substring(2, 7);
  const rawValue = parseInt(clean.substring(7, 12), 10);
  const weightOrValue = rawValue / 1000; // تحويل من جرامات إلى كجم (أو قروش إلى جنيهات)

  return {
    isWeightScaleBarcode: true,
    prefix,
    itemCode,
    weightOrValue,
    rawBarcode: clean,
  };
}
