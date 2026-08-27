/**
 * reco.js — reconnaître les Pokémon sur une capture d'écran de Pokémon HOME.
 *
 * Portage du `tools/read_screenshots.py` qui a servi à monter la collection.
 * Même méthode, mêmes seuils : ils ont été calibrés sur cinquante cases relues
 * à la main, il aurait été absurde de les réinventer.
 *
 * Le principe. La grille de HOME a une géométrie fixe : cinq colonnes, sept
 * lignes, pas constant. On découpe chaque case, on la détoure de son fond, on
 * la réduit à une empreinte de 20 × 20, et on cherche le sprite officiel le
 * plus proche. Le meilleur score gagne — mais seulement s'il est franc.
 *
 * Ce qui rend la chose fiable, c'est la deuxième idée : **HOME range ses boîtes
 * par numéro national**. La suite des cases est donc croissante. Entre deux
 * cases sûres, une case ne peut être qu'une espèce de l'intervalle — ce qui
 * ramène 1025 candidats à une poignée, et permet d'accepter un score moyen sans
 * risque. Chaque passe ajoute des points d'appui, donc resserre les intervalles
 * de la suivante.
 *
 * Aucun accès au DOM ici : ce module reçoit des `ImageData` et rend des
 * résultats. C'est `ui/import-photos.js` qui montre, et surtout qui fait
 * relire avant d'écrire quoi que ce soit — une reconnaissance qui coche toute
 * seule une case fausse est pire que pas de reconnaissance du tout.
 */

/** Côté de l'empreinte carrée. */
export const SIG = 20;

/* ----------------------------- géométrie HOME ---------------------------- */

/**
 * La grille est DÉTECTÉE, pas codée en dur.
 *
 * L'ancien script Python portait cinq abscisses et sept ordonnées mesurées à la
 * main sur des captures 1080 × 2412. Elles ne valent que pour cet écran-là et
 * pour cette vue-là : la liste « Tous les Pokémon » n'a ni le même en-tête, ni
 * le même pas que la vue en boîtes, et un autre téléphone décalerait tout.
 *
 * On repère donc la grille dans l'image : les sprites forment cinq colonnes et
 * N lignes régulières sur un fond clair. Deux profils de projection suffisent —
 * la somme des pixels « pas du fond » par colonne, puis par ligne — et les
 * creux entre les paquets donnent les frontières.
 *
 * C'est plus de code, mais c'est ce qui rend la lecture indépendante du
 * téléphone, de la vue et de la barre d'état.
 */

const SEUIL_FOND = 85; // écart au fond au-delà duquel c'est un sprite
const MIN_PIXELS = 260; // en dessous, la case est vide

/**
 * Deux niveaux d'exigence, calibrés sur cinquante cases relues à la main :
 * sous STRICT, aucune erreur observée ; au-delà de RELACHE, elles deviennent
 * fréquentes.
 */
const STRICT = 6.0;
const RELACHE = 13.0;
const RELACHE_ETROIT = 20.0;
const LARGEUR_ETROITE = 8;
const PASSES = 6;

/* ------------------------------- empreintes ------------------------------ */

/**
 * Empreinte d'une image détourée par son canal alpha — c'est le cas des sprites
 * de référence, qui arrivent sur fond transparent.
 */
export function signatureDepuisImageData(imageData, seuilAlpha = 140) {
  const { data, width, height } = imageData;
  const masque = new Uint8Array(width * height);
  let n = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] > seuilAlpha) {
      masque[p] = 1;
      n++;
    }
  }
  if (n < 40) return null;
  return empaqueter(data, width, height, masque);
}

/**
 * Recadre sur le contenu, met à l'échelle en gardant les proportions, et rend
 * un vecteur d'octets : trois canaux de couleur, plus la silhouette.
 *
 * Le fond est neutralisé en gris moyen : deux sprites ne diffèrent alors que
 * par leur silhouette et leurs couleurs propres. Et la silhouette compte comme
 * une quatrième composante — c'est elle qui sépare un Roucool d'un Roucoups.
 */
