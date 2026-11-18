"use client";

import {useEffect, useRef, useState} from "react";
import type {ConcordanceScene} from "@/src/game/concordance-scene";

const durationMs = 18_000;
const shots = [
  {
    title: "La relève du matin",
    caption: "Le jour traverse les carreaux de la salle de relève. Sur la table, sous la lampe, trois feuillets attendent à distance l’un de l’autre.",
  },
  {
    title: "Trois dépositions",
    caption: "Les dossiers A, B et C dessinent chacun une partie du bâtiment. Sur chaque feuille, un trait rouge s’arrête au bord du papier.",
  },
  {
    title: "Un seul itinéraire",
    caption: "Les bords des trois relevés se rejoignent. Le trait rouge traverse les jointures sans s’interrompre. Aucun témoin n’avait vu tout le trajet.",
  },
] as const;

export function Concordance({reduceMotion, onClose}: {reduceMotion: boolean; onClose: () => void}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ConcordanceScene | null>(null);
  const position = useRef(reduceMotion ? 1 / 6 : 0);
  const [shot, setShot] = useState(0);
  const [playing, setPlaying] = useState(!reduceMotion);
  const [view, setView] = useState<"loading" | "scene" | "text">("loading");

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let mounted = true;
    let observer: ResizeObserver | undefined;
    function release() {
      observer?.disconnect();
      renderer.current?.dispose();
      renderer.current = null;
    }
    function switchToText() {
      if (!mounted) return;
      release();
      setPlaying(false);
      setView("text");
    }
    element.addEventListener("webglcontextlost", switchToText);
    async function prepare() {
      try {
        const {createConcordanceScene} = await import("@/src/game/concordance-scene");
        if (!mounted || !element) return;
        renderer.current = createConcordanceScene(element);
        function resize() {
          if (!element || !renderer.current) return;
          try {
            renderer.current.resize(element.clientWidth, element.clientHeight);
          } catch { switchToText(); }
        }
        resize();
        if (!renderer.current) return;
        renderer.current.render(position.current);
        observer = new ResizeObserver(resize);
        observer.observe(element);
        setView("scene");
      } catch { switchToText(); }
    }
    void prepare();
    return () => {
      mounted = false;
      element.removeEventListener("webglcontextlost", switchToText);
      release();
    };
  }, []);

  useEffect(() => {
    const pause = () => setPlaying(false);
    const onVisibility = () => { if (document.hidden) pause(); };
    if (document.hidden) pause();
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing || view !== "scene") return;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      if (document.hidden || !renderer.current) { setPlaying(false); return; }
      const elapsed = previous === undefined ? 0 : Math.max(0, now - previous);
      position.current = Math.min(1, position.current + elapsed / durationMs);
      previous = now;
      renderer.current.render(position.current);
      setShot(Math.min(shots.length - 1, Math.floor(position.current * shots.length)));
      if (position.current < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, view]);

  function selectShot(index: number) {
    setPlaying(false);
    position.current = (index + 0.5) / shots.length;
    renderer.current?.render(position.current);
    setShot(index);
  }
  function togglePlayback() {
    if (position.current >= 1) {
      position.current = 0;
      setShot(0);
    }
    setPlaying(current => !current);
  }
  return <>
    <h2 id="modal-title">Concordance</h2>
    <figure className="concordance-film" data-view={view} data-playing={playing && view === "scene"}>
      <canvas ref={canvas} aria-hidden="true" hidden={view === "text"} />
      {view === "text" && <p className="fine-print" role="status">La salle 3D est indisponible. Parcourez les trois descriptions avec les boutons de parcours.</p>}
      <figcaption aria-live={playing ? "off" : "polite"} aria-atomic="true">
        <span className="eyebrow">PLAN {shot + 1} / {shots.length}</span>
        <h3>{shots[shot].title}</h3>
        <p>{shots[shot].caption}</p>
      </figcaption>
    </figure>
    <div className="concordance-controls">
      <button type="button" className="outline-button" disabled={shot === 0} onClick={() => selectShot(shot - 1)}>Plan précédent</button>
      <button type="button" className="outline-button" disabled={shot === shots.length - 1} onClick={() => selectShot(shot + 1)}>Plan suivant</button>
      {view === "scene" && <button type="button" className="outline-button" onClick={togglePlayback}>
        {playing ? "Pause" : position.current >= 1 ? "Revoir la séquence" : "Lecture animée"}
      </button>}
    </div>
    <button type="button" className="solid-button wide" onClick={onClose}>Retour au bilan</button>
  </>;
}
