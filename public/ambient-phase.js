(() => {
  const duration = 14000;
  const elapsed = Date.now() % duration;
  document.documentElement.style.setProperty(
    "--punktlandung-ambient-delay",
    `-${elapsed}ms`
  );
})();
