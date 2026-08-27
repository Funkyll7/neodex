# Funkylldex Capture — la bulle qui lit l'écran

Une application Android minimale qui pose un bouton flottant par-dessus Pokémon
HOME, capture l'écran à chaque appui, et remet la série au site par la feuille
de partage.

Elle **ne contient pas le site**, et c'est la règle qui tient tout le reste : le
site continue de se déployer par `git push`, l'APK se construit une fois, et les
deux ne se rencontrent que par des fichiers image. Aucune ligne de JavaScript à
toucher, aucun recalibrage de la reconnaissance.

Elle **n'a aucune permission réseau**. Elle ne parle à personne, ne connaît ni
compte ni serveur, et n'automatise aucun geste dans le jeu. C'est ce qui la
garde du bon côté de la ligne que les éditeurs sanctionnent réellement.

> **Ce code n'a jamais été compilé ni exécuté.** La machine où il a été écrit
> n'a ni JDK complet, ni Gradle, ni SDK Android. Attends-toi à corriger des
> détails à la première compilation.

## Avant tout : le test à trente secondes

Rien de ce qui suit ne sert si Pokémon HOME interdit l'enregistrement d'écran.

1. Installe n'importe quel enregistreur d'écran, ou utilise celui du système.
2. Filme une boîte de Pokémon HOME pendant cinq secondes.
3. Relis la vidéo.

**Si l'image est noire ou vide, arrête-toi là** : HOME pose `FLAG_SECURE`, et
aucune application ne pourra lire cet écran. Tes captures d'écran fixes rendent
ça très improbable — mais depuis Android 15 il existe un mécanisme qui masque du
contenu dans un flux sans bloquer la capture manuelle, donc ce n'est pas une
preuve.

## Construire

Il n'y a besoin ni d'Android Studio, ni de compte développeur, ni de clé de
signature : l'application s'installe par câble sur ton seul téléphone.

**1. Un JDK 17.** La machine n'a qu'un JRE 8, qui ne suffit pas — il faut un
kit de développement, pas seulement une machine virtuelle.

```bash
winget install EclipseAdoptium.Temurin.17.JDK
```

**2. Les outils du SDK Android**, en ligne de commande. Télécharge
« Command line tools only » depuis <https://developer.android.com/studio>,
décompresse dans `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest`, puis :

```bash
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

**3. Gradle**, une fois, pour générer le wrapper :

```bash
winget install Gradle.Gradle
```

**4. Construire et installer.** Depuis ce dossier, téléphone branché avec le
débogage USB activé :

```bash
gradle wrapper
```

```bash
./gradlew installDebug
```

Si l'appareil n'est pas vu, vérifie avec `adb devices` et accepte l'empreinte
qui s'affiche sur le téléphone.

## Utiliser

1. Ouvre **Funkylldex Capture**, accorde les notifications puis la bulle.
2. Appuie sur **Démarrer la lecture**. Android demande son consentement.
3. **Choisis « Écran entier »**, jamais « une seule application ». Le mode par
   application retire les barres système et décale toute la géométrie sur
   laquelle la reconnaissance a été calibrée.
4. L'application s'efface, la bulle reste. Ouvre Pokémon HOME.
5. **Un appui** sur la bulle capture la boîte affichée ; le compteur monte.
6. **Un appui long** termine la série et ouvre la feuille de partage — choisis
   Funkylldex.

La bulle se déplace au doigt. Elle s'efface d'elle-même le temps de chaque
prise, sinon elle se photographierait et masquerait une case.

## Ce qui va te surprendre

- **Le consentement revient à chaque session.** Depuis Android 14 il n'est pas
  mémorisable : rejouer un ancien résultat lève une exception.
- **La session meurt au verrouillage de l'écran**, depuis Android 15. Il faut
  revalider.
- **Une puce reste dans la barre d'état** pendant toute la capture, plus la
  notification du service. On ne peut pas les masquer.
- **Ta surcouche constructeur peut tuer le service** sans prévenir. Si la bulle
  disparaît toute seule, cherche l'optimisation de batterie et les
  « applications en veille » dans les réglages, et exempte celle-ci.

## Ordre de mise au point

Si quelque chose ne marche pas, ne cherche pas partout à la fois — ces quatre
étapes se vérifient séparément :

1. L'application s'ouvre et la bulle apparaît par-dessus HOME.
2. Un appui écrit bien un PNG : `adb shell run-as fr.funkylldex.capture ls cache/captures`.
3. Le PNG est droit et complet — s'il est cisaillé en diagonale, c'est le
   `rowStride`, et la correction est déjà dans `ServiceCapture.prendreUneTrame`.
4. Le partage atteint Funkylldex et la relecture propose les bons Pokémon.

Les journaux sortent avec `adb logcat -s Funkylldex`.
