/**
 * courbe.js — la progression dans le temps, tracée depuis l'historique du dépôt.
 *
 * EN SVG, PAS EN CANVAS. La carte de partage est en canvas parce qu'elle doit
 * sortir en image ; celle-ci reste dans la page, et une courbe faite d'éléments
 * a trois avantages que le canvas n'a pas : elle se redimensionne sans se
 * repixelliser, ses points peuvent porter une infobulle sans qu'on ait à
 * recalculer une zone de clic, et elle suit le thème par `currentColor` au lieu
 * qu'on relise les variables au dessin.
 *
 * ELLE NE S'OUVRE QUE SUR DEMANDE, et pour cause : la première fois, elle
 * télécharge une vingtaine de versions de `collection.json`. La faire au
 * démarrage aurait coûté ce prix à chaque visite, pour un écran qu'on regarde
 * une fois par mois.
 *
 * SANS JETON, PAS DE BOUTON. L'historique est celui du dépôt : sans dépôt
 * configuré, il n'y a rien à lire. Le bouton reste caché plutôt que de
 * s'afficher et d'échouer — un bouton qui ne peut pas marcher est pire qu'un
 * bouton absent.
 */

import { el, fill } from "../core/dom.js";
import { t, tn } from "../core/i18n.js";
import { chargerHistorique } from "../domain/historique.js";
import { retourFerme } from "./retour.js";

const NS = "http://www.w3.org/2000/svg";
const LARGEUR = 640;
const HAUTEUR = 260;
const MARGE = { haut: 16, droite: 14, bas: 34, gauche: 52 };

function svg(nom, attrs = {}) {
  const node = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/**
 * Le tracé.
 *
 * Deux courbes sur le même graphique — les cases et les espèces — et donc deux
 * échelles ? Non : une seule, celle des cases, et les espèces ramenées dessus.
 * Deux axes verticaux sur un graphique de 640 px sont deux fois plus de choses
 * à lire qu'il n'y a d'information, et le rapport entre les deux courbes est
 * justement ce qu'on veut voir — une collection qui gagne des cases sans gagner
 * d'espèces est quelqu'un qui complète ce qu'il a déjà.
 */
function tracer(points) {
  const cadre = svg("svg", {
    viewBox: `0 0 ${LARGEUR} ${HAUTEUR}`,
    class: "courbe__svg",
    role: "img",
    "aria-label": t("Progression dans le temps"),
  });

  const max = Math.max(...points.map((p) => p.cases), 1);
  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime();
  const etendue = t1 - t0 || 1;

  const x = (p) =>
    MARGE.gauche + ((new Date(p.date).getTime() - t0) / etendue) * (LARGEUR - MARGE.gauche - MARGE.droite);
  const y = (v) => HAUTEUR - MARGE.bas - (v / max) * (HAUTEUR - MARGE.haut - MARGE.bas);

  // Quatre repères horizontaux, pas plus : ils sont là pour situer, pas pour
  // qu'on lise une valeur exacte — les points, eux, la portent en infobulle.
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    cadre.append(
      svg("line", {
        x1: MARGE.gauche, x2: LARGEUR - MARGE.droite, y1: y(v), y2: y(v),
        class: "courbe__grille",
      }),
      Object.assign(svg("text", { x: MARGE.gauche - 8, y: y(v) + 4, class: "courbe__axe" }), {
        textContent: Math.round(v),
      })
    );
  }

  const chemin = (cle) => points.map((p, i) => `${i ? "L" : "M"}${x(p)} ${y(p[cle])}`).join(" ");

  // L'aire sous la courbe des cases : elle donne du poids au trait sans ajouter
  // de couleur, et elle dit d'un coup dans quel sens on lit.
  cadre.append(
    svg("path", {
      d: `${chemin("cases")} L${x(points[points.length - 1])} ${y(0)} L${x(points[0])} ${y(0)} Z`,
      class: "courbe__aire",
    }),
    svg("path", { d: chemin("cases"), class: "courbe__trait courbe__trait--cases" }),
    svg("path", { d: chemin("especes"), class: "courbe__trait courbe__trait--especes" })
  );

  const date = (p) => new Date(p.date).toLocaleDateString(document.documentElement.lang || "fr", {
    day: "numeric", month: "short", year: "numeric",
  });

  for (const p of points) {
    const point = svg("circle", { cx: x(p), cy: y(p.cases), r: 3.5, class: "courbe__point" });
    point.append(
      Object.assign(svg("title"), {
        textContent: `${date(p)} — ${p.cases} ${t("cases cochées")}, ${p.especes} ${t("espèces")}`,
      })
    );
    cadre.append(point);
  }

  // Les deux dates extrêmes, et elles seules : une date sous chaque point se
  // chevaucherait vingt fois.
  cadre.append(
    Object.assign(svg("text", { x: MARGE.gauche, y: HAUTEUR - 10, class: "courbe__axe" }), {
      textContent: date(points[0]),
    }),
    Object.assign(
      svg("text", { x: LARGEUR - MARGE.droite, y: HAUTEUR - 10, class: "courbe__axe", "text-anchor": "end" }),
      { textContent: date(points[points.length - 1]) }
    )
  );

  return cadre;
}

