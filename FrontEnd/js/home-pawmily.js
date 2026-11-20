/* ============================================================
   home-pawmily.js
   Tương tác cho các khối tính năng phong cách Pawmily.vn:
   1. Sao chép nhanh mã ưu đãi (WELOVEPML20, DOUB5, TRIP7)
   2. Bảng tính thử chi phí dịch vụ cho thú cưng (Cost Estimator)
   ============================================================ */

export function initHomePawmilyFeatures() {
  // 1. Sao chép mã voucher (Ticket chính, Header pill, Mini tags)
  initVoucherCopy();

  // 2. Bộ tính thử chi phí dịch vụ
  initCostEstimator();

  // 3. Thanh điều hướng cuộn ngang (< / >) & chuyển ngôn ngữ VI / EN
  initHeaderPawmilyControls();

  // 4. Tương tác Mascot mèo/cún lấp ló & nút quà tặng nổi
  initPeekingMascotsAndWidgets();

  // 5. Hoạt ảnh xuất hiện mượt mà khi cuộn trang (Scroll Reveal)
  initScrollRevealAnimations();
}

/**
 * Tính năng sao chép mã voucher với phản hồi trực quan
 */
function initVoucherCopy() {
  // Nút copy cũ (nếu có)
  document.querySelectorAll(".btn-copy-voucher").forEach((btn) => {
    btn.addEventListener("click", () => {
      copyCodeToClipboard(btn.dataset.code, () => {
        const originalText = btn.textContent;
        btn.textContent = "✓ Đã chép!";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove("copied");
        }, 2400);
      });
    });
  });

  // 1. Ticket đục lỗ chính (#mainTicketCode)
  const mainTicket = document.getElementById("mainTicketCode");
  const ticketSubHint = document.getElementById("ticketSubHint");
  if (mainTicket) {
    const handleTicketCopy = () => {
      const code = mainTicket.dataset.code || "WELOVEPML20";
      copyCodeToClipboard(code, () => {
        mainTicket.classList.add("copied");
        const codeSpan = mainTicket.querySelector(".ticket-code-text");
        const oldCode = codeSpan ? codeSpan.textContent : code;
        if (codeSpan) codeSpan.textContent = "✓ ĐÃ SAO CHÉP";
        if (ticketSubHint) ticketSubHint.textContent = "Tuyệt vời! Hãy dán mã này ở bước Đặt lịch nhé 🐾";

        setTimeout(() => {
          mainTicket.classList.remove("copied");
          if (codeSpan) codeSpan.textContent = oldCode;
          if (ticketSubHint) ticketSubHint.textContent = "Chạm vào khung mã để sao chép & sử dụng khi đặt lịch";
        }, 2600);
      });
    };
    mainTicket.addEventListener("click", handleTicketCopy);
    mainTicket.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleTicketCopy();
      }
    });
  }

  // 2. Pill mã giảm giá trên Header (.header-voucher-pill)
  document.querySelectorAll(".header-voucher-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const code = pill.dataset.copy || "WELOVEPML20";
      copyCodeToClipboard(code);
    });
  });

  // 3. Tag voucher phụ (.mini-voucher-tag: DOUB5, TRIP7)
  document.querySelectorAll(".mini-voucher-tag").forEach((tag) => {
    tag.addEventListener("click", () => {
      const code = tag.dataset.code;
      if (code) copyCodeToClipboard(code);
    });
  });
}

function copyCodeToClipboard(code, onSuccess) {
  if (!code) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        showQuickToast(`Đã sao chép mã ưu đãi: ${code}. Hãy nhập mã khi đặt lịch!`);
        if (typeof onSuccess === "function") onSuccess();
      })
      .catch(() => {
        showQuickToast(`Mã ưu đãi của bạn: ${code}`);
        if (typeof onSuccess === "function") onSuccess();
      });
  } else {
    showQuickToast(`Mã ưu đãi của bạn: ${code}`);
    if (typeof onSuccess === "function") onSuccess();
  }
}

/**
 * Điều khiển cuộn ngang thanh điều hướng pill & nút chuyển ngôn ngữ VI / EN
 */
function initHeaderPawmilyControls() {
  const menu = document.getElementById("menu");
  const btnLeft = document.getElementById("navScrollLeft");
  const btnRight = document.getElementById("navScrollRight");

  if (menu && btnLeft && btnRight) {
    btnLeft.addEventListener("click", () => {
      menu.scrollBy({ left: -260, behavior: "smooth" });
    });
    btnRight.addEventListener("click", () => {
      menu.scrollBy({ left: 260, behavior: "smooth" });
    });
  }

  // Chuyển đổi trạng thái nút VI / EN
  const langBtns = document.querySelectorAll(".lang-switch-pill .lang-btn");
  langBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      langBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const lang = btn.dataset.lang;
      if (lang === "en") {
        showQuickToast("🌐 Switched to English preview mode (PawnCare International)");
      } else {
        showQuickToast("🇻🇳 Đã chuyển về ngôn ngữ Tiếng Việt");
      }
    });
  });
}

