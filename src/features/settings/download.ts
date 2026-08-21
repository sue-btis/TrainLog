/**
 * Handing a file to the browser.
 *
 * A Blob, an object URL, and a synthetic click on an anchor. There is no
 * network here and there must not be: §9 says the app makes no runtime
 * requests, and a backup is the one thing that must work when everything else
 * has failed — a lost phone, a cleared browser, no signal.
 *
 * The object URL is revoked immediately afterwards. Every one that is not holds
 * its Blob in memory until the tab closes, and a backup Blob is the whole
 * database.
 */

/** `trainlog-backup-2026-08-18.json` — the file, named for the day it was taken. */
export function download(filename: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // Firefox only follows a click on an anchor that is in the document.
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