function empaqueter(rgba, width, height, masque) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!masque[y * width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;

  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const echelle = SIG / Math.max(cw, ch);
  const nw = Math.max(1, Math.round(cw * echelle));
  const nh = Math.max(1, Math.round(ch * echelle));
  const ox = (SIG - nw) >> 1;
  const oy = (SIG - nh) >> 1;

  const sortie = new Uint8Array(SIG * SIG * 4);
  sortie.fill(128); // gris moyen partout, silhouette comprise…
  for (let i = 3; i < sortie.length; i += 4) sortie[i] = 0; // …sauf la silhouette

  // Rééchantillonnage par moyenne de boîte : à ces tailles-là, prendre le pixel
  // le plus proche perdrait les pattes et les antennes, qui sont précisément ce
  // qui distingue deux sprites voisins.
  for (let j = 0; j < nh; j++) {
    const sy0 = y0 + Math.floor((j * ch) / nh);
    const sy1 = Math.max(sy0 + 1, y0 + Math.floor(((j + 1) * ch) / nh));
    for (let i = 0; i < nw; i++) {
      const sx0 = x0 + Math.floor((i * cw) / nw);
      const sx1 = Math.max(sx0 + 1, x0 + Math.floor(((i + 1) * cw) / nw));
      let r = 0;
      let v = 0;
      let b = 0;
      let m = 0;
      let compte = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const p = sy * width + sx;
          const q = p * 4;
          const dedans = masque[p];
          r += dedans ? rgba[q] : 128;
          v += dedans ? rgba[q + 1] : 128;
          b += dedans ? rgba[q + 2] : 128;
          m += dedans ? 255 : 0;
          compte++;
        }
      }
      const k = ((oy + j) * SIG + (ox + i)) * 4;
      sortie[k] = r / compte;
      sortie[k + 1] = v / compte;
      sortie[k + 2] = b / compte;
      sortie[k + 3] = m / compte;
    }
  }
  return sortie;
}

/* ----------------------------- découpe des cases ------------------------- */

/**
 * Couleur de fond, ligne par ligne : la médiane, le fond étant majoritaire.
 * Un fond dégradé — celui de HOME l'est — se soustrait ainsi correctement sur
 * toute la hauteur de l'écran.
 */
function profilDuFond(rgba, width, height) {
  const profil = new Float32Array(height * 3);
  const echantillon = [];
  for (let y = 0; y < height; y++) {
    for (let c = 0; c < 3; c++) {
      echantillon.length = 0;
      for (let x = 0; x < width; x += 6) echantillon.push(rgba[(y * width + x) * 4 + c]);
      echantillon.sort((a, b) => a - b);
      profil[y * 3 + c] = echantillon[echantillon.length >> 1];
    }
  }
  return profil;
}

/** Érosion ou dilatation carrée, séparée en deux passes 1D. */
function morpho(masque, w, h, rayon, dilater) {
  const tampon = new Uint8Array(w * h);
  const sortie = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = dilater ? 0 : 1;
      for (let d = -rayon; d <= rayon; d++) {
        const xx = x + d;
        const v = xx < 0 || xx >= w ? 0 : masque[y * w + xx];
        acc = dilater ? acc | v : acc & v;
      }
      tampon[y * w + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = dilater ? 0 : 1;
      for (let d = -rayon; d <= rayon; d++) {
        const yy = y + d;
        const v = yy < 0 || yy >= h ? 0 : tampon[yy * w + x];
        acc = dilater ? acc | v : acc & v;
      }
      sortie[y * w + x] = acc;
    }
  }
  return sortie;
}

