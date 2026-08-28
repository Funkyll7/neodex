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
const SEUIL_SPRITE = 150; // le même, mesuré par `ecartAuFond`, pour le découpage
/**
 * En dessous de tant de pixels retenus, la case est declaree vide.
 *
 * Le seuil est une FRACTION de la case, pas un nombre fixe. Un nombre fixe
 * change de sens avec la taille de l'image : 260 pixels valent 0,9 % d'une case
 * sur une capture 1080, mais 1,5 % sur une video reduite a 858 — le meme sprite
 * y devenait « non lu ». Il change de sens aussi d'une VUE a l'autre : dans la
 * liste « Tous les Pokemon », les sprites occupent un tiers de leur case la ou
 * ils la remplissent en vue boites.
 *
 * Le plancher garde un garde-fou absolu : une poignee de pixels ne fait pas un
 * sprite, quelle que soit la resolution.
 */
const PART_MIN = 0.009; // 0,9 % de la case, la valeur calibree en 1080
const PLANCHER_PIXELS = 90;

const minPixels = (aire) => Math.max(PLANCHER_PIXELS, Math.round(aire * PART_MIN));

/**
 * De combien ce pixel s'écarte-t-il du fond ?
 *
 * La somme des écarts par canal ne suffit pas, et Papilusion le prouve. Un pixel
 * de son aile vaut (230, 234, 233) ; le fond de HOME vaut (187, 240, 225). Le
 * rouge bondit de 43, mais le vert perd 6 et le bleu gagne 8 : la somme fait 57,
 * sous n'importe quel seuil utile. Les ailes étaient effacées avant comparaison,
 * et Papilusion marquait 18 sur sa propre référence.
 *
 * Le fond de HOME est déjà très clair — 240 sur le vert. Un sprite pâle ne peut
 * donc s'en écarter que par un seul canal, et la somme le noie. Mais ce qui les
 * sépare vraiment saute aux yeux : le fond est VERT, l'aile est NEUTRE. On
 * mesure donc aussi les écarts ENTRE canaux, qui portent ce changement de
 * teinte. L'aile passe alors de 57 à 155, quand du vrai fond reste à 13.
 *
 * Cela vaut pour tout sprite pâle sur ce fond — Dardargnan, Melofée, Leveinard —
 * pas seulement pour Papilusion.
 */
function ecartAuFond(dr, dv, db) {
  return (
    Math.abs(dr) +
    Math.abs(dv) +
    Math.abs(db) +
    Math.abs(dr - dv) +
    Math.abs(dv - db) +
    Math.abs(dr - db)
  );
}

/**
 * Trois niveaux d'exigence.
 *
 * Le script Python employait 6 / 13 / 20, calibrés sur cinquante cases relues à
 * la main — mais avec une empreinte de 28 px de côté. Ici elle fait 20 : chaque
 * valeur moyenne davantage de pixels, les distances se resserrent, et les mêmes
 * seuils laissent donc passer plus de choses. Mesuré sur une grille de trente
 * cases connues, les trois seules erreurs étaient à 12,3, 15,1 et 19,1 — toutes
 * des confusions entre voisins immédiats du dex, Chenipan et Chrysacier.
 *
 * On resserre donc. Le compromis n'est pas symétrique : une case manquée coûte
 * un appui, une case fausse entre dans une collection synchronisée sans qu'on
 * la voie. Dans le doute, on refuse.
 */
const STRICT = 6.0;
const RELACHE = 10.0;
const RELACHE_ETROIT = 13.0;
const LARGEUR_ETROITE = 8;
const PASSES = 6;

/**
 * Écart minimal au premier rival portant une autre réponse.
 *
 * Un score absolu dit mal la confiance : 10 est bon sur une capture nette,
 * mauvais sur une capture compressée. Ce qui la dit, c'est de combien le
 * gagnant devance son premier vrai concurrent.
 *
 * Mesuré sur la capture 1, relue case par case : les 24 réponses justes ont une
 * marge de 1,0 à 7,2, médiane 3,4 ; les 9 fausses vont de 0 à 1,6, médiane 0,2.
 * Les quatre erreurs qui passaient les seuils de score avaient des marges de
 * 0 / 0,1 / 0,1 / 0,2 — trois d'entre elles étaient des confusions entre le
 * Florizarre normal et son chromatique, que le score seul ne pouvait pas
 * départager.
 *
 * À 1,0 la coupure retire ces quatre erreurs sans perdre une bonne réponse.
 */
