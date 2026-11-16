"use client";

import { useEffect, useState } from 'react';
import { loadReleaseDownloads, resolveReleaseDownloads, type ReleaseDownloads as Downloads } from '@/src/game/release-downloads';

/** Local and public distributions share the same version-bound download policy. */
export function ReleaseDownloads() {
  const [downloads, setDownloads] = useState<Downloads | null>(null);
  useEffect(() => {
    const controller = new AbortController(); let live = true;
    const timer = setTimeout(() => {
      controller.abort(); if (live) setDownloads(resolveReleaseDownloads(null));
    }, 6000);
    void loadReleaseDownloads(controller.signal).then(result => {
      if (live && !controller.signal.aborted) setDownloads(result);
    }).catch(() => {
      if (live && !controller.signal.aborted) setDownloads(resolveReleaseDownloads(null));
    }).finally(() => clearTimeout(timer));
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, []);
  return <section aria-label="Téléchargements et révision">
    <p className="fine-print" role="status">{!downloads ? 'Vérification de la révision…' : downloads.build
      ? `Version ${downloads.build.version} · révision ${downloads.build.commit.slice(0, 12)} · ${downloads.build.target === 'portable' ? 'édition locale' : 'édition web'}`
      : 'Révision indisponible : aucun ancien ZIP n’est présenté comme une mise à jour.'}</p>
    <div className="download-list">
      <a className="download-link" href="/downloads/PARALLAXE_Design_Complet.xlsx" download>Conception historique (.xlsx)</a>
      {downloads?.sources && <a className="download-link" href={downloads.sources.href}
        download={!downloads.sources.external || undefined} target={downloads.sources.external ? '_blank' : undefined}
        rel={downloads.sources.external ? 'noopener noreferrer' : undefined}>{downloads.sources.label}</a>}
      {downloads && <a className="download-link" href={downloads.packages.href} target="_blank" rel="noopener noreferrer">{downloads.packages.label}</a>}
    </div>
    {downloads && <p className="fine-print">Les paquets compilés sont dans les artefacts de la vérification GitHub réussie. Leur téléchargement demande une connexion GitHub ; leur conservation est limitée à 14 jours. Comparer leur COMMIT.txt à la révision affichée. Le lien vers les sources GitHub reste distinct.</p>}
    {downloads?.sources?.sha256 && <p className="fine-print" style={{ overflowWrap: 'anywhere' }}>SHA-256 annoncé des sources embarquées : <code>{downloads.sources.sha256}</code></p>}
  </section>;
}
