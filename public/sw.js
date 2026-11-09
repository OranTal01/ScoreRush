self.addEventListener("push", (event) => {
  let message = {
    title: "ScoreRush",
    body: "עדכון חדש מהטורניר",
    url: "/",
    tag: "scorerush",
  };
  try {
    if (event.data) message = { ...message, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icon",
      tag: message.tag,
      data: { url: message.url },
      dir: "rtl",
      lang: "he",
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return;
  event.waitUntil(self.clients.openWindow(target.href));
});