const MARGE_MIN = 1.0;

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
  // Le meme bouchage que sur les captures, et pour la meme raison : il faut
  // que les deux cotes de la comparaison decrivent la silhouette de la meme
  // maniere. Boucher d'un seul cote coutait cher — Florizarre, dont les
  // petales laissent de vrais trous, passait de 2,3 a 9,6.
  boucherTrous(masque, width, height);
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
 * Ce pixel n'est-il qu'un trait du motif de fond ?
 *
 * Le fond de HOME est barré d'une toile d'araignée de traits clairs, qui
 * franchit n'importe quel seuil de différence et qu'il faut donc écarter
 * autrement. Un trait, c'est du blanc posé par transparence sur le fond :
 * `resultat = fond + a × (255 − fond)`. Le rapport `delta / (255 − fond)` vaut
 * donc `a` sur les TROIS canaux — c'est cette égalité qui signe un
 * éclaircissement, et rien d'autre.
 *
 * L'ancien test comparait l'écart brut entre canaux à 30. Il marchait sur un
 * fond presque gris et se trompait dès que le fond était coloré : sur le vert
 * de HOME, du blanc à 85 % fait bondir le bleu de 56 et le vert de 5, un écart
 * de 51 — le trait passait pour un sprite, et la grille ne se détectait plus.
 * Le rapport, lui, ne dépend pas de la couleur du fond.
 */
function estUnTraitDuFond(dr, dv, db, fr, fv, fb) {
  if (dr <= 0 || dv <= 0 || db <= 0) return false;
  const mr = 255 - fr;
  const mv = 255 - fv;
  const mb = 255 - fb;
  // Un fond déjà saturé sur un canal ne dit rien de l'alpha : on s'abstient.
  if (mr < 12 || mv < 12 || mb < 12) return false;
  const ar = dr / mr;
  const av = dv / mv;
  const ab = db / mb;
  return Math.max(ar, av, ab) - Math.min(ar, av, ab) < 0.12;
}

/**
 * Couleur de fond, ligne par ligne : la médiane, le fond étant majoritaire.
 * Un fond dégradé — celui de HOME l'est — se soustrait ainsi correctement sur
 * toute la hauteur de l'écran.
 */