/**
 * Empreinte d'une case, ou null si elle est vide.
 *
 * Le fond de HOME n'est pas uni : un motif de toile d'araignée le barre de
 * traits blancs épais qui franchissent n'importe quel seuil de différence.
 * D'où deux passes :
 *
 *   1. masque « chromatique » — on écarte les pixels qui ne font qu'éclaircir
 *      le fond sans le colorer, c'est la signature d'un trait de la toile.
 *      Après ouverture morphologique il ne reste que le sprite : il donne le
 *      cadre utile.
 *   2. masque complet — à l'intérieur de ce cadre seulement, on reprend tous
 *      les pixels qui diffèrent du fond, y compris les parties blanches du
 *      sprite (ailes de Papilusion, dards de Dardargnan) que la passe 1 rejette.
 */
function signatureDeCase(rgba, width, profil, cx, cy, g) {
  const x0 = cx - g.demiL;
  const y0 = cy - g.haut;
  const w = g.demiL * 2;
  const h = g.haut + g.bas;

  const patch = new Uint8ClampedArray(w * h * 4);
  const plein = new Uint8Array(w * h);
  const toile = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    const fr = profil[(y0 + y) * 3];
    const fv = profil[(y0 + y) * 3 + 1];
    const fb = profil[(y0 + y) * 3 + 2];
    for (let x = 0; x < w; x++) {
      const src = ((y0 + y) * width + (x0 + x)) * 4;
      const dst = (y * w + x) * 4;
      const r = rgba[src];
      const v = rgba[src + 1];
      const b = rgba[src + 2];
      patch[dst] = r;
      patch[dst + 1] = v;
      patch[dst + 2] = b;
      patch[dst + 3] = 255;

      const dr = r - fr;
      const dv = v - fv;
      const db = b - fb;
      const force = Math.abs(dr) + Math.abs(dv) + Math.abs(db);
      const p = y * w + x;
      plein[p] = force > SEUIL_FOND ? 1 : 0;
      const plusClair = dr > 0 && dv > 0 && db > 0;
      const etendue = Math.max(dr, dv, db) - Math.min(dr, dv, db);
      toile[p] = plusClair && etendue < 30 ? 1 : 0;
    }
  }

  const sansToile = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) sansToile[p] = plein[p] && !toile[p] ? 1 : 0;

  let solide = morpho(morpho(sansToile, w, h, 3, false), w, h, 3, true);
  if (somme(solide) < MIN_PIXELS) solide = morpho(morpho(plein, w, h, 3, false), w, h, 3, true);
  if (somme(solide) < MIN_PIXELS) return null;

  let rx0 = w;
  let ry0 = h;
  let rx1 = -1;
  let ry1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solide[y * w + x]) continue;
      if (x < rx0) rx0 = x;
      if (x > rx1) rx1 = x;
      if (y < ry0) ry0 = y;
      if (y > ry1) ry1 = y;
    }
  }
  if (rx1 < 0) return null;

  const marge = 7;
  const fx0 = Math.max(0, rx0 - marge);
  const fx1 = Math.min(w - 1, rx1 + marge);
  const fy0 = Math.max(0, ry0 - marge);
  const fy1 = Math.min(h - 1, ry1 + marge);

  const masque = new Uint8Array(w * h);
  let n = 0;
  for (let y = fy0; y <= fy1; y++) {
    for (let x = fx0; x <= fx1; x++) {
      const p = y * w + x;
      if (plein[p]) {
        masque[p] = 1;
        n++;
      }
    }
  }
  if (n < MIN_PIXELS) return null;
  return empaqueter(patch, w, h, masque);
}

const somme = (a) => {
  let n = 0;
  for (let i = 0; i < a.length; i++) n += a[i];
  return n;
};

/**
 * Paquets d'un profil de projection : les intervalles où il dépasse un seuil.
 * Les petits creux sont comblés — une patte fine peut faire retomber le profil
 * à zéro au milieu d'un sprite.
 */
function paquets(profil, seuil, creuxTolere) {
  const groupes = [];
  let debut = -1;
  let creux = 0;
  for (let i = 0; i < profil.length; i++) {
    if (profil[i] > seuil) {
      if (debut < 0) debut = i;
      creux = 0;
    } else if (debut >= 0) {
      creux += 1;
      if (creux > creuxTolere) {
        groupes.push([debut, i - creux]);
        debut = -1;
      }
    }
  }
  if (debut >= 0) groupes.push([debut, profil.length - 1]);
  return groupes;
}

