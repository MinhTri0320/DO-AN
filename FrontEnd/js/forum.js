/* ============================================================
   forum.js
   Task "Forum": đăng bài, xem danh sách bài, thích/bỏ thích.
   ============================================================ */

import { STORAGE_KEYS, getData, setData, formatTimeAgo, escapeHTML } from "./storage.js";
import { getCurrentUser } from "./auth.js";

function seedForumIfEmpty() {
  const existing = getData(STORAGE_KEYS.FORUM_POSTS, null);
  if (existing) return existing;

  const now = Date.now();
  const seeded = [
    {
      id: 1,
      author: "Minh Anh",
      time: now - 3 * 60 * 60 * 1000,
      content:
        "Mọi người ơi, bé mèo nhà mình dạo này hay lười ăn, có ai gặp tình trạng tương tự chưa ạ? 🐱",
      likes: 5,
      liked: false,
    },
    {
      id: 2,
      author: "Thanh Tùng",
      time: now - 20 * 60 * 60 * 1000,
      content:
        "Vừa cho bé Golden nhà mình đi spa ở PawnCare về, cực kỳ hài lòng luôn! Lông mượt hẳn ra 😍",
      likes: 12,
      liked: false,
    },
  ];
  setData(STORAGE_KEYS.FORUM_POSTS, seeded);
  return seeded;
}

export function initForumPage() {
  const listEl = document.getElementById("postList");
  if (!listEl) return; // không ở trang forum thì bỏ qua

  const user = getCurrentUser();
  const composerBox = document.getElementById("composerBox");
  const lockedBox = document.getElementById("composerLocked");

  if (user) {
    if (composerBox) composerBox.hidden = false;
    if (lockedBox) lockedBox.hidden = true;
  } else {
    if (composerBox) composerBox.hidden = true;
    if (lockedBox) lockedBox.hidden = false;
  }

  function draw() {
    const posts = seedForumIfEmpty().sort((a, b) => b.time - a.time);
    listEl.innerHTML = posts
      .map(
        (p) => `
        <article class="post-card" data-id="${p.id}">
          <div class="post-head">
            <span class="avatar">${escapeHTML(p.author.charAt(0))}</span>
            <div>
              <p class="post-author">${escapeHTML(p.author)}</p>
              <p class="post-time">${formatTimeAgo(p.time)}</p>
            </div>
          </div>
          <p class="post-body">${escapeHTML(p.content)}</p>
          <div class="post-actions">
            <button class="post-action ${p.liked ? "liked" : ""}" data-action="like">
              👍 <span>${p.liked ? "Đã thích" : "Thích"} (${p.likes})</span>
            </button>
            <span class="post-action" style="cursor:default">💬 Bình luận</span>
          </div>
        </article>`
      )
      .join("");

    listEl.querySelectorAll('[data-action="like"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".post-card");
        const id = Number(card.dataset.id);
        const posts = getData(STORAGE_KEYS.FORUM_POSTS, []);
        const post = posts.find((p) => p.id === id);
        if (!post) return;
        post.liked = !post.liked;
        post.likes += post.liked ? 1 : -1;
        setData(STORAGE_KEYS.FORUM_POSTS, posts);
        draw();
      });
    });
  }

  const submitBtn = document.getElementById("submitPost");
  const textarea = document.getElementById("postContent");
  if (submitBtn && textarea) {
    submitBtn.addEventListener("click", () => {
      const content = textarea.value.trim();
      if (!content) {
        textarea.focus();
        return;
      }
      const posts = getData(STORAGE_KEYS.FORUM_POSTS, []);
      posts.unshift({
        id: Date.now(),
        author: user ? user.name : "Ẩn danh",
        time: Date.now(),
        content,
        likes: 0,
        liked: false,
      });
      setData(STORAGE_KEYS.FORUM_POSTS, posts);
      textarea.value = "";
      draw();
    });
  }

  draw();
}