function profilDuFond(rgba, width, height) {
  const profil = new Float32Array(height * 3);
  // Médiane par comptage plutôt que par tri. Un canal ne prend que 256 valeurs :
  // les compter puis avancer jusqu'au rang du milieu donne EXACTEMENT la même
  // médiane, en un passage au lieu d'un tri. Il y avait 7 236 tris à faire sur
  // une capture 1080 × 2412 — trois par ligne de pixels.
  const compte = new Int32Array(256);
  for (let y = 0; y < height; y++) {
    for (let c = 0; c < 3; c++) {
      compte.fill(0);
      let n = 0;
      for (let x = 0; x < width; x += 6) {
        compte[rgba[(y * width + x) * 4 + c]] += 1;
        n += 1;
      }
      const rang = n >> 1;
      let vus = 0;
      let v = 0;
      for (; v < 256; v++) {
        vus += compte[v];
        if (vus > rang) break;
      }
      profil[y * 3 + c] = v;
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
      const force = ecartAuFond(dr, dv, db);
      const p = y * w + x;
      plein[p] = force > SEUIL_SPRITE ? 1 : 0;
      toile[p] = estUnTraitDuFond(dr, dv, db, fr, fv, fb) ? 1 : 0;
    }
  }

  // Une aile de Papilusion passe le test du trait de fond, et pour une bonne
  // raison : elle est blanche, et du blanc sur ce fond EST un éclaircissement.
  // Le test ne peut pas les distinguer, il ne regarde qu'un pixel.
  //
  // Ce qui les sépare est ailleurs, et c'est le même critère que pour les
  // perforations et les ajours : l'épaisseur. Un trait de toile est fin, une
  // aile est large. On rend donc au sprite tout ce que ce masque a de gros.
  //
  // Sans cela, Papilusion marquait 17 à 20 sur sa PROPRE référence, là où un
  // Chrysacier tombe à 1,2 : ses ailes étaient effacées avant comparaison.
  const toileEpaisse = morpho(morpho(toile, w, h, 3, false), w, h, 3, true);
  const sansToile = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    sansToile[p] = plein[p] && (!toile[p] || toileEpaisse[p]) ? 1 : 0;
  }

  // Le seuil de vide se mesure sur CETTE case, pas dans l'absolu.
  const seuilVide = minPixels(w * h);

  let solide = morpho(morpho(sansToile, w, h, 3, false), w, h, 3, true);
  if (somme(solide) < seuilVide) solide = morpho(morpho(plein, w, h, 3, false), w, h, 3, true);
  if (somme(solide) < seuilVide) return null;

  // La toile ne fait pas que salir le fond : la ou elle passe sur le sprite,
  // elle le coupe en deux. Prendre bêtement la plus grosse tache donnait alors
  // le ventre de Carabaffe tout seul, et l'empreinte devenait un gros plan
  // orange. On raccorde d'abord les morceaux voisins, on choisit ensuite.
  const ponte = composantePrincipale(morpho(solide, w, h, 5, true), w, h);
  if (!ponte) return null;
  for (let p = 0; p < w * h; p++) if (!ponte[p]) solide[p] = 0;
  if (somme(solide) < seuilVide) return null;

  // Reste le cas inverse : les parties blanches du sprite, que la passe 1 a
  // jetees en les prenant pour de la toile. Les ailes de Papilusion en sont
  // faites, et un cadre pose sur `solide` seul les coupe — Papilusion tombait
  // a 18,4 sur sa propre reference, derriere un Aspicot a 13.
  //
  // Ce qui separe une aile d'un trait de toile n'est pas la couleur, c'est
  // l'epaisseur. On repart donc de `plein` debarrasse de ses structures fines,
  // et on ne garde que ce qui tient au sprite. Laisser `plein` brut decider du
  // cadre coutait bien plus cher : un trait qui frole le sprite lui reste
  // connecte, etire la boite jusqu'au bord de la case, et le sprite finit
  // ecrase en diagonale dans un coin de l'empreinte — Bulbizarre marquait
  // alors 14 et ressortait en Arbok.
  const epais = morpho(morpho(plein, w, h, 2, false), w, h, 2, true);
  for (let p = 0; p < w * h; p++) if (solide[p]) epais[p] = 1;
  const etendu = composanteDe(epais, solide, w, h) || solide;

  let rx0 = w;
  let ry0 = h;
  let rx1 = -1;
  let ry1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!etendu[y * w + x]) continue;
      if (x < rx0) rx0 = x;
      if (x > rx1) rx1 = x;
      if (y < ry0) ry0 = y;
      if (y > ry1) ry1 = y;
    }
  }

  // Quelques pixels de jeu : un contour clair du sprite deborde du cadre
  // solide, mais pas de quoi laisser la toile traverser la case.
  const marge = 4;
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
  if (n < seuilVide) return null;
  boucherTrous(masque, w, h);
  return empaqueter(patch, w, h, masque);
}

/**
 * Rebouche les perforations fines de la silhouette — et elles seules.
 *
 * Un trait de la toile qui passe sur le sprite l'eclaircit vers la couleur du
 * fond : ces pixels-la retombent sous le seuil de difference et perforent la
 * silhouette. Bulbizarre en ressortait strie de noir la ou la reference est
 * pleine — couleur juste, silhouette a 72 sur 255.
 *
 * Mais tout boucher coute plus que ca ne rapporte : Florizarre, dont les
 * petales laissent de vrais ajours, passait alors de 2,3 a 9,6. Ces ajours-la
 * existent aussi dans la reference, il faut les garder.
 *
 * Ce qui separe les deux n'est pas la taille mais l'epaisseur : une rayure de
 * toile est fine, un ajour entre deux petales est large. On ne bouche donc que
 * les trous qui ne survivent pas a une erosion — l'ouverture morphologique
 * repond exactement a cette question.
 */
