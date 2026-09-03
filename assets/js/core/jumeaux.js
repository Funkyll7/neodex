/**
 * jumeaux.js — deux onglets du meme navigateur qui cessent de s'ignorer.
 *
 * LE PROBLEME. Tout l'etat du site vit dans `localStorage`, et `localStorage`
 * est COMMUN a tous les onglets d'une meme origine — mais rien ne previent un
 * onglet qu'un autre vient d'y ecrire. Deux onglets ouverts cote a cote, ce sont
 * donc deux copies en memoire de la meme collection, qui divergent des la
 * premiere case cochee. Celui qui n'a rien fait continue d'afficher l'ancien
 * etat, ce qui est deja penible ; surtout, il reecrit SA copie perimee au
 * prochain clic, et la case cochee dans l'autre onglet disparait sans un
 * message. Le dernier qui ecrit gagne, et il a tort.
 *
 * Ce n'est pas un cas tordu : on ouvre un second onglet pour comparer deux
 * boites, pour garder une fiche sous les yeux pendant qu'on coche ailleurs, ou
 * simplement parce que le site trainait deja quelque part et qu'on l'a oublie.
 *
 * CE QUE CE MODULE PORTE, ET CE QU'IL NE PORTE PAS. Un SIGNAL, rien d'autre :
 * « quelqu'un vient d'ecrire ». L'etat, lui, ne voyage pas — il est deja dans
 * `localStorage`, ou l'onglet qui recoit va le relire. Faire circuler la
 * collection entiere dans le message aurait cree une seconde source de verite a
 * arbitrer contre la premiere, et un message perdu — un onglet endormi, un
 * navigateur qui coupe — aurait laisse une divergence qu'aucune relecture ne
 * repare. Un signal, lui, peut se perdre sans consequence : la verite reste
 * entiere dans le stockage.
 *
 * DEUX TRANSPORTS, PARCE QUE LE PREMIER PEUT MANQUER.
 *
 *   1. `BroadcastChannel`, fait exactement pour cela : un message, tous les
 *      contextes de la meme origine, sans passer par le stockage.
 *   2. A defaut, l'evenement `storage`. Il a ici une propriete precieuse : il ne
 *      se declenche QUE dans les AUTRES onglets, jamais dans celui qui ecrit. On
 *      y depose donc un phare — une cle qui n'existe que pour changer de valeur
 *      — et les voisins l'entendent.
 *   3. Ni l'un ni l'autre : le canal existe quand meme et ne fait rien. Le site
 *      se comporte comme hier, ce qui n'est une regression pour personne.
 *
 * POURQUOI UN IDENTIFIANT D'ONGLET. Sans lui, un onglet entendrait ses propres
 * annonces et se redessinerait a chaque case qu'il coche — mille vignettes
 * repeintes pour rien, sous le doigt qui coche. `BroadcastChannel` ne se sert
 * deja pas lui-meme, mais le phare, lui, est lisible par tout le monde, et la
 * garantie du premier tomberait le jour ou l'on ouvrirait un second canal dans
 * le meme onglet. Un identifiant coute quelques octets et rend la regle
 * explicite plutot que dependante d'un detail de norme.
 *
 * CE QUE CE MODULE NE REPARE PAS. Deux ecritures reellement simultanees — a
 * quelques millisecondes l'une de l'autre — se marchent toujours dessus : le
 * stockage n'a pas de fusion, il a une derniere valeur. Mais les deux onglets
 * sont devant la MEME personne, qui ne coche pas dans les deux a la fois. Ce que
 * le signal supprime, c'est la fenetre longue — celle qui durait jusqu'au
 * prochain rechargement.
 */

import { CONFIG } from "../config.js";

/**
 * Le nom du canal, et la cle du phare : un seul rendez-vous pour les deux
 * transports, donc une seule chose a changer le jour ou le format du message
 * bougerait. La version dans le nom sert a cela — un onglet ouvert depuis des
 * jours, servi par le cache hors ligne, tourne peut-etre sur l'ancien site.
 */
const CANAL = CONFIG.storage.jumeaux;

/** Qui parle. Tire une fois par onglet, au chargement du module. */
const MOI = identifiantDOnglet();

