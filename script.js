import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, doc, collection, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9u2bM-pE8zQoPZPDpTaPnqG4OOO7wClo",
  authDomain: "product-verification-ba7db.firebaseapp.com",
  projectId: "product-verification-ba7db",
  storageBucket: "product-verification-ba7db.firebasestorage.app",
  messagingSenderId: "599477235099",
  appId: "1:599477235099:web:ea8083a3855bcdf309c53e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const codeInput = document.getElementById('codeInput');
const checkBtn = document.getElementById('checkBtn');
const result = document.getElementById('result');
const qrBtn = document.getElementById('qrBtn');
const qrModal = document.getElementById('qrModal');
const closeQr = document.getElementById('closeQr');
const startCamera = document.getElementById('startCamera');
const qrFile = document.getElementById('qrFile');
const qrStatus = document.getElementById('qrStatus');

let html5QrCode = null;
let cameraRunning = false;

function cleanCode(value) {
  return String(value || '').trim().toUpperCase();
}

function extractCode(qrText) {
  const text = String(qrText || '').trim();
  try {
    const url = new URL(text);
    return cleanCode(url.searchParams.get('code') || url.searchParams.get('serial') || url.pathname.split('/').filter(Boolean).pop());
  } catch {
    return cleanCode(text);
  }
}

function formatDate(date) {
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function showResult(type, html) {
  result.className = `result ${type}`;
  result.innerHTML = html;
}

async function checkCode() {
  const code = cleanCode(codeInput.value);
  if (!code) {
    showResult('error', 'من فضلك أدخل الرمز أولًا ❌<br>Enter the code first');
    return;
  }

  checkBtn.disabled = true;
  checkBtn.textContent = '...';
  showResult('', '');

  try {
    const checkedAt = new Date();
    const checkedAtText = formatDate(checkedAt);
    const codeRef = doc(db, 'codes', code);
    const logRef = doc(collection(db, 'verifications'));

    const outcome = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(codeRef);

      if (!snap.exists()) return { status: 'not-found' };

      const data = snap.data();
      if (data.used === true) {
        return { status: 'used', product: data.product || '', verifiedAt: data.verifiedAt || '-' };
      }

      transaction.update(codeRef, {
        used: true,
        verifiedAt: checkedAtText,
        verifiedAtServer: serverTimestamp()
      });

      transaction.set(logRef, {
        code,
        product: data.product || '',
        status: 'genuine',
        checkedAt: checkedAtText,
        checkedAtServer: serverTimestamp()
      });

      return { status: 'genuine', product: data.product || '', checkedAt: checkedAtText };
    });

    if (outcome.status === 'not-found') {
      showResult('error', 'هذا الرمز غير موجود ❌<br>Code not found');
    } else if (outcome.status === 'used') {
      showResult('error', `تم استخدام هذا الرمز ❌<br>Code is already used<small>Product: ${outcome.product || '-'}</small><small>تاريخ أول تحقق: ${outcome.verifiedAt || '-'}</small>`);
    } else {
      showResult('success', `المنتج أصلي ✅<br>Product is Genuine<small>Product: ${outcome.product || '-'}</small><small>تاريخ التحقق: ${outcome.checkedAt}</small>`);
    }
  } catch (error) {
    console.error(error);
    showResult('error', 'حدث خطأ أثناء التحقق ❌<br>Please try again');
  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent = 'Check';
  }
}

async function stopCamera() {
  if (html5QrCode && cameraRunning) {
    try { await html5QrCode.stop(); } catch {}
    cameraRunning = false;
  }
}

async function openQrModal() {
  qrModal.classList.remove('hidden');
  qrStatus.textContent = '';
  if (!html5QrCode) html5QrCode = new Html5Qrcode('qr-reader');
}

async function closeQrModal() {
  await stopCamera();
  qrModal.classList.add('hidden');
}

async function onQrSuccess(decodedText) {
  const code = extractCode(decodedText);
  if (!code) {
    qrStatus.textContent = 'لم يتم العثور على كود داخل QR';
    return;
  }
  codeInput.value = code;
  await closeQrModal();
  checkCode();
}

qrBtn.addEventListener('click', openQrModal);
closeQr.addEventListener('click', closeQrModal);
checkBtn.addEventListener('click', checkCode);
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkCode(); });

startCamera.addEventListener('click', async () => {
  qrStatus.textContent = '';
  try {
    if (!html5QrCode) html5QrCode = new Html5Qrcode('qr-reader');
    await html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, onQrSuccess);
    cameraRunning = true;
  } catch (err) {
    qrStatus.textContent = 'افتح الموقع من HTTPS واسمح باستخدام الكاميرا';
  }
});

qrFile.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  qrStatus.textContent = '';
  try {
    if (!html5QrCode) html5QrCode = new Html5Qrcode('qr-reader');
    const decodedText = await html5QrCode.scanFile(file, true);
    await onQrSuccess(decodedText);
  } catch (err) {
    qrStatus.textContent = 'لم نستطع قراءة QR من الصورة';
  } finally {
    qrFile.value = '';
  }
});