/** Ce que la courbe raconte, en une ligne de chiffres. */
function bilan(points) {
  const debut = points[0];
  const fin = points[points.length - 1];
  const jours = Math.max(
    1,
    Math.round((new Date(fin.date) - new Date(debut.date)) / 86400000)
  );
  const gagnees = fin.cases - debut.cases;
  // Le « + » n'est pas décoratif, et il ne peut pas être écrit en dur : décocher
  // plus qu'on ne coche donne un solde négatif, et le signe s'affichait alors
  // deux fois — « +-1638 ». Rare, mais un import qui remplace une collection
  // par une plus ancienne le produit d'un coup.
  const signe = gagnees > 0 ? "+" : "";

  return el(
    "div.courbe__bilan",
    el("p.courbe__gain", `${signe}${gagnees}`, el("span", ` ${t("cases cochées")}`)),
    el(
      "p.courbe__note",
      `${t("sur")} ${jours} ${tn(jours, t("jour"), t("jours"))} · ` +
        `${(gagnees / jours).toFixed(1)} ${t("par jour")}`
    )
  );
}

/** Le panneau, son bouton, et le chargement paresseux qui va avec. */
export function initCourbe(ctx) {
  const bouton = document.getElementById("courbe-btn");
  if (!bouton) return;

  // Le bouton n'apparaît que si un dépôt est joignable, et se cache si le jeton
  // est retiré : `sync` prévient à chaque changement d'état.
  const majVisibilite = () => {
    bouton.hidden = !ctx.sync.configured;
  };
  majVisibilite();
  ctx.sync.subscribe(majVisibilite);

  bouton.addEventListener("click", () => ouvrir(ctx));
}

async function ouvrir(ctx) {
  document.querySelector(".courbe-fond")?.remove();

  const corps = el("div.courbe__corps", el("p.courbe__attente", t("Lecture de l'historique…")));
  let liberer = null;

  const fermer = () => {
    document.removeEventListener("keydown", auClavier);
    fond.remove();
    if (liberer) {
      const f = liberer;
      liberer = null;
      f();
    }
  };
  const auClavier = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      fermer();
    }
  };

  const fond = el(
    "div.courbe-fond",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": t("Progression dans le temps"),
      onclick: (event) => {
        if (event.target === fond) fermer();
      },
    },
    el(
      "div.courbe-boite",
      el(
        "div.courbe__entete",
        el("h3.panel__label", t("Progression dans le temps")),
        el(
          "button.icon-btn.courbe__fermer",
          { type: "button", title: t("Fermer"), "aria-label": t("Fermer"), onclick: fermer },
          "✕"
        )
      ),
      corps
    )
  );

  document.body.append(fond);
  document.addEventListener("keydown", auClavier);
  liberer = retourFerme(fermer);

  try {
    const points = await chargerHistorique(ctx.sync, (fait, total) => {
      const attente = corps.querySelector(".courbe__attente");
      if (attente) attente.textContent = `${t("Lecture de l'historique…")} ${fait} / ${total}`;
    });

    // Le panneau a pu être refermé pendant le téléchargement : on ne remplit
    // pas un nœud qui n'est plus dans la page.
    if (!fond.isConnected) return;

    if (points.length < 2) {
      // Une courbe demande au moins deux points. Avec un seul, on ne trace pas
      // une ligne plate — on dit pourquoi il n'y a rien à voir.
      fill(corps, el("p.courbe__attente", t("Pas encore assez d'historique pour tracer une courbe.")));
      return;
    }
    fill(
      corps,
      bilan(points),
      tracer(points),
      el(
        "div.courbe__legende",
        el("span.courbe__cle.courbe__cle--cases", t("Cases cochées")),
        el("span.courbe__cle.courbe__cle--especes", t("Espèces"))
      ),
      el("p.courbe__note", t("Un point par tranche de temps, lu dans l'historique du dépôt."))
    );
  } catch (error) {
    if (!fond.isConnected) return;
    fill(corps, el("p.courbe__attente.courbe__erreur", error.message || t("Lecture impossible.")));
  }
}
