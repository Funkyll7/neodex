/**
 * maj.js — l'histoire du site, par version.
 *
 * D'OÙ VIENNENT CES NOTES. Elles sont relues dans l'historique du dépôt, un
 * commit après l'autre, et regroupées par ce qui a changé ENSEMBLE. Ce n'est
 * donc pas une liste de commits — il y en a plusieurs centaines, dont neuf sur
 * dix disent « Collection : Dracaufeu » et n'intéressent personne. Ce sont les
 * quelques dizaines de moments où le site est devenu autre chose.
 *
 * ÉCRITES À LA MAIN, ET C'EST VOULU. Un générateur qui lirait les messages de
 * commit aurait produit une liste exacte et illisible : le message d'un commit
 * s'adresse à celui qui relira le code, pas à celui qui utilise le site. « Le
 * contour noir manquait sur les logos des boutons de formes » n'a de sens que
 * pour moi ; « Les logos de forme se détachent enfin sur les fonds clairs » en
 * a pour tout le monde.
 *
 * LES NUMÉROS SONT DES REPÈRES, pas des promesses. Le site n'a pas de build, et
 * rien ne « sort » : il se met à jour au `git push` suivant. Une version majeure
 * marque donc un changement de nature — la synchronisation, le Pokédex GO, les
 * récompenses —, une mineure un lot de finitions.
 *
 * `sw.js` porte, lui, un numéro DIFFÉRENT et incrémenté à chaque poussée, parce
 * qu'il sert à autre chose : purger les caches. Les confondre serait tentant et
 * faux — l'un compte les idées, l'autre les déploiements.
 */

/**
 * Les catégories, dans l'ordre où elles s'affichent.
 *
 * Une couleur par nature de changement : on parcourt une liste de trente
 * lignes, et la teinte dit d'un coup d'œil si on lit une nouveauté ou une
 * réparation.
 */
export const NATURES = {
  ajout: { nom: "Nouveau", teinte: "#4fbf6a" },
  amelioration: { nom: "Amélioré", teinte: "#4aa8ff" },
  correction: { nom: "Corrigé", teinte: "#ffb020" },
  donnees: { nom: "Données", teinte: "#b28dff" },
};

/**
 * Les versions, de la plus récente à la plus ancienne.
 *
 * `majeure: true` ouvre un chapitre : c'est ce que la liste met en avant, et ce
 * qui permet de survoler cinq ans d'un site en dix lignes plutôt qu'en cent.
 */
