(function () {
  var mq = window.matchMedia("(max-width: 767px)");
  var header = document.querySelector(".header");
  var btn = document.querySelector(".header__menu-btn");
  var nav = document.getElementById("site-main-nav");
  if (!header || !btn || !nav) return;

  function syncState() {
    var mobile = mq.matches;
    if (!mobile) {
      header.classList.remove("is-nav-open");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Open menu");
      document.body.style.overflow = "";
      return;
    }
    var open = header.classList.contains("is-nav-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  }

  btn.addEventListener("click", function () {
    if (!mq.matches) return;
    header.classList.toggle("is-nav-open");
    syncState();
  });

  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) {
      header.classList.remove("is-nav-open");
      syncState();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && header.classList.contains("is-nav-open")) {
      header.classList.remove("is-nav-open");
      syncState();
      btn.focus();
    }
  });

  mq.addEventListener("change", function () {
    header.classList.remove("is-nav-open");
    syncState();
  });
})();
