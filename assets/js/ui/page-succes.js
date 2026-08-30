/**
 * page-succes.js — les quarante-trois succès, à regarder.
 *
 * POURQUOI UNE PAGE À EUX.
 *
 * Tant qu'il y en avait cinq, ils vivaient très bien dans le menu des thèmes :
 * cinq cadenas au-dessus de cinq palettes, on comprenait tout de suite. À
 * quarante-trois, ce n'est plus tenable — trente-huit d'entre eux n'ouvrent
 * aucune palette et n'auraient rien eu à faire dans un sélecteur de couleurs.
 *
 * IL S'OUVRE COMME LES DEUX AUTRES, exprès : même bouton à bascule avec
 * `aria-expanded`, même fermeture au clic extérieur et à Échap. Trois panneaux
 * qui s'ouvriraient différemment dans la même barre, ce serait deux panneaux de
 * trop à apprendre.
 *
 * IL NE CALCULE RIEN. L'état des succès est celui que `ui/theme.js` tient déjà
 * à jour à chaque case cochée, et qu'il expose par `succesCourants()`. Le
 * recalculer ici aurait été une seconde source, capable de montrer autre chose
 * que le bandeau de déverrouillage au même instant — exactement ce que
 * `domain/succes.js` s'interdit depuis le début.
 *
 * IL NE SE REDESSINE QU'OUVERT. Cocher une case pendant qu'il est fermé ne coûte
 * rien ; l'événement le rejoue seulement s'il est à l'écran.
 */

import { el, fill } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { FAMILLES } from "../domain/succes.js";
import { iconeSvg } from "./icones-succes.js";
import { succesCourants } from "./theme.js";
import { THEMES } from "./themes-list.js";

/** La palette qu'un succès déverrouille, s'il en déverrouille une. */
const themeDe = (cle) => THEMES.find((th) => th.verrou === cle);

