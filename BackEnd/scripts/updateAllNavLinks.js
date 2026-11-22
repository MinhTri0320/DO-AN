const fs = require('fs');
const path = require('path');

const htmlFiles = [
  path.resolve(__dirname, '../../FrontEnd/html/cage-management.html'),
  path.resolve(__dirname, '../../FrontEnd/html/pet-checkin.html'),
  path.resolve(__dirname, '../../FrontEnd/html/pet-checkout.html'),
  path.resolve(__dirname, '../../FrontEnd/html/grooming-schedule.html'),
];

const TARGET_LINK = `<a href="./grooming-schedule.html" class="profile-nav-link">
  <span class="nav-icon">✂️</span>
  <span>Lịch Chăm Sóc Grooming</span>
  </a>`;

const EXTRA_LINKS = `
  <a href="./medicine-dispensing.html" class="profile-nav-link">
  <span class="nav-icon">💊</span>
  <span>Kho Thuốc &amp; Cấp Thuốc</span>
  </a>
  <a href="./invoice-payment.html" class="profile-nav-link">
  <span class="nav-icon">💳</span>
  <span>Hóa Đơn &amp; Thanh Toán</span>
  </a>`;

for (const f of htmlFiles) {
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes('./medicine-dispensing.html') && c.includes('./invoice-payment.html')) {
    console.log('Already updated:', path.basename(f));
    continue;
  }
  // Insert after grooming link
  const groomingRegex = /<a href="\.\/grooming-schedule\.html"[\s\S]*?<\/a>/;
  if (groomingRegex.test(c)) {
    c = c.replace(groomingRegex, (match) => match + EXTRA_LINKS);
    fs.writeFileSync(f, c, 'utf8');
    console.log('Added links to:', path.basename(f));
  } else {
    console.log('Grooming link not matched in:', path.basename(f));
  }
}
console.log('All done.');
