# Deployment (demo)

## Run for the stage

```bash
npm install
npm run build
npm start          # http://localhost:3000, production mode
```

Development mode (`npm run dev`) also works and hot-reloads, but `npm start` is steadier for a live demo.

## Phones on the laptop's hotspot

1. Turn on the laptop's mobile hotspot (Windows: Settings → Network → Mobile hotspot) or join the same wifi.
2. Find the laptop's IP: `ipconfig` → the hotspot adapter's IPv4 (for example 192.168.137.1).
3. Allow port 3000 through Windows Firewall once (run as administrator):
   `netsh advfirewall firewall add rule name="TRACE 3000" dir=in action=allow protocol=TCP localport=3000`
4. On the phones open `http://<laptop-ip>:3000/phone` and `/guardian`. The microphone needs Chrome and a secure origin, so use typed answers on the phones and the laptop's own Chrome for the microphone moment on `/stage`.

## Teammates on other networks: the public tunnel

```bash
npm run tunnel
```

Prints a public HTTPS address and keeps it alive, reconnecting automatically. Share the printed
`/stage` link with the team. HTTPS also unlocks the microphone on phones, which plain
`http://<ip>:3000` blocks.

Three things worth knowing before relying on it:

- **On the same wifi, prefer the local address.** It is faster and does not depend on a tunnel provider.
- **This campus DNS does not resolve the tunnel's domain.** A phone on campus wifi may fail to open
  the link even though it works elsewhere. Fix: set the phone's DNS to 8.8.8.8, use mobile data, or
  just use the local address.
- **The free tunnel expires roughly hourly** and the address changes. The script reconnects and prints
  the new one. For a stable address, a paid tunnel or a Firebase/Vercel deployment is the answer;
  neither is needed for the demo.

Why SSH over port 443 rather than cloudflared or ngrok: this network blocks outbound port 7844,
which cloudflared requires. Port 443 gets through.

**The tunnel exposes the presenter controls too.** Anyone with the link can press Reset. Share it with
the team, not in a public channel, and stop it with Ctrl+C when you are done.

## Recovery

The server restarts in seconds and starts empty. Presenter → Reset → the beat you were on. Nothing is persisted, by design.

## Pre-demo checklist

- [ ] `npm run build && npm start` done, all four screens open, Reset pressed
- [ ] Beat 1 dry run: kirana payment succeeds
- [ ] Mic permission granted in Chrome on the laptop (stage "Let a judge play the scammer")
- [ ] Phones on the hotspot, `/phone` and `/guardian` loaded, Reconnecting banner not showing
- [ ] Deck open in a second window; explainer link on a phone
- [ ] Optional: `.env` with `OPENROUTER_API_KEY` if you want the warm rewrite; test once, then decide

## Firebase (optional, not required)

If phones must reach the app over the internet: mirror `store.state` to a Firestore document after each dispatch and hydrate on boot (still single-writer), deploy with Firebase App Hosting. Needs the Firebase web config and reliable venue internet. Not done for this demo, by decision.