function boucherTrous(masque, w, h) {
  const dehors = new Uint8Array(w * h);
  const file = new Int32Array(w * h);
  let queue = 0;
  const pousser = (p) => {
    if (!masque[p] && !dehors[p]) {
      dehors[p] = 1;
      file[queue++] = p;
    }
  };
  for (let x = 0; x < w; x++) pousser(x), pousser((h - 1) * w + x);
  for (let y = 0; y < h; y++) pousser(y * w), pousser(y * w + w - 1);

  let tete = 0;
  while (tete < queue) {
    const p = file[tete++];
    const x = p % w;
    if (x > 0) pousser(p - 1);
    if (x < w - 1) pousser(p + 1);
    if (p >= w) pousser(p - w);
    if (p < w * (h - 1)) pousser(p + w);
  }

  const trous = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (!masque[p] && !dehors[p]) trous[p] = 1;

  const larges = morpho(morpho(trous, w, h, 2, false), w, h, 2, true);
  for (let p = 0; p < w * h; p++) if (trous[p] && !larges[p]) masque[p] = 1;
}

/**
 * Les taches du masque qui touchent au moins une graine.
 *
 * Sert a etendre le sprite a ses parties claires sans ramasser la toile : les
 * graines sont le sprite deja sur, le masque est ce qui pourrait lui
 * appartenir, et seul ce qui tient a lui est retenu.
 */
function composanteDe(masque, graines, w, h) {
  const vu = new Uint8Array(w * h);
  const file = new Int32Array(w * h);
  let tete = 0;
  let queue = 0;
  for (let p = 0; p < w * h; p++) {
    if (graines[p] && masque[p] && !vu[p]) {
      vu[p] = 1;
      file[queue++] = p;
    }
  }
  if (!queue) return null;

  while (tete < queue) {
    const p = file[tete++];
    const x = p % w;
    if (x > 0 && masque[p - 1] && !vu[p - 1]) file[queue++] = p - 1, (vu[p - 1] = 1);
    if (x < w - 1 && masque[p + 1] && !vu[p + 1]) file[queue++] = p + 1, (vu[p + 1] = 1);
    if (p >= w && masque[p - w] && !vu[p - w]) file[queue++] = p - w, (vu[p - w] = 1);
    if (p < w * (h - 1) && masque[p + w] && !vu[p + w]) file[queue++] = p + w, (vu[p + w] = 1);
  }
  return vu;
}

/**
 * Ne garde que la plus grosse tache du masque.
 *
 * Une case de HOME ne contient pas que le sprite : une etoile decore le coin
 * haut-droit des chromatiques, la toile du fond laisse des miettes que
 * l'ouverture n'a pas mangees, et le voisin mord parfois le bord. Tout cela
 * entrait dans le cadre utile — et un cadre trop large ecrase le sprite dans
 * un coin de l'empreinte 20x20, ou il ne ressemble plus a rien. Un Bulbizarre
 * parfaitement cadre marquait 20 pour cette seule raison : son etoile.
 *
 * Le sprite est, de loin, la plus grosse tache connexe de la case.
 */