/**
 * Tương tác Mascot mèo lấp ló góc trái & nút đóng quà tặng
 */
function initPeekingMascotsAndWidgets() {
  const catWidget = document.getElementById("peekingCatWidget");
  const bubble = document.getElementById("peekingSpeechBubble");
  const dogWidget = document.getElementById("peekingDogWidget");
  const closeGiftBtn = document.getElementById("closeGiftBtn");

  const cuteMessages = [
    "Cát hữu cơ ở khách sạn<br />🐱 mèo chuẩn 5 sao nha! 🐱<br />⭐",
    "Nhập mã <b>WELOVEPML20</b><br />🎁 giảm ngay 20% nè ba mẹ! 🐾",
    "Phòng khám có bác sĩ trực<br />🩺 24/7 siêu tận tâm luôn! 🤎",
    "Tắm thảo dược xong thơm<br />✨ phức suốt cả tuần luôn á! 💖",
  ];
  let msgIndex = 0;

  if (catWidget && bubble) {
    catWidget.addEventListener("click", () => {
      msgIndex = (msgIndex + 1) % cuteMessages.length;
      bubble.style.opacity = "0";
      bubble.style.transform = "translate3d(0, 6px, 0) scale(0.95)";
      setTimeout(() => {
        bubble.innerHTML = cuteMessages[msgIndex];
        bubble.style.opacity = "1";
        bubble.style.transform = "translate3d(0, 0, 0) scale(1)";
      }, 180);
    });
  }

  if (dogWidget) {
    dogWidget.addEventListener("click", () => {
      showQuickToast("🐶 Gâu gâu! Đặt lịch Spa & Khách sạn nhận ngay ưu đãi -20% nha ba mẹ!");
    });
  }

  if (closeGiftBtn) {
    closeGiftBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const giftBtn = closeGiftBtn.closest(".floating-gift-btn");
      if (giftBtn) {
        giftBtn.classList.add("gift-closing");
        setTimeout(() => {
          giftBtn.style.display = "none";
        }, 250);
      }
    });
  }
}

/**
 * Hoạt ảnh xuất hiện mượt mà khi cuộn trang (IntersectionObserver 60fps)
 */