/**
 * Le compteur qui rend chaque annonce DIFFERENTE de la precedente.
 *
 * Indispensable au repli `storage` : le navigateur ne declenche l'evenement que
 * si la valeur a REELLEMENT change. Deux annonces identiques a la suite — ce qui
 * arrive des qu'on coche deux cases dans le meme onglet — n'auraient reveille
 * personne pour la seconde.
 */
let annonces = 0;

/**
 * Le temps qu'on laisse aux annonces s'accumuler avant de relire.
 *
 * Une relecture entraine un redessin complet : les mille vignettes, les
 * compteurs, la fiche ouverte. C'est le bon prix pour une case cochee a cote,
 * et c'est le mauvais prix repete cinq cents fois quand le voisin importe une
 * sauvegarde ou valide une lecture de captures — chaque case y passe par
 * `toggle()`, donc par une annonce.
 *
 * Un dixieme de seconde ne se voit pas, et transforme la rafale en un seul
 * redessin. Ce delai elargit d'autant la fenetre pendant laquelle notre copie
 * reste perimee, mais elle est de toute facon bornee par la vitesse d'une main
 * humaine : personne ne coche dans deux onglets a cent millisecondes d'ecart.
 */
const REGROUPEMENT_MS = 120;

/**
 * Ouvre le canal entre onglets.
 *
 * @param {() => void} surSignal  appele quand un VOISIN annonce une ecriture.
 *   Jamais appele pour nos propres annonces.
 * @returns {{annoncer: () => void}} de quoi prevenir les voisins. Toujours un
 *   objet utilisable, meme quand aucun transport n'existe : l'appelant n'a pas a
 *   savoir lequel des trois cas il a sous la main.
 */
export function ouvrirCanalJumeaux(surSignal) {
  let minuteur = 0;

  /** Une annonce vient d'arriver — la notre en echo, ou celle d'un voisin. */
  const entendre = (message) => {
    // Un message illisible, ou le notre revenu par la bande : dans les deux cas
    // il n'y a rien a faire.
    if (!message || typeof message !== "object" || message.de === MOI) return;
    clearTimeout(minuteur);
    minuteur = setTimeout(surSignal, REGROUPEMENT_MS);
  };

  // 1. Le canal dedie.
  if (typeof BroadcastChannel === "function") {
    try {
      const canal = new BroadcastChannel(CANAL);
      canal.addEventListener("message", (evenement) => entendre(evenement.data));
      return {
        annoncer() {
          try {
            canal.postMessage({ de: MOI, n: (annonces += 1) });
          } catch {
            /* canal deja ferme (page en cours de demontage) : tant pis */
          }
        },
      };
    } catch {
      /* refuse dans ce contexte : on tente le repli */
    }
  }

  // 2. Le repli par l'evenement `storage`.
  try {
    // Le stockage repond-il ? On le LIT plutot que d'y ecrire pour le verifier :
    // une ecriture de test aurait reveille les voisins a la simple ouverture
    // d'un onglet, et leur aurait fait relire une collection identique.
    // En navigation privee stricte, l'acces lui-meme leve — d'ou le try.
    localStorage.getItem(CANAL);

    window.addEventListener("storage", (evenement) => {
      // `key` vaut `null` sur un `localStorage.clear()`, et le reste du site
      // ecrit dans une dizaine d'autres cles : on ne repond qu'au phare.
      if (evenement.key !== CANAL || !evenement.newValue) return;
      try {
        entendre(JSON.parse(evenement.newValue));
      } catch {
        /* phare illisible : on ne devine pas ce qu'il voulait dire */
      }
    });

    return {
      annoncer() {
        try {
          localStorage.setItem(CANAL, JSON.stringify({ de: MOI, n: (annonces += 1) }));
        } catch {
          /* quota depasse : le voisin rattrapera a son prochain chargement */
        }
      },
    };
  } catch {
    /* ni canal dedie ni stockage : on s'efface */
  }

  // 3. Un canal muet, qui ne casse rien.
  return { annoncer() {} };
}

/**
 * Un identifiant propre a cet onglet.
 *
 * `crypto.randomUUID` demande un contexte securise, que `file://` et le HTTP
 * simple n'offrent pas — et le site s'ouvre parfois comme cela. Le repli n'a
 * aucune pretention cryptographique : il lui suffit de ne pas tomber deux fois
 * sur la meme valeur entre deux onglets ouverts en meme temps.
 */
function identifiantDOnglet() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* contexte non securise : on fabrique le notre */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