function composantePrincipale(masque, w, h) {
  const vu = new Uint8Array(w * h);
  const file = new Int32Array(w * h);
  const meilleurs = new Int32Array(w * h);
  let tailleMax = 0;

  for (let depart = 0; depart < w * h; depart++) {
    if (!masque[depart] || vu[depart]) continue;
    let tete = 0;
    let queue = 0;
    file[queue++] = depart;
    vu[depart] = 1;
    while (tete < queue) {
      const p = file[tete++];
      const x = p % w;
      // 4-connexite : en 8-connexite, un seul pixel de toile en diagonale
      // recolle l'etoile au sprite et le tri ne sert plus a rien.
      if (x > 0 && masque[p - 1] && !vu[p - 1]) file[queue++] = p - 1, (vu[p - 1] = 1);
      if (x < w - 1 && masque[p + 1] && !vu[p + 1]) file[queue++] = p + 1, (vu[p + 1] = 1);
      if (p >= w && masque[p - w] && !vu[p - w]) file[queue++] = p - w, (vu[p - w] = 1);
      if (p < w * (h - 1) && masque[p + w] && !vu[p + w]) file[queue++] = p + w, (vu[p + w] = 1);
    }
    if (queue > tailleMax) {
      tailleMax = queue;
      meilleurs.set(file.subarray(0, queue));
    }
  }

  if (!tailleMax) return null;
  const sortie = new Uint8Array(w * h);
  for (let i = 0; i < tailleMax; i++) sortie[meilleurs[i]] = 1;
  return sortie;
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
  let dernier = -1;
  let creux = 0;
  for (let i = 0; i < profil.length; i++) {
    if (profil[i] > seuil) {
      if (debut < 0) debut = i;
      dernier = i;
      creux = 0;
    } else if (debut >= 0) {
      creux += 1;
      if (creux > creuxTolere) {
        groupes.push([debut, dernier]);
        debut = -1;
      }
    }
  }
  // Le dernier groupe se referme sur son dernier indice au-dessus du seuil, et
  // non sur la fin du tableau : sinon un groupe qui s'arrete a quelques pixels
  // du bord parait toucher le bord, et le filtre « ligne rognee » jette une
  // ligne pourtant entiere — jusqu'a cinq Pokemon perdus sans laisser de trace.
  if (debut >= 0) groupes.push([debut, dernier]);
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
      // Ici la somme simple, et non `ecartAuFond` : cette passe ne cherche pas
      // à détourer un sprite mais à situer des colonnes et des lignes, et elle
      // y arrive très bien avec les seuls corps francs. La mesure sensible aux
      // pâleurs y ferait entrer assez de fond pour noyer les creux entre
      // colonnes — essayé, la grille tombait de 7×5 à 7×4 et tout se décalait.
      const force = Math.abs(dr) + Math.abs(dv) + Math.abs(db);
      avant[y * width + x] = force > SEUIL_FOND && !estUnTraitDuFond(dr, dv, db, fr, fv, fb) ? 1 : 0;
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

  // Les lignes ne se lisent PAS comme les colonnes.
  //
  // Découper le profil en paquets marche horizontalement — cinq colonnes bien
  // séparées — et échoue verticalement : un Papilusion ailes déployées touche
  // presque la ligne suivante, un Aspicot laisse un grand vide. Sur de vraies
  // captures, les bandes dérivaient de vingt-cinq pixels et deux lignes
  // voisines fusionnaient — l'une des trois n'en rendait que quatre sur sept.
  //
  // Or la grille de HOME est RÉGULIÈRE. On cherche donc son pas, puis sa
  // phase, et on pose un maillage parfait. Le pas par autocorrélation : le
  // profil se ressemble à lui-même décalé d'exactement une ligne.
  const pasY = pasPeriodique(profilY, yDebut, height, Math.round(pasX * 0.8), Math.round(pasX * 2.2));
  if (!pasY) return null;

  // La phase : parmi les décalages possibles, celui qui fait tomber le plus de
  // matière au centre des cases.
  let phase = 0;
  let meilleure = -1;
  const demiBande = Math.round(pasY * 0.3);
  for (let p = 0; p < pasY; p++) {
    let total = 0;
    for (let centre = yDebut + p; centre < height; centre += pasY) {
      for (let y = Math.max(0, centre - demiBande); y < Math.min(height, centre + demiBande); y++) {
        total += profilY[y];
      }
    }
    if (total > meilleure) {
      meilleure = total;
      phase = p;
    }
  }

  // Une ligne coupée par un bord donnerait un sprite tronqué, donc une
  // reconnaissance fausse — et, pire, une fausse ancre pour ses voisines. On
  // ne garde que les lignes entièrement dans l'image ; les captures se
  // chevauchent, celles du bord reviennent dans la suivante.
  const haut = Math.round(pasY * 0.27);
  const bas = Math.round(pasY * 0.31);
  const lignes = [];
  for (let centre = yDebut + phase; centre < height; centre += pasY) {
    if (centre - haut < 0 || centre + bas >= height) continue;
    lignes.push(centre);
  }
  if (!lignes.length) return null;

  return { colonnes, lignes, demiL: Math.round(pasX * 0.48), haut, bas, pasY };
}

/**
 * Le pas d'une grille régulière, par autocorrélation du profil.
 *
 * On décale le profil sur lui-même et on regarde à quel décalage il se
 * ressemble le plus. Ce décalage-là est le pas — et c'est vrai même si des
 * lignes manquent, se touchent, ou sont coupées par un bord, ce qui est
 * exactement le cas d'une capture d'écran.
 */