function initScrollRevealAnimations() {
  const autoRevealTargets = document.querySelectorAll(
    ".service-card, .process-step-card, .feature-card, .review-card, .estimator-card, .about-inner, .contact-form-card, .booking-showcase-card, .booking-step-card, .profile-card, .pet-switch-strip, .pet-health-id-card, .history-summary-ribbon, .weight-trend-box, .diag-visit-selector-bar, .diag-sheet-wrapper, .composer"
  );

  const viewportThreshold = window.innerHeight * 0.96;

  autoRevealTargets.forEach((el, idx) => {
    el.classList.add("reveal-on-scroll");
    el.style.transitionDelay = `${(idx % 4) * 55}ms`;
    const rect = el.getBoundingClientRect();
    if (rect.top < viewportThreshold && rect.bottom > 0) {
      el.classList.add("revealed");
    }
  });

  const allReveals = document.querySelectorAll(".reveal-on-scroll:not(.revealed)");
  if (allReveals.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    allReveals.forEach((el) => el.classList.add("revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.04, rootMargin: "0px 0px -12px 0px" }
  );

  allReveals.forEach((el) => observer.observe(el));
}

/**
 * Bảng giá cơ sở để ước tính chi phí theo loài, cân nặng và gói dịch vụ
 */
const PRICING_MATRIX = {
  dog: {
    small: {
      bath: { orig: 150000, final: 120000, desc: ["Tắm dưỡng thảo dược dịu nhẹ", "Vệ sinh tai, cắt mài móng", "Vắt tuyến hôi & sấy phồng"] },
      grooming: { orig: 350000, final: 280000, desc: ["Combo tắm vệ sinh toàn diện", "Cắt tỉa tạo kiểu form tròn Hàn Quốc", "Dưỡng bóng lông thảo dược & xịt thơm"] },
      hotel: { orig: 200000, final: 160000, desc: ["Phòng Dog Suite máy lạnh 26°C", "Đệm massage êm ái, dạo sân cỏ 2 lần/ngày", "Camera HD theo dõi 24/7 cho ba mẹ"] },
      vet: { orig: 180000, final: 144000, desc: ["Khám tổng quát mắt, tai, răng, tim phổi", "Tư vấn dinh dưỡng chuyên biệt", "Sổ giun định kỳ miễn phí"] },
    },
    medium: {
      bath: { orig: 200000, final: 160000, desc: ["Tắm dưỡng thảo dược khử mùi hôi", "Vệ sinh tai, cắt mài móng", "Vắt tuyến hôi & sấy tơi lông"] },
      grooming: { orig: 450000, final: 360000, desc: ["Combo tắm vệ sinh toàn diện", "Cắt tạo kiểu tỉ mỉ theo form giống", "Dưỡng mượt lông cao cấp"] },
      hotel: { orig: 280000, final: 224000, desc: ["Phòng Dog Suite rộng rãi điều hòa 2 chiều", "Đệm massage, dạo sân cỏ 2 lần/ngày", "Camera HD theo dõi 24/7 cho ba mẹ"] },
      vet: { orig: 220000, final: 176000, desc: ["Khám lâm sàng toàn diện chuyên sâu", "Kiểm tra da liễu & xương khớp", "Sổ giun định kỳ"] },
    },
    large: {
      bath: { orig: 300000, final: 240000, desc: ["Tắm sục bồn khoáng thảo dược", "Khử mùi hôi & chải rụng lông", "Vệ sinh móng và tai sạch sẽ"] },
      grooming: { orig: 600000, final: 480000, desc: ["Tắm dưỡng làm tơi phồng lông", "Tỉa gọn gàng lông bàn chân, bụng, tai", "Tạo form thanh lịch tiêu chuẩn"] },
      hotel: { orig: 380000, final: 304000, desc: ["Phòng Dog Suite VIP không gian mở", "Vận động sân cỏ tự do cùng chuyên viên", "Camera HD trực tiếp 24/7"] },
      vet: { orig: 250000, final: 200000, desc: ["Khám thể trọng, tim mạch và xương khớp", "Đo sinh hiệu toàn diện", "Tư vấn phác đồ phòng bệnh"] },
    },
    xlarge: {
      bath: { orig: 420000, final: 336000, desc: ["Tắm massage chuyên sâu cho cún đại", "Xả sạch sấy khô với máy sấy công suất lớn", "Chăm sóc móng và đệm chân"] },
      grooming: { orig: 750000, final: 600000, desc: ["Vệ sinh toàn thân và chải rối chuyên sâu", "Tạo kiểu thẩm mỹ chuẩn giống quốc tế", "Dưỡng lông mềm mượt bóng khỏe"] },
      hotel: { orig: 480000, final: 384000, desc: ["Phòng nghỉ VIP cỡ đại thoáng mát 26°C", "Lịch trình vận động sân cỏ 3 lần/ngày", "Camera giám sát liên tục cho ba mẹ"] },
      vet: { orig: 300000, final: 240000, desc: ["Khám tổng quát chuyên sâu bác sĩ CKI", "Kiểm tra khớp háng và tiêu hóa", "Sổ theo dõi sức khỏe trọn đời"] },
    },
  },
  cat: {
    small: {
      bath: { orig: 160000, final: 128000, desc: ["Tắm êm dịu chuyên biệt cho mèo nhát nước", "Vệ sinh tai, cắt móng nhẹ nhàng", "Sấy lồng êm ái không gây giật mình"] },
      grooming: { orig: 320000, final: 256000, desc: ["Tắm dưỡng mềm mượt & gỡ rối lông", "Cắt tỉa gọn gàng đệm chân, bụng và mông", "Xịt dưỡng lông cao cấp thơm lâu"] },
      hotel: { orig: 180000, final: 144000, desc: ["Phòng Cat Villa riêng biệt yên tĩnh", "Trụ cào móng, khay cát sạch vô trùng", "Camera HD 24/7 không góc chết"] },
      vet: { orig: 180000, final: 144000, desc: ["Khám tổng quát mắt, mũi, tai, răng", "Kiểm tra hô hấp và tiêu hóa", "Sổ giun định kỳ"] },
    },
    medium: {
      bath: { orig: 200000, final: 160000, desc: ["Tắm dưỡng thảo mộc khử dầu bết lông", "Vệ sinh tai, cạo lông đệm chân", "Sấy lông tơi phồng êm ái"] },
      grooming: { orig: 380000, final: 304000, desc: ["Cắt tỉa form sư tử hoặc form tròn tròn", "Dưỡng da chống nấm và khử mùi", "Cắt tỉa móng cẩn thận"] },
      hotel: { orig: 220000, final: 176000, desc: ["Phòng Cat Villa 2 tầng có view ngắm cảnh", "Đệm lông êm ái, cỏ mèo Catnip thư giãn", "Camera HD trực tiếp cho ba mẹ"] },
      vet: { orig: 200000, final: 160000, desc: ["Khám sức khỏe tổng quát toàn diện", "Kiểm tra hệ bài tiết và bàng quang", "Tư vấn dinh dưỡng hạt & pate"] },
    },
    large: {
      bath: { orig: 260000, final: 208000, desc: ["Tắm dưỡng đặc trị khử bã nhờn cho mèo lớn", "Gỡ rối lông sâu và massage thư giãn", "Sấy phồng tơi lông chuyên nghiệp"] },
      grooming: { orig: 460000, final: 368000, desc: ["Cắt tỉa tạo dáng thẩm mỹ sang trọng", "Gội xả dưỡng chất kích thích mọc lông", "Vệ sinh toàn diện tai, mắt, móng"] },
      hotel: { orig: 280000, final: 224000, desc: ["Phòng Cat Villa VIP siêu rộng", "Cây mèo leo trèo giải trí riêng biệt", "Camera HD sắc nét theo dõi 24/7"] },
      vet: { orig: 240000, final: 192000, desc: ["Kiểm tra chuyên sâu tim mạch & thận", "Siêu âm tầm soát sức khỏe tổng quát", "Tư vấn chăm sóc lông da định kỳ"] },
    },
    xlarge: {
      bath: { orig: 320000, final: 256000, desc: ["Tắm sục làm sạch sâu cho mèo giống lớn (Maine Coon...)", "Vệ sinh móng, tai và tuyến hôi", "Sấy khô êm ái giữ ấm cơ thể"] },
      grooming: { orig: 550000, final: 440000, desc: ["Tạo kiểu lông thời trang chuẩn form quốc tế", "Dưỡng chất phục hồi sợi lông hư tổn", "Xịt tinh dầu thư giãn an toàn cho mèo"] },
      hotel: { orig: 350000, final: 280000, desc: ["Phòng Suite Cat Villa đẳng cấp hoàng gia", "Thực đơn dinh dưỡng cao cấp theo yêu cầu", "Nhân viên túc trực tương tác và cưng nựng"] },
      vet: { orig: 280000, final: 224000, desc: ["Khám toàn diện cơ xương khớp & sinh hóa", "Đo chỉ số sinh hiệu đầy đủ", "Phác đồ phòng bệnh riêng biệt"] },
    },
  },
};

/**
 * Khởi tạo bộ tính chi phí trực quan
 */
function initCostEstimator() {
  const estimatorBox = document.getElementById("pawmilyEstimator");
  if (!estimatorBox) return;

  let currentSpecies = "dog";
  let currentWeight = "small";
  let currentService = "bath";

  const speciesPills = document.querySelectorAll("#estSpeciesPills .est-pill");
  const weightPills = document.querySelectorAll("#estWeightPills .est-pill");
  const serviceSelect = document.getElementById("estServiceSelect");

  const priceOriginalEl = document.getElementById("estPriceOriginal");
  const priceFinalEl = document.getElementById("estPriceFinal");
  const detailsListEl = document.getElementById("estDetailsList");
  const btnBookEl = document.getElementById("estBtnBook");

  let estimatorReady = false;

  function updateEstimator() {
    const speciesData = PRICING_MATRIX[currentSpecies] || PRICING_MATRIX.dog;
    const weightData = speciesData[currentWeight] || speciesData.small;
    const result = weightData[currentService] || weightData.bath;

    if (priceOriginalEl) {
      priceOriginalEl.textContent = `${result.orig.toLocaleString("vi-VN")}đ`;
    }
    if (priceFinalEl) {
      priceFinalEl.textContent = `${result.final.toLocaleString("vi-VN")}đ`;
      if (estimatorReady) {
        priceFinalEl.classList.remove("price-pop");
        void priceFinalEl.offsetWidth;
        priceFinalEl.classList.add("price-pop");
      }
    }

    if (detailsListEl && result.desc) {
      detailsListEl.innerHTML = result.desc.map((item) => `<li><span>✓</span> ${item}</li>`).join("");
    }

    if (btnBookEl) {
      btnBookEl.href = `./booking.html?service=${currentService}&species=${currentSpecies}&weight=${currentWeight}&promo=WELOVEPML20`;
    }
    estimatorReady = true;
  }

  // Sự kiện chọn loài
  speciesPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      speciesPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentSpecies = pill.dataset.species;
      updateEstimator();
    });
  });

  // Sự kiện chọn cân nặng
  weightPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      weightPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentWeight = pill.dataset.weight;
      updateEstimator();
    });
  });

  // Sự kiện chọn dịch vụ
  if (serviceSelect) {
    serviceSelect.addEventListener("change", (e) => {
      currentService = e.target.value;
      updateEstimator();
    });
  }

  // Chạy lần đầu
  updateEstimator();
}

/**
 * Hiển thị Toast thông báo nhanh
 */
function showQuickToast(message) {
  let toast = document.getElementById("profileToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "profileToast";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }
  toast.className = "toast-notice success show";
  toast.innerHTML = `<span>✓</span> <span>${message}</span>`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}