/**
 * Repère la grille : les centres des colonnes, ceux des lignes, et la taille
 * d'une case.
 *
 * @returns {{colonnes:number[], lignes:number[], demiL:number, haut:number, bas:number}|null}
 */
export function detecterGrille(imageData) {
  const { data, width, height } = imageData;
  const profil = profilDuFond(data, width, height);

  // Masque « c'est un sprite » : différent du fond, et pas un simple
  // éclaircissement neutre — le fond de HOME est barré d'un motif de traits
  // clairs qui franchit n'importe quel seuil de différence.
  const avant = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const fr = profil[y * 3];
    const fv = profil[y * 3 + 1];
    const fb = profil[y * 3 + 2];
    for (let x = 0; x < width; x++) {
      const q = (y * width + x) * 4;
      const dr = data[q] - fr;
      const dv = data[q + 1] - fv;
      const db = data[q + 2] - fb;
      const force = Math.abs(dr) + Math.abs(dv) + Math.abs(db);
      const plusClair = dr > 0 && dv > 0 && db > 0;
      const etendue = Math.max(dr, dv, db) - Math.min(dr, dv, db);
      avant[y * width + x] = force > SEUIL_FOND && !(plusClair && etendue < 30) ? 1 : 0;
    }
  }

  // L'en-tête de HOME — onglets, compteur, bouton « Recherche » — est plein de
  // contrastes qui n'ont rien de sprites. On part du tiers supérieur : la
  // grille commence toujours plus bas.
  const yDebut = Math.round(height * 0.22);

  const profilX = new Float64Array(width);
  for (let y = yDebut; y < height; y++) {
    for (let x = 0; x < width; x++) profilX[x] += avant[y * width + x];
  }
  const maxX = Math.max(...profilX);
  const colonnes = paquets(profilX, maxX * 0.12, Math.round(width * 0.02))
    .filter(([a, b]) => b - a > width * 0.04)
    .map(([a, b]) => Math.round((a + b) / 2));
  if (colonnes.length < 3) return null;

  // Le pas des colonnes donne l'échelle de la grille, donc la taille d'une
  // case. C'est plus sûr que la largeur d'un paquet : un sprite étroit
  // (Abo, Aspicot) ne remplit pas sa case.
  const pasX =
    colonnes.length > 1
      ? (colonnes[colonnes.length - 1] - colonnes[0]) / (colonnes.length - 1)
      : width / 5;

  const profilY = new Float64Array(height);
  for (let y = yDebut; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) n += avant[y * width + x];
    profilY[y] = n;
  }
  const maxY = Math.max(...profilY);
  const lignesBrutes = paquets(profilY, maxY * 0.1, Math.round(pasX * 0.12)).filter(
    ([a, b]) => b - a > pasX * 0.25
  );
  if (!lignesBrutes.length) return null;

  // Une ligne coupée par le bord de l'écran donnerait un sprite tronqué, donc
  // une reconnaissance fausse — et, pire, une fausse ancre pour ses voisines.
  // Les captures se chevauchent, ces cases reviennent dans la suivante.
  const lignes = lignesBrutes
    .filter(([a, b]) => a > yDebut + 2 && b < height - 3)
    .map(([a, b]) => Math.round((a + b) / 2));
  if (!lignes.length) return null;

  return {
    colonnes,
    lignes,
    demiL: Math.round(pasX * 0.48),
    haut: Math.round(pasX * 0.42),
    bas: Math.round(pasX * 0.48),
  };
}

/**
 * Les cases d'une capture, dans l'ordre de lecture.
 *
 * Les deux boutons flottants de HOME — le menu vert au centre, le tri « N° » à
 * droite — recouvrent des cases de la dernière ligne. On les écarte : une case
 * a moitié cachée donne une reconnaissance aberrante, qui servirait ensuite
 * d'appui aux passes suivantes et fausserait ses voisines.
 */