function pasPeriodique(profil, debut, fin, pasMin, pasMax) {
  let meilleur = 0;
  let score = -1;
  for (let p = pasMin; p <= pasMax; p++) {
    let somme = 0;
    let n = 0;
    for (let y = debut; y + p < fin; y++) {
      somme += profil[y] * profil[y + p];
      n += 1;
    }
    if (!n) continue;
    const moyenne = somme / n;
    if (moyenne > score) {
      score = moyenne;
      meilleur = p;
    }
  }
  return meilleur || null;
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

      // Les deux boutons flottants de HOME sont ancres en bas de l'ecran : ils
      // ne peuvent recouvrir que la derniere ligne. N'interroger qu'elle evite
      // que le test se declenche sur un Pokemon vert ou blanc du milieu de la
      // grille — Florizarre atteint 0,76 pour un seuil a 0,85, la marge est
      // trop mince pour l'appliquer partout.
      const derniereLigne = r === g.lignes.length - 1;
      if (derniereLigne && sousUnBouton(data, width, cx, cy, g)) {
        // Recensee malgre tout, sans empreinte : une case ecartee en silence
        // ne figurerait nulle part, et un Pokemon disparaitrait sans que rien
        // ne le signale. Ainsi elle ressort « non lue » a la relecture.
        cases.push({ ligne: r, colonne: c, vecteur: null, cachee: true });
        continue;
      }
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
/**
 * Distance moyenne entre deux empreintes, ramenée sur 100 comme en Python.
 *
 * `plafond` permet d'abandonner en route. On compare une case à 2 611
 * références, et la plupart n'ont aucune chance : dès que la somme partielle
 * dépasse ce qu'il faudrait pour entrer dans les huit meilleurs, la suite du
 * calcul ne changera pas le classement. Le résultat rendu est alors faux, mais
 * il est trop grand — ce qui est exactement l'information utile.
 *
 * On ne teste pas à chaque octet : le test coûterait plus que l'addition qu'il
 * évite. Un contrôle tous les 128 octets suffit à couper l'essentiel.
 */
function distance(refs, offset, taille, vecteur, plafond) {
  const limite = plafond === undefined ? Infinity : (plafond * taille * 255) / 100;
  let total = 0;
  for (let i = 0; i < taille; i++) {
    total += Math.abs(refs[offset + i] - vecteur[i]);
    if ((i & 127) === 127 && total > limite) return Infinity;
  }
  return (total / taille / 255) * 100;
}

/**
 * Le plus proche voisin, et de combien il devance son premier vrai rival.
 *
 * Un score absolu dit mal la confiance : 8 est bon sur une capture nette, mediocre
 * sur une capture compressee. Ce qui la dit, c'est l'ECART au meilleur candidat
 * portant une autre reponse. Premier a 8 et suivant a 9, on hesite entre deux
 * Pokemon ; premier a 8 et suivant a 20, il n'y a pas de debat.
 *
 * « Une autre reponse » et non « une autre reference » : le chromatique d'une
 * espece est une reference distincte mais une reponse distincte aussi, et s'y
 * tromper coute une case fausse. Il compte donc comme rival.
 *
 * On retient les huit meilleurs plutot que les deux : les huit premiers sont
 * souvent des variantes de la meme espece, et le rival cherche se trouve plus
 * loin. Huit suffit largement, et l'insertion ne coute rien une fois le tableau
 * rempli — la plupart des references n'y entrent jamais.
 */
const TETE = 8;

function plusProche(banque, vecteur, garder) {
  const { octets, taille, especes, shiny } = banque;
  const idx = new Int32Array(TETE).fill(-1);
  const sc = new Float64Array(TETE).fill(Infinity);

  for (let i = 0; i < especes.length; i++) {
    if (garder && !garder(i)) continue;
    const d = distance(octets, i * taille, taille, vecteur, sc[TETE - 1]);
    if (d >= sc[TETE - 1]) continue;
    let p = TETE - 1;
    while (p > 0 && sc[p - 1] > d) {
      sc[p] = sc[p - 1];
      idx[p] = idx[p - 1];
      p -= 1;
    }
    sc[p] = d;
    idx[p] = i;
  }

  if (idx[0] < 0) return null;

  const espece = especes[idx[0]];
  const chromatique = shiny ? shiny[idx[0]] : 0;
  let rival = Infinity;
  for (let k = 1; k < TETE; k++) {
    if (idx[k] < 0) continue;
    const autre = especes[idx[k]] !== espece || (shiny ? shiny[idx[k]] : 0) !== chromatique;
    if (autre) {
      rival = sc[k];
      break;
    }
  }

  return { index: idx[0], score: sc[0], marge: rival === Infinity ? Infinity : rival - sc[0] };
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
    c.marge = m.marge;
    c.retenue = m.score <= STRICT && m.marge >= MARGE_MIN;
    if (!c.retenue) c.motif = m.score <= STRICT ? "ambigu" : "score";
  }

  /*
   * Cette capture est-elle rangee par numero croissant ?
   *
   * Toute la suite en depend : c'est de cet ordre que viennent les intervalles
   * qui ramenent 1025 candidats a une poignee. Mais il ne tient que dans la vue
   * en BOITES. La liste « Tous les Pokemon » se trie autrement — decroissant,
   * ou par date de capture — et la contrainte se retourne alors contre nous :
   * elle jette les bonnes reponses au lieu de les sauver.
   *
   * Mesure sur une capture de cette liste : 18 cases sur 33 tombaient sous 6 en
   * appariement libre, et il en restait 3 apres l'ordre impose. Vingt-cinq
   * inversions sur trente-trois : la suite descendait.
   *
   * On demande donc leur avis aux ancres, qui sont sures par construction. Si
   * la moitie d'entre elles doit sauter pour rendre la suite croissante, c'est
   * que la suite ne l'est pas.
   */
  /*
   * Deux chemins possibles, et on ne devine pas lequel vaut mieux : on les
   * essaie tous les deux.
   *
   * Le chemin ORDONNE exploite le rangement par numero : entre deux ancres, une
   * case ne peut etre qu'une espece de l'intervalle, ce qui ramene 1025
   * candidats a une poignee et permet d'accepter un score moyen. Quand l'ordre
   * tient, il est imbattable — sur une capture de boites il fait passer 17
   * ancres a 24 cases lues.
   *
   * Le chemin SANS ORDRE n'a que la marge pour lui : score plus lache accepte,
   * mais avance deux fois plus nette exigee sur le premier rival. Quand on ne
   * peut plus reduire le champ des possibles, il faut que la reponse se
   * distingue d'elle-meme.
   *
   * Aucune regle simple ne dit lequel choisir. Une liste peut etre a moitie
   * triee : l'ordre y semble tenir, mais l'imposer coute plus qu'il ne rapporte
   * — mesure sur une capture de la liste « Tous les Pokemon », 12 ancres
   * devenaient 10 cases lues. Alors on compte. Les deux chemins ne retiennent
   * que ce qu'ils jugent sur, chacun selon son critere ; celui qui en retient
   * le plus a simplement mieux exploite la meme capture.
   */
  const apres = essayerOrdonne(cases, banque, sensDeLecture(cases, banque));
  const avant = essayerSansOrdre(cases, banque);
  appliquer(cases, apres.retenues >= avant.retenues ? apres.etat : avant.etat);
  return rendre(cases, banque);
}

