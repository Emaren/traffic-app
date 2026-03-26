self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Traffic";
  const body = payload.body || "Open Traffic";
  const url = payload.url || "/";
  const icon = payload.icon || "/icons/traffic-192.png";
  const badge = payload.badge || "/icons/traffic-180.png";
  const tag = payload.tag || "traffic-notification";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.url) || "/";

  event.notification.close();

  event.waitUntil(
    (async () => {
      const absoluteUrl = new URL(targetUrl, self.location.origin).href;
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if (!("focus" in client)) {
          continue;
        }

        try {
          const currentUrl = new URL(client.url);
          if (currentUrl.href === absoluteUrl || currentUrl.pathname === new URL(absoluteUrl).pathname) {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(absoluteUrl);
            }
            return;
          }
        } catch {
          continue;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(absoluteUrl);
      }
    })(),
  );
});