export function lireCases(imageData, grille) {
  const { data, width, height } = imageData;
  const g = grille || detecterGrille(imageData);
  if (!g) return [];
  const profil = profilDuFond(data, width, height);

  const cases = [];
  for (let r = 0; r < g.lignes.length; r++) {
    const cy = g.lignes[r];
    for (let c = 0; c < g.colonnes.length; c++) {
      const cx = g.colonnes[c];
      if (cx - g.demiL < 0 || cx + g.demiL >= width) continue;
      if (cy - g.haut < 0 || cy + g.bas >= height) continue;
      if (sousUnBouton(data, width, cx, cy, g)) continue;
      cases.push({ ligne: r, colonne: c, vecteur: signatureDeCase(data, width, profil, cx, cy, g) });
    }
  }
  return cases;
}

/**
 * La case est-elle recouverte par un bouton flottant ?
 *
 * Les deux boutons sont des disques d'une couleur franche et uniforme — vert
 * saturé pour le menu, blanc pur cerclé de turquoise pour le tri. On regarde
 * la couleur au centre exact de la case : un sprite n'y est presque jamais
 * uniforme sur un carré de vingt pixels.
 */
function sousUnBouton(data, width, cx, cy, g) {
  const rayon = Math.max(6, Math.round(g.demiL * 0.12));
  let n = 0;
  let vert = 0;
  let blanc = 0;
  for (let y = cy - rayon; y <= cy + rayon; y += 2) {
    for (let x = cx - rayon; x <= cx + rayon; x += 2) {
      const q = (y * width + x) * 4;
      const r = data[q];
      const v = data[q + 1];
      const b = data[q + 2];
      n += 1;
      if (v > 110 && v < 200 && r < v - 55 && b < v - 55) vert += 1;
      if (r > 245 && v > 245 && b > 245) blanc += 1;
    }
  }
  return n > 0 && (vert / n > 0.85 || blanc / n > 0.85);
}

/* -------------------------------- appariement ---------------------------- */

/** Distance moyenne entre deux empreintes, ramenée sur 100 comme en Python. */
function distance(refs, offset, taille, vecteur) {
  let total = 0;
  for (let i = 0; i < taille; i++) total += Math.abs(refs[offset + i] - vecteur[i]);
  return (total / taille / 255) * 100;
}

function plusProche(banque, vecteur, garder) {
  const { octets, taille, especes } = banque;
  let meilleur = -1;
  let score = Infinity;
  for (let i = 0; i < especes.length; i++) {
    if (garder && !garder(i)) continue;
    const d = distance(octets, i * taille, taille, vecteur);
    if (d < score) {
      score = d;
      meilleur = i;
    }
  }
  return meilleur < 0 ? null : { index: meilleur, score };
}

/**
 * Plus longue sous-suite croissante (au sens large) : filet de sécurité contre
 * la reconnaissance isolée qui casse l'ordre du dex. Elle est forcément fausse,
 * quel que soit son score.
 */
function plusLongueCroissante(paires) {
  const queues = [];
  const indexQueue = [];
  const precedent = new Map();
  for (const [index, valeur] of paires) {
    let lo = 0;
    let hi = queues.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (queues[mid] <= valeur) lo = mid + 1;
      else hi = mid;
    }
    if (lo === queues.length) {
      queues.push(valeur);
      indexQueue.push(index);
    } else {
      queues[lo] = valeur;
      indexQueue[lo] = index;
    }
    precedent.set(index, lo ? indexQueue[lo - 1] : null);
  }
  const gardes = new Set();
  let noeud = indexQueue.length ? indexQueue[indexQueue.length - 1] : null;
  while (noeud !== null && noeud !== undefined) {
    gardes.add(noeud);
    noeud = precedent.get(noeud);
  }
  return gardes;
}