/** Photographie l'etat decidable de chaque case, pour pouvoir y revenir. */
function copier(cases) {
  return cases.map((c) => ({
    index: c.index,
    score: c.score,
    marge: c.marge,
    retenue: c.retenue,
    motif: c.motif,
    fenetre: c.fenetre,
  }));
}

function appliquer(cases, etat) {
  cases.forEach((c, i) => Object.assign(c, etat[i]));
}

/** Le chemin sans contrainte : la marge seule, mais exigee au double. */
function essayerSansOrdre(cases, banque) {
  const depart = copier(cases);
  for (const c of cases) {
    if (!c.vecteur || c.retenue) continue;
    if (c.score <= RELACHE && c.marge >= MARGE_MIN * 2) {
      c.retenue = true;
      c.motif = undefined;
    }
  }
  const etat = copier(cases);
  appliquer(cases, depart);
  return { etat, retenues: etat.filter((e) => e.retenue).length };
}

/** Le chemin ordonne : ancrage, encadrement, et plusieurs tours. */
function essayerOrdonne(cases, banque, sens) {
  const depart = copier(cases);
  if (sens === 0) return { etat: depart, retenues: depart.filter((e) => e.retenue).length };

  // Une liste decroissante se lit a l'endroit une fois retournee : les passes
  // qui suivent n'ont pas a savoir dans quel sens on est. Le tableau retourne
  // porte les MEMES objets, donc les modifier revient au meme.
  const ordre = sens > 0 ? cases : [...cases].reverse();

  imposerOrdre(ordre, banque);

  // Passes suivantes : entre deux ancres, une case ne peut être qu'une espèce
  // de l'intervalle. Chaque tour ajoute des appuis, donc resserre le suivant.
  for (let tour = 0; tour < PASSES; tour++) {
    const bas = encadrer(ordre, banque, true);
    const haut = encadrer(ordre, banque, false);
    let recuperees = 0;
    for (let i = 0; i < ordre.length; i++) {
      const c = ordre[i];
      if (!c.vecteur || c.retenue) continue;
      const lo = bas[i];
      const hi = haut[i];
      const m = plusProche(banque, c.vecteur, (k) => banque.especes[k] >= lo && banque.especes[k] <= hi);
      if (!m) continue;
      c.index = m.index;
      c.score = m.score;
      c.marge = m.marge;
      // Plus l'intervalle est étroit, plus on peut être indulgent : avec cinq
      // candidats possibles, un score moyen reste concluant.
      const largeur = hi - lo + 1;
      const limite = largeur > LARGEUR_ETROITE ? RELACHE : RELACHE_ETROIT;
      if (m.score > limite) {
        c.motif = "score";
        continue;
      }
      // Deux candidats au coude a coude ne se departagent pas par le score.
      // C'est ainsi que le Florizarre normal passait pour son chromatique.
      if (m.marge < MARGE_MIN) {
        c.motif = "ambigu";
        continue;
      }
      c.retenue = true;
      c.fenetre = [lo, hi];
      recuperees += 1;
    }
    imposerOrdre(ordre, banque);
    if (!recuperees) break;
  }

  const etat = copier(cases);
  appliquer(cases, depart);
  return { etat, retenues: etat.filter((e) => e.retenue).length };
}

