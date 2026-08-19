import puppeteer from 'puppeteer';
import fs from 'fs';

async function runTest() {
  console.log('Starting Puppeteer E2E Test for Employee Account Creation and Permissions...');

  let executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(executablePath)) {
    executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }

  console.log('Using browser executable:', executablePath);
  
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}]`, msg.text());
  });

  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err);
  });

  page.on('response', async res => {
    if (res.status() >= 400) {
      console.error(`[HTTP ${res.status()}] ${res.url()}`);
      try {
        const text = await res.text();
        console.error(`Response body:`, text.substring(0, 300));
      } catch (e) {}
    }
  });

  try {
    // Make sure scratch directory exists
    if (!fs.existsSync('scratch')) {
      fs.mkdirSync('scratch');
    }

    console.log('Navigating to http://localhost:3001/...');
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'scratch/step1_initial.png' });

    // Login as owner sss@gmail.com
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      console.log('Filling owner credentials: sss@gmail.com / ssssssss');
      await page.type('input[type="email"]', 'sss@gmail.com');
      await page.type('input[type="password"]', 'ssssssss');

      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('تسجيل الدخول') || text.includes('Login') || text.includes('دخول')) {
          console.log('Clicking login button:', text.trim());
          await btn.click();
          break;
        }
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    await page.screenshot({ path: 'scratch/step2_after_login.png' });
    console.log('Current URL after login:', page.url());

    // Navigate to Settings
    console.log('Navigating to http://localhost:3001/settings...');
    await page.goto('http://localhost:3001/settings', { waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'scratch/step3_settings.png' });

    // Look for Users tab
    console.log('Looking for Users tab...');
    let tabs = await page.$$('button');
    for (const tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text.includes('المستخدمين') || text.includes('Users')) {
        console.log('Clicking Users tab button:', text.trim());
        await tab.click();
        await new Promise(r => setTimeout(r, 1500));
        break;
      }
    }
    await page.screenshot({ path: 'scratch/step4_users_tab.png' });

    // Click "إضافة حساب موظف"
    let addButtons = await page.$$('button');
    let addBtnFound = false;
    for (const btn of addButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('إضافة حساب موظف') || text.includes('Add Employee Account')) {
        console.log('Clicking Add Employee Account button...');
        await btn.click();
        addBtnFound = true;
        await new Promise(r => setTimeout(r, 1500));
        break;
      }
    }
    await page.screenshot({ path: 'scratch/step5_add_user_modal.png' });

    if (addBtnFound) {
      console.log('Filling Employee details...');
      // Inputs inside modal
      const inputs = await page.$$('input');
      for (const input of inputs) {
        const type = await page.evaluate(el => el.type, input);
        const value = await page.evaluate(el => el.value, input);
        const placeholder = await page.evaluate(el => el.placeholder, input);
        console.log(`Input type=${type}, placeholder=${placeholder}, val=${value}`);
      }

      // Fill name
      const nameInput = await page.$('input[placeholder*="الاسم"], input[placeholder*="اسم"], input[type="text"]');
      if (nameInput) await nameInput.type('موظف تجريبي جديد');

      // Fill email
      const emailInputModal = await page.$('input[placeholder*="البريد"], input[placeholder*="email"], input[type="email"]');
      if (emailInputModal) await emailInputModal.type('employee_test_55@gmail.com');

      // Fill password
      const passInputs = await page.$$('input[type="password"]');
      if (passInputs.length > 0) {
        await passInputs[passInputs.length - 1].type('ssssssss');
      }

      await page.screenshot({ path: 'scratch/step6_filled_employee_form.png' });

      // Click save button in modal
      const modalButtons = await page.$$('button');
      for (const btn of modalButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('حفظ') || text.includes('إضافة') || text.includes('Save') || text.includes('إنشاء')) {
          console.log('Clicking modal save button:', text.trim());
          await btn.click();
          await new Promise(r => setTimeout(r, 4000));
          break;
        }
      }
      await page.screenshot({ path: 'scratch/step7_after_employee_save.png' });
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
    console.log('Test execution completed.');
  }
}

runTest();
