// Script thêm link Grooming vào sidebar của cage-management.html
const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '../../FrontEnd/html/cage-management.html'),
  path.resolve(__dirname, '../../FrontEnd/html/pet-checkin.html'),
  path.resolve(__dirname, '../../FrontEnd/html/pet-checkout.html'),
];

const OLD_LINK = `<a href="./booking.html" class="profile-nav-link">
  <span class="nav-icon">📅</span>
  <span>Đặt lịch hẹn mới</span>
  </a>`;

const NEW_LINK = `<a href="./grooming-schedule.html" class="profile-nav-link">
  <span class="nav-icon">✂️</span>
  <span>Lịch Chăm Sóc Grooming</span>
  </a>
  <a href="./booking.html" class="profile-nav-link">
  <span class="nav-icon">📅</span>
  <span>Đặt lịch hẹn mới</span>
  </a>`;

for (const f of files) {
  if (!fs.existsSync(f)) { console.log('Not found:', f); continue; }
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes('./grooming-schedule.html')) {
    console.log('Already has grooming link:', path.basename(f));
    continue;
  }
  // Find booking.html link in sidebar and insert before it
  const bookingLinkPattern = /<a href="\.\/booking\.html" class="profile-nav-link">/;
  if (!bookingLinkPattern.test(c)) {
    console.log('Pattern not found in:', path.basename(f));
    continue;
  }
  c = c.replace(bookingLinkPattern, 
    `<a href="./grooming-schedule.html" class="profile-nav-link">
  <span class="nav-icon">✂️</span>
  <span>Lịch Chăm Sóc Grooming</span>
  </a>
  <a href="./booking.html" class="profile-nav-link">`);
  fs.writeFileSync(f, c, 'utf8');
  console.log('Updated:', path.basename(f));
}
console.log('Done.');