function imposerOrdre(cases, banque) {
  const paires = [];
  cases.forEach((c, i) => {
    if (c.retenue && c.index >= 0) paires.push([i, banque.especes[c.index]]);
  });
  const gardes = plusLongueCroissante(paires);
  let jetees = 0;
  cases.forEach((c, i) => {
    if (c.retenue && !gardes.has(i)) {
      c.retenue = false;
      c.motif = "ordre";
      jetees += 1;
    }
  });
  return jetees;
}

/** Numéro de la case sûre la plus proche, avant ou après. */
function encadrer(cases, banque, versLAvant) {
  const bornes = new Array(cases.length);
  let vu = versLAvant ? 1 : 1025;
  const indices = versLAvant
    ? cases.map((_, i) => i)
    : cases.map((_, i) => cases.length - 1 - i);
  for (const i of indices) {
    bornes[i] = vu;
    if (cases[i].retenue && cases[i].index >= 0) vu = banque.especes[cases[i].index];
  }
  return bornes;
}

/**
 * Reconnaît les cases de plusieurs captures d'un coup.
 *
 * Les captures doivent être données dans l'ordre où elles ont été prises :
 * c'est de cet ordre que vient la contrainte du dex croissant, et c'est elle
 * qui fait toute la fiabilité de la méthode.
 *
 * @param {Array<Array>} parCapture  les cases rendues par `lireCases`
 * @param {{octets: Uint8Array, taille: number, especes: Int32Array, shiny: Uint8Array, sprites: Int32Array}} banque
 * @returns {Array} une entrée par case, avec son verdict
 */
export function reconnaitre(parCapture, banque) {
  const cases = [];
  parCapture.forEach((lot, capture) => {
    for (const c of lot) cases.push({ ...c, capture, index: -1, score: Infinity, retenue: false });
  });

  // 1re passe : recherche libre sur tout le référentiel. Seuls les scores très
  // bas sont retenus — à ce niveau d'exigence, la reconnaissance ne se trompe
  // pas, et ces cases deviennent les ancres de la suite.
  for (const c of cases) {
    if (!c.vecteur) {
      c.motif = "vide";
      continue;
    }
    const m = plusProche(banque, c.vecteur, null);
    if (!m) continue;
    c.index = m.index;
    c.score = m.score;
    c.retenue = m.score <= STRICT;
    if (!c.retenue) c.motif = "score";
  }
  imposerOrdre(cases, banque);

  // Passes suivantes : entre deux ancres, une case ne peut être qu'une espèce
  // de l'intervalle. Chaque tour ajoute des appuis, donc resserre le suivant.
  for (let tour = 0; tour < PASSES; tour++) {
    const bas = encadrer(cases, banque, true);
    const haut = encadrer(cases, banque, false);
    let recuperees = 0;
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      if (!c.vecteur || c.retenue) continue;
      const lo = bas[i];
      const hi = haut[i];
      const m = plusProche(banque, c.vecteur, (k) => banque.especes[k] >= lo && banque.especes[k] <= hi);
      if (!m) continue;
      c.index = m.index;
      c.score = m.score;
      // Plus l'intervalle est étroit, plus on peut être indulgent : avec cinq
      // candidats possibles, un score moyen reste concluant.
      const largeur = hi - lo + 1;
      const limite = largeur > LARGEUR_ETROITE ? RELACHE : RELACHE_ETROIT;
      if (m.score > limite) {
        c.motif = "score";
        continue;
      }
      c.retenue = true;
      c.fenetre = [lo, hi];
      recuperees += 1;
    }
    imposerOrdre(cases, banque);
    if (!recuperees) break;
  }

  return cases.map((c) => ({
    capture: c.capture,
    ligne: c.ligne,
    colonne: c.colonne,
    vide: !c.vecteur,
    retenue: c.retenue,
    motif: c.motif || null,
    score: c.score === Infinity ? null : Math.round(c.score * 10) / 10,
    espece: c.index >= 0 ? banque.especes[c.index] : null,
    shiny: c.index >= 0 ? Boolean(banque.shiny[c.index]) : false,
    sprite: c.index >= 0 ? banque.sprites[c.index] : null,
  }));
}
