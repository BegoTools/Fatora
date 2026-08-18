import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDeviceFingerprint,
  validateLicenseKey,
  buildLicenseKey,
  activateLicense,
  getLicenseInfo,
  _resetTrialForTesting,
  type LicensePayload,
} from './license';

describe('Local Licensing System', () => {
  beforeEach(() => {
    _resetTrialForTesting();
  });

  it('generates consistent device fingerprint', async () => {
    const fp1 = await getDeviceFingerprint();
    const fp2 = await getDeviceFingerprint();
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThan(8);
  });

  it('validates a valid signed license key', async () => {
    const device = await getDeviceFingerprint();
    const payload: LicensePayload = {
      device,
      customerName: 'Test Client',
      issuedAt: new Date().toISOString(),
      expiryAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      type: 'license',
    };

    const key = await buildLicenseKey(payload);
    const result = await validateLicenseKey(key, device);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.customerName).toBe('Test Client');
    }
  });

  it('rejects key for wrong device', async () => {
    const device = await getDeviceFingerprint();
    const payload: LicensePayload = {
      device: 'wrong-device-id',
      customerName: 'Test Client',
      issuedAt: new Date().toISOString(),
      expiryAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      type: 'license',
    };

    const key = await buildLicenseKey(payload);
    const result = await validateLicenseKey(key, device);
    expect(result.ok).toBe(false);
  });

  it('activates valid key and updates license status', async () => {
    const device = await getDeviceFingerprint();
    const payload: LicensePayload = {
      device,
      customerName: 'Al-Noor Supermarket',
      issuedAt: new Date().toISOString(),
      expiryAt: new Date(Date.now() + 86400000 * 365).toISOString(),
      type: 'license',
    };

    const key = await buildLicenseKey(payload);
    const actResult = await activateLicense(key);
    expect(actResult.ok).toBe(true);

    const info = await getLicenseInfo();
    expect(info.status).toBe('active');
    expect(info.isReadOnly).toBe(false);
    expect(info.customerName).toBe('Al-Noor Supermarket');
  });

  it('starts trial if no active key present', async () => {
    const info = await getLicenseInfo();
    expect(info.status).toBe('trial');
    expect(info.isReadOnly).toBe(false);
    expect(info.trialEndsAt).toBeDefined();
  });
});