/**
 * Dans quel sens cette capture est-elle rangee ?
 *
 * +1 croissant, -1 decroissant, 0 aucun ordre lisible.
 *
 * La vue en BOITES de HOME range par numero croissant, et c'est de la que vient
 * toute la force de la methode. Mais la liste « Tous les Pokemon » se trie
 * autrement selon le reglage — decroissant, notamment. Imposer le croissant a
 * une liste decroissante ne fait pas que perdre la contrainte : elle se
 * retourne, et jette les bonnes reponses en croyant ecarter les mauvaises.
 * Mesure sur une capture de cette liste : 18 cases sur 33 tombaient sous 6 en
 * appariement libre, il n'en restait 3 apres l'ordre impose.
 *
 * On demande donc leur avis aux ancres, sures par construction — score franc ET
 * marge nette. Celle des deux lectures qui en garde le plus l'emporte ; si
 * aucune n'en garde une majorite franche, c'est qu'il n'y a pas d'ordre du
 * tout, et mieux vaut s'en passer que de l'inventer.
 *
 * En dessous de quatre ancres on ne tranche pas : deux ou trois points ne
 * disent rien d'un tri, et le croissant reste le cas de loin le plus courant.
 */
function sensDeLecture(cases, banque) {
  const numeros = [];
  cases.forEach((c) => {
    if (c.retenue && c.index >= 0) numeros.push(banque.especes[c.index]);
  });
  if (numeros.length < 4) return 1;

  const suite = (liste) => plusLongueCroissante(liste.map((v, i) => [i, v])).size;
  const enAvant = suite(numeros);
  const enArriere = suite([...numeros].reverse());
  const meilleur = Math.max(enAvant, enArriere);
  if (meilleur < numeros.length * 0.6) return 0;
  return enAvant >= enArriere ? 1 : -1;
}

/** Met en forme le resultat, quel que soit le chemin emprunte. */
function rendre(cases, banque) {
  return cases.map((c) => ({
    capture: c.capture,
    ligne: c.ligne,
    colonne: c.colonne,
    vide: !c.vecteur,
    retenue: c.retenue,
    motif: c.motif || null,
    score: c.score === Infinity ? null : Math.round(c.score * 10) / 10,
    marge: c.marge == null || c.marge === Infinity ? null : Math.round(c.marge * 10) / 10,
    espece: c.index >= 0 ? banque.especes[c.index] : null,
    shiny: c.index >= 0 ? Boolean(banque.shiny[c.index]) : false,
    sprite: c.index >= 0 ? banque.sprites[c.index] : null,
  }));
}