export const VERSIONS = [
  {
    version: "5.4",
    date: "2026-09-03",
    titre: "Chaque DLC sur sa ligne",
    notes: [
      ["ajout", "Les quatre DLC ont leur propre ligne sous leur jeu, visible sur toutes les fiches, et disent chacun s'ils apportent l'espèce ou non."],
      ["amelioration", "Quand une espèce n'est obtenable que par un DLC, la ligne du jeu de base dit « indisponible » — elle annonçait « disponible » à tort."],
      ["correction", "Huit légendaires du Repaire Dynamax manquaient à la Toundra Couronnée : Mewtwo, Lugia, Ho-Oh, Rayquaza, Dialga, Reshiram, Zekrom et Necrozma."],
      ["correction", "« Le meilleur taux se trouve dans Épée / Bouclier » contredisait le tableau juste au-dessus : la chasse nomme le DLC elle aussi."],
    ],
  },
  {
    version: "5.3",
    date: "2026-09-03",
    titre: "Les DLC comptent enfin",
    notes: [
      ["ajout", "Les Pokémon des DLC sont recensés par jeu : les 42 légendaires du Repaire Dynamax, les friandises de Jeffry Andise, le Pokédex Hyperespace, Phione et Manaphy."],
      ["ajout", "Le logo du DLC s'affiche à côté du jeu, dans « Où le trouver », quand l'espèce ne s'obtient que par lui."],
      ["ajout", "Une case « Masquer les formes Gigamax » dans les vues Boîtes et Familles : un Gigamax n'occupe pas de boîte dans HOME, il décalait le rangement de trente-quatre cases."],
      ["ajout", "Les bandes de génération reviennent dans les Boîtes et les Familles, comme dans la grille."],
      ["amelioration", "« Ce qu'il me reste » devient « Ce qu'il reste par jeu »."],
      ["amelioration", "La reproduction par DV de la Gén. II ne remporte plus le « meilleur taux » : son 1/64 envoyait toute chasse vers Or/Argent ou Cristal."],
      ["correction", "« Chasser celui-ci » manquait sur les cent deux espèces à dimorphisme : avoir le chromatique ♀ suffisait à faire croire que le ♂ était pris."],
      ["correction", "En fenêtre réduite, les onglets se chevauchaient — le compteur de Quêtes se posait sur le logo des Mises à jour."],
    ],
  },
  {
    version: "5.2",
    date: "2026-09-03",
    titre: "Ce qui manquait, ce qui clochait",
    notes: [
      ["ajout", "« Chasser celui-ci » dans la fiche : on choisit enfin sa chasse, au lieu de subir un tirage au sort."],
      ["ajout", "Un appui long, un clic droit ou un Ctrl+clic ouvre la fiche depuis une case de boîte — le clic simple coche toujours."],
      ["ajout", "Cet appareil porte un nom, et le journal dit « Reçu de : … » au lieu de « Reçu d'un autre appareil »."],
      ["correction", "Deux onglets du même navigateur s'ignoraient : ils se préviennent, et le second n'écrase plus le travail du premier."],
      ["correction", "Entre 861 et 1180 px de large, choisir une vignette semblait ne rien faire : la fiche s'ouvrait sous la grille sans qu'on y aille."],
      ["correction", "Dans les réglages, cliquer le titre d'un interrupteur ne le basculait pas."],
    ],
  },
  {
    version: "5.1",
    date: "2026-08-30",
    titre: "Les boîtes de HOME",
    notes: [
      ["ajout", "Une vue « Boîtes » : le Pokédex rangé trente par trente comme dans HOME, où un trou se voit sans le chercher."],
      ["ajout", "Un second rangement, « Familles » : une lignée par ligne, comme le Pokédex d'Ultra-Soleil."],
      ["ajout", "Un mur des chromatiques : tout ce que tu as en shiny, en grand, groupé par région — et rien qui manque."],
      ["ajout", "« Ce qu'il me reste » : les vingt-trois jeux classés par ce qu'ils boucheraient, le sauvage d'abord."],
      ["amelioration", "Les boîtes portent toutes les cases cochables, formes comprises, et un clic en coche une."],
    ],
  },
  {
    version: "5.0",
    date: "2026-08-30",
    titre: "Neuf régions, neuf fanatiques",
    majeure: true,
    notes: [
      ["ajout", "Neuf succès « Fanatique » : boucler une région nommément, et non plus une région au choix."],
      ["ajout", "Le style de sprite se choisit à part du thème : le pixel art devient portable sur les trente-huit palettes."],
      ["ajout", "Trois Balls à gagner : elles remplacent la Poké Ball du bouton « capturé », et le curseur sur ordinateur."],
      ["ajout", "Deux fonds de page qui bougent : la pluie de Hoenn et la neige de Sinnoh."],
      ["ajout", "Un écran de chargement « Dynamax » : trois ondes rouges partent du logo pendant que le Pokédex arrive."],
      ["ajout", "Un compagnon à choisir : dix-neuf Pokémon des palettes, plus un légendaire exclusif par région bouclée."],
      ["ajout", "Un habillage « Carte postale » pour la carte de partage : un paysage d'Alola dessiné derrière, un timbre dentelé et son cachet."],
    ],
  },
  {
    version: "4.5",
    date: "2026-08-30",
    titre: "Deux talents qui font une forme",
    notes: [
      ["ajout", "Zygarde Forme 10 % ordinaire : seule celle au Système Alpha était recensée, et rien ne le disait."],
      ["ajout", "Zygarde Forme 50 % Système Alpha devient cochable : elle était écartée comme doublon de l'espèce, mais son talent n'est pas le même."],
      ["amelioration", "Les formes qui ne se distinguent que par leur talent le disent enfin : Système Alpha chez Zygarde, Tempo Perso chez Rocabot."],
    ],
  },
  {
    version: "4.4",
    date: "2026-08-30",
    titre: "Un coucher de soleil, et cinq réparations",
    notes: [
      ["amelioration", "« Aurore » est devenu un coucher de soleil : ciel, mer, traînée sur l'eau et palmiers en contre-jour."],
      ["correction", "L'aperçu d'un fond de page cachait la colonne de gauche derrière la trame."],
      ["correction", "La marque « Classique » prenait les couleurs de la marque équipée dans le menu de customisation."],
      ["correction", "Les barres collantes se recouvraient sur téléphone : la recherche mordait sur « Filtres », le séparateur de génération sur la recherche."],
      ["correction", "La dernière ligne d'un panneau passait sous la barre de gestes du téléphone."],
      ["amelioration", "Les sprites de la fiche arrivent avec elle au lieu d'attendre un tour de mise en page."],
      ["correction", "Le motif de fond se peignait par-dessus l'écran de chargement, message d'erreur compris."],
    ],
  },
  {
    version: "4.3",
    date: "2026-08-30",
    titre: "Dire de quoi on parle",
    notes: [
      ["ajout", "« Région bouclée » nomme la région la plus proche du bout, ce qu'il reste à cocher et le pourcentage."],
      ["amelioration", "L'onglet des mises à jour porte son logo, teinté par la palette du moment."],
      ["correction", "L'aperçu d'un fond de page montrait deux vignettes géantes au lieu du motif."],
    ],
  },
  {
    version: "4.2",
    date: "2026-08-30",
    titre: "Le journal, et les cosmétiques qui se regardent",
    notes: [
      ["ajout", "Un journal des modifications : ce que tu coches ici et ce qui arrive d'un autre appareil, jour par jour."],
      ["ajout", "Le détail d'une synchronisation s'ouvre tout seul quand un autre appareil a écrit."],
      ["ajout", "Sept marques de complétion, chacune avec sa matière : sceau, cabochon irisé, saphir taillé, or serti de trois pierres."],
      ["ajout", "Les sept titres les plus rares portent un dégradé ; les cinq autres restent sobres."],
      ["amelioration", "Les panneaux gardent leur en-tête en place pendant qu'on fait défiler, et deviennent une feuille sur téléphone."],
      ["correction", "Le scintillement d'un chromatique suivait la vignette et non le sprite : il se décalait sous les cadres Laurier et Couronne."],
      ["correction", "Les huit titres du menu de customisation portaient leur icône quatre pixels trop bas."],
    ],
  },
  {
    version: "4.1",
    date: "2026-08-30",
    titre: "Voir avant de mériter",
    notes: [
      ["ajout", "Un aperçu s'ouvre au clic sur un cosmétique verrouillé : la chose en grand, et ce qu'il faut faire pour l'ouvrir."],
      ["ajout", "Les palettes verrouillées se prévisualisent sur une maquette de l'écran entier."],
      ["ajout", "Les jeux de sons s'écoutent avant d'être gagnés — un tic de case, une fanfare de succès."],
      ["amelioration", "Les cadres Laurier et Couronne portent un vrai laurier et une vraie couronne, dessinés et posés sur le Pokémon."],
      ["amelioration", "La palette Couronne est relevée sur l'artwork de Zacian chromatique, teinte par teinte."],
      ["correction", "Le geste Retour du téléphone ne quitte plus le site depuis le tiroir des filtres."],
    ],
  },
  {
    version: "4.0",
    date: "2026-08-30",
    titre: "Les récompenses",
    majeure: true,
    notes: [
      ["ajout", "Quarante et un cosmétiques — titres, marques, cadres, motifs, bandeaux, sons — débloqués par les succès."],
      ["ajout", "Un menu de customisation unique pour tout ce qui change l'apparence."],
      ["ajout", "« Hors d'atteinte » : sortir une espèce du décompte sans toucher à ses cases."],
      ["ajout", "Une courbe de progression, lue dans l'historique du dépôt."],
      ["amelioration", "Dix-huit palettes refondues autour de leur Pokémon, avec ses vraies couleurs."],
      ["amelioration", "Le tri des chasses met la plus courte en premier."],
    ],
  },
  {
    version: "3.1",
    date: "2026-08-30",
    titre: "Les succès, et la carte de partage",
    notes: [
      ["ajout", "Quarante-trois succès, avec leurs icônes, leur page et leur échelle de rareté."],
      ["ajout", "Une carte de collection à partager, dessinée sur canvas plutôt que quatre lignes de texte."],
      ["ajout", "Un panneau de réglages : les sons et le mode compact."],
      ["ajout", "Un objectif chiffré par chasse, qui suit les appareils."],
      ["correction", "Contraste mesuré sur les trente-huit palettes : trente-trois passaient sous le seuil AA."],
      ["correction", "Le filtre « plus que le shiny », et la pastille de statut du Pokédex GO."],
    ],
  },
  {
    version: "3.0",
    date: "2026-08-29",
    titre: "Les chasses, et le son",
    majeure: true,
    notes: [
      ["ajout", "Un carnet de chasses : les rencontres comptées, l'historique gardé, la fusion entre appareils."],
      ["ajout", "Treize sons, dosés par rareté du geste, coupables d'un clic."],
      ["ajout", "Vingt-trois emblèmes de jeu, dessinés à la main, jusque dans le tableau de disponibilité."],
      ["ajout", "Le chromatique scintille sur sa vignette."],
      ["ajout", "L'interface entière en anglais — plus de six cents textes, formes et lieux compris."],
      ["correction", "Balayage complet : six défauts, dont deux qui perdaient des cases."],
    ],
  },
  {
    version: "2.2",
    date: "2026-08-28",
    titre: "Pixels, et l'anglais",
    notes: [
      ["ajout", "Six thèmes « Pixels » qui remplacent aussi les sprites, pas seulement les couleurs."],
      ["ajout", "La bascule français / anglais, et la table des noms venus des données."],
      ["amelioration", "Lecture de captures : 38 % plus rapide, à résultat identique, et les listes à l'envers acceptées."],
      ["correction", "Quatorze pastilles de type sur dix-huit étaient illisibles."],
      ["donnees", "Trente chromatiques manquaient aux thèmes Pixels sans que rien ne le signale."],
    ],
  },
  {
    version: "2.1",
    date: "2026-08-27",
    titre: "Le Pokédex GO, et les captures d'écran",
    majeure: true,
    notes: [
      ["ajout", "Un second Pokédex, celui de Pokémon GO : 952 obtenables, ses formes régionales et ses chromatiques."],
      ["ajout", "Lire des captures d'écran de HOME pour cocher les cases, et les recevoir par le partage Android."],
      ["ajout", "Vingt-six thèmes, un tiroir de filtres sur téléphone, une icône d'application."],
      ["amelioration", "La barre latérale passe de onze sections à six, et le détail se replie."],
      ["donnees", "Trente erreurs de taux et de verrous chromatiques, sourcées deux fois."],
      ["donnees", "Le site prend son nom : Funkylldex."],
    ],
  },
  {
    version: "2.0",
    date: "2026-08-26",
    titre: "Une case par forme",
    majeure: true,
    notes: [
      ["ajout", "Chaque forme a sa propre case, et les cent sept cases héritées sont converties."],
      ["ajout", "Le site marche hors ligne, sprites compris."],
      ["ajout", "Les formes se lisent en grille et se filtrent par famille."],
      ["amelioration", "Passer au Pokémon suivant sans revenir à la grille."],
      ["correction", "La recherche par numéro, cassée, et ouverte aux formes."],
      ["correction", "Le service worker servait du JavaScript périmé."],
    ],
  },
  {
    version: "1.3",
    date: "2026-08-13",
    titre: "Pikachu au complet",
    notes: [
      ["ajout", "La grille des casquettes, comme l'alphabet Zarbi."],
      ["ajout", "Ses cases mâle et femelle, et les six Pikachu Cosplayeur."],
    ],
  },
  {
    version: "1.2",
    date: "2026-08-09",
    titre: "Formes cosmétiques et Gigamax",
    notes: [
      ["ajout", "Les formes cosmétiques, la barre de progression et l'écran Dynamax."],
      ["ajout", "L'emblème Gigamax sur les vignettes, en gris puis en couleur."],
    ],
  },
  {
    version: "1.1",
    date: "2026-08-07",
    titre: "La synchronisation",
    majeure: true,
    notes: [
      ["ajout", "La collection se synchronise avec le dépôt GitHub, d'un appareil à l'autre."],
      ["ajout", "Une fiche en feuille plein écran sur téléphone, et le marquage « tout obtenu »."],
      ["donnees", "Les 304 formes recensées, et le chromatique documenté jeu par jeu."],
    ],
  },
  {
    version: "1.0",
    date: "2026-08-01",
    titre: "La première version",
    majeure: true,
    notes: [
      ["ajout", "Un Pokédex personnel, entièrement statique : une grille, une fiche, des cases à cocher."],
      ["ajout", "Sur téléphone, la grille reste en tête et l'écran descend jusqu'à la fiche."],
    ],
  },
];

/** Le numéro de la version la plus récente, pour la pastille de l'onglet. */
export function versionCourante() {
  return VERSIONS.length ? VERSIONS[0].version : "";
}

/**
 * Combien de notes en tout : c'est ce que la pastille de l'onglet affiche.
 *
 * Le NOMBRE DE VERSIONS aurait été plus court à lire et moins juste : douze
 * versions ne disent pas si la dernière apporte une ligne ou quinze.
 */
export function nombreDeNotes() {
  return VERSIONS.reduce((somme, v) => somme + v.notes.length, 0);
}
