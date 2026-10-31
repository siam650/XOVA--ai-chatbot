const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-navigation");
const mobileNavigation = window.matchMedia("(max-width: 820px)");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

document.documentElement.classList.add("js");

function setMenuOpen(isOpen) {
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
  navigation.classList.toggle("is-open", isOpen);
  navigation.inert = mobileNavigation.matches && !isOpen;
}

function syncNavigation() {
  if (!mobileNavigation.matches) {
    navigation.inert = false;
    navigation.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    return;
  }

  setMenuOpen(false);
}

menuToggle.addEventListener("click", () => {
  setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

navigation.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest("a") : null;
  if (link) {
    setMenuOpen(false);
    if (mobileNavigation.matches) {
      menuToggle.focus();
    }
  }
});

document.addEventListener("click", (event) => {
  if (
    mobileNavigation.matches &&
    menuToggle.getAttribute("aria-expanded") === "true" &&
    !navigation.contains(event.target) &&
    !menuToggle.contains(event.target)
  ) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    setMenuOpen(false);
    menuToggle.focus();
  }
});

document.addEventListener("click", (event) => {
  const link =
    event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
  if (!link || link.hash.length < 2) {
    return;
  }

  const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (!target) {
    return;
  }

  event.preventDefault();
  target.scrollIntoView({
    behavior: prefersReducedMotion.matches ? "auto" : "smooth",
    block: "start",
  });

  if (window.location.hash !== link.hash) {
    window.history.pushState(null, "", link.hash);
  }
}, true);

mobileNavigation.addEventListener("change", syncNavigation);
syncNavigation();

document.querySelector("#current-year").textContent = new Date().getFullYear();
const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && !prefersReducedMotion.matches) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -24px 0px" },
  );

  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}