/** Le panneau et son bouton. */
export function initPageSucces() {
  const bouton = document.getElementById("succes-toggle");
  const panneau = document.getElementById("succes-panel");
  if (!bouton || !panneau) return;

  // Le glyphe du bouton vient d'ici, et non d'un emoji écrit dans le HTML. Un
  // 🏆 se dessine différemment sur chaque système, ne prend pas la couleur du
  // bouton, et n'aurait ressemblé à aucune des quarante-deux icônes qu'il
  // annonce. Celle-ci est la même que les autres, et se teinte comme elles.
  fill(bouton, iconeSvg("trophee", 17));

  const ouvrir = (etat) => {
    panneau.hidden = !etat;
    bouton.setAttribute("aria-expanded", String(etat));
    if (etat) {
      dessiner();
      // Le panneau garde sa position de défilement d'une ouverture à l'autre,
      // ce qui surprend : on le rouvre pour voir ce qu'on vient de gagner, et
      // il s'ouvre au milieu des chasses. On remonte.
      panneau.scrollTop = 0;
    }
  };

  function dessiner() {
    const succes = succesCourants();
    const gagnes = succes.filter((s) => s.obtenu).length;
    fill(panneau, boite(succes, gagnes));
  }

  /**
   * Le contenu, dans sa boîte centrée.
   *
   * Le panneau lui-même est le voile plein écran ; c'est cette boîte qui porte
   * le fond, la largeur et le défilement. Les deux ne peuvent pas être le même
   * élément : un voile qui défile emmènerait le fond assombri avec lui.
   */
  function boite(succes, gagnes) {

    // Regrouper par famille en UNE passe plutôt qu'un `filter` par section :
    // sept filtres sur quarante-trois entrées, c'est gratuit, mais l'ordre des
    // familles serait alors celui de `FAMILLES` et une famille oubliée dans
    // cette constante disparaîtrait sans bruit. Ici, une famille inconnue
    // atterrit à la fin plutôt que dans le vide.
    const parFamille = new Map(FAMILLES.map((nom) => [nom, []]));
    for (const s of succes) {
      const nom = s.famille || FAMILLES[0];
      if (!parFamille.has(nom)) parFamille.set(nom, []);
      parFamille.get(nom).push(s);
    }

    return el(
      "div.succes-boite",
      entete(gagnes, succes.length),
      [...parFamille].map(([nom, liste]) =>
        liste.length
          ? el(
              "section.succes__famille",
              el(
                "h4.succes__titre-famille",
                t(nom),
                el("span.succes__compte-famille", `${liste.filter((s) => s.obtenu).length} / ${liste.length}`)
              ),
              el("div.succes__liste", liste.map(carte))
            )
          : null
      )
    );
  }

  /** Le bandeau du haut : où l'on en est, en un chiffre et une barre. */
  function entete(gagnes, total) {
    const pct = total ? Math.round((gagnes / total) * 100) : 0;
    return el(
      "div.succes__entete",
      el(
        "div.succes__barre",
        el("h3.panel__label", t("Succès")),
        el(
          "button.icon-btn.succes__fermer",
          { type: "button", title: t("Fermer"), "aria-label": t("Fermer"), onclick: () => ouvrir(false) },
          "✕"
        )
      ),
      el("p.succes__score", String(gagnes), el("span", ` / ${total}`)),
      el(
        "div.succes__jauge.succes__jauge--globale",
        {
          role: "progressbar",
          "aria-valuenow": pct,
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-label": t("Succès"),
        },
        el("i", { style: { width: `${pct}%` } })
      ),
      el(
        "p.succes__note",
        t("Les succès se déduisent de la collection : rien n'est stocké, rien ne peut se perdre.")
      )
    );
  }

  /**
   * Une tuile.
   *
   * La jauge est là même sur un succès gagné, remplie à ras bord : une tuile
   * sans jauge et une tuile avec ne s'alignaient pas, et la liste sautait d'une
   * hauteur à l'autre selon ce qui était acquis.
   *
   * `--pastille` porte la couleur du thème pour les cinq qui en ouvrent un,
   * l'accent pour les autres. C'est une variable et non une classe parce que la
   * valeur vient des données, pas d'un cas prévu à l'avance.
   */
  function carte(s) {
    const theme = themeDe(s.cle);
    const pct = s.total ? Math.round((s.fait / s.total) * 100) : 0;

    return el(
      "div.succes",
      {
        dataset: { obtenu: String(s.obtenu) },
        "--pastille": (theme && theme.pastille) || "var(--accent)",
      },
      el("span.succes__icone", iconeSvg(s.icone, 26)),
      el(
        "div.succes__corps",
        el(
          "span.succes__nom",
          t(s.titre),
          // Le seul marqueur qui distingue une récompense d'une étape. Il ne
          // nomme pas la palette : la couleur est la surprise.
          theme ? el("span.succes__palette", t("Palette")) : null
        ),
        el("span.succes__resume", t(s.resume)),
        el(
          "div.succes__jauge",
          {
            role: "progressbar",
            "aria-valuenow": pct,
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-label": t(s.titre),
          },
          el("i", { style: { width: `${pct}%` } })
        )
      ),
      el(
        "span.succes__mesure",
        // Un succès gagné n'affiche pas « 1735 / 1000 » : le plafond est déjà
        // appliqué en amont, mais « 1000 / 1000 » n'apprend rien non plus. La
        // coche suffit, et elle se lit de plus loin.
        s.obtenu ? "✓" : `${s.fait} / ${s.total}`
      )
    );
  }

  bouton.addEventListener("click", (event) => {
    event.stopPropagation();
    ouvrir(panneau.hidden);
  });

  // Le voile ferme, la boîte non. Le test « en dehors du panneau » d'avant ne
  // vaut plus rien depuis que le panneau OCCUPE tout l'écran : plus aucun clic
  // n'était en dehors, et la page ne se fermait qu'à Échap.
  panneau.addEventListener("click", (event) => {
    if (event.target === panneau) ouvrir(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panneau.hidden) {
      ouvrir(false);
      bouton.focus();
    }
  });

  // Ouvert, il suit la collection en direct : cocher la case qui débloque un
  // succès le fait basculer sous les yeux.
  document.addEventListener("funkylldex:succes", () => {
    if (!panneau.hidden) dessiner();
  });
  document.addEventListener("funkylldex:langue", () => {
    if (!panneau.hidden) dessiner();
  });
}
