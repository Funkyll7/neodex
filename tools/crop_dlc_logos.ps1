# crop_dlc_logos.ps1 — fabrique les quatre vignettes de assets/img/dlc/.
#
# Les quatre extensions payantes des jeux recents ont chacune leur logo :
#
#   crown-tundra.png   Les Terres Enneigees de la Couronne (Epee / Bouclier)
#   isle-armor.png     L'Ile Solitaire de l'Armure         (Epee / Bouclier)
#   zone-zero.png      Le Tresor Enfoui de la Zone Zero    (Ecarlate / Violet)
#   mega-dim.png       Mega-Dimension                      (Legendes Z-A)
#
# Meme calibre que assets/img/jeux/ : 96 px de cote, PNG.
#
# Les noms de fichiers ne sont pas choisis : ce sont EXACTEMENT les `code` de
# data/reference/dlc.json, comme assets/img/jeux/ suit les codes de
# data/reference/games.json. L'affichage peut donc composer son chemin sans
# table de correspondance — `assets/img/dlc/${code}.png` — et le jour ou un
# code change, un fichier manquant se voit tout de suite. Si l'on renomme ici,
# il faut renommer la-bas, et l'inverse.
#
# POURQUOI UN SCRIPT A PART, et pas trois modes de plus dans crop_logos.ps1 :
# celui-la traite un seul cas, propre et repetable — un logo pose au milieu
# d'une zone blanche. Les quatre sources ci-dessous arrivent chacune dans un
# etat different, et deux d'entre elles demandent un traitement qui n'a rien a
# voir avec un detourage par le blanc. Y ajouter des modes aurait rendu illisible
# un script qui marche.
#
# CE QUE CHAQUE SOURCE EST REELLEMENT — mesure faite, pas suppose :
#
#   « logo dlc the crown thundra.png » (535 x 340) et « dlc zone zero.png »
#   (432 x 198) n'ont PAS de fond blanc : elles arrivent deja detourees, alpha
#   a zero sur tout le pourtour. Il n'y a donc rien a effacer, et il ne FAUT
#   rien effacer : le remplissage depuis les bords de crop_logos.ps1 a ete
#   essaye ici, et il a devore le logo Zone Zero. La raison est instructive.
#   Ce logo est un cartouche a l'encre sombre dont tout l'interieur est blanc
#   OPAQUE, et il est rogne au ras du bas de l'image : sa derniere ligne de
#   pixels touche le bord. Le remplissage, qui part des bords, entre par la et
#   ressort par tout l'interieur — 42 812 pixels blancs effaces, le texte
#   « Zone Zero » se retrouvant sombre sur fond transparent, illisible sur une
#   tuile sombre. C'est exactement le piege que crop_logos.ps1 documente (ne
#   jamais faire « blanc -> transparent » partout), vu par l'autre bout : meme
#   un remplissage depuis les bords perfore un dessin, des lors que son blanc
#   interieur affleure le bord de l'image.
#
#   On se contente donc de recadrer et de reduire, sans toucher a l'alpha. Si
#   un jour l'une de ces sources est remplacee par une version posee sur du
#   blanc, c'est crop_logos.ps1 qu'il faudra employer, pas ce script-ci.
#
#   « isle armor dlc logo.jpg » (900 x 900) est le blason pose sur une vue
#   aerienne de Galar : aucun fond a effacer, il faut separer par la couleur.
#   C'est le travail de extract_armor_crest.ps1, qui laisse son resultat dans
#   tools/.cache/armure-detoure.png (686 x 764). On ne fait ici que le reduire.
#
#   « logo mega dimension.avif » (992 x 992) n'est pas un logo mais la KEY ART
#   complete du DLC : deux Pikachu, Hoopa, des eclairs, et le logotype au
#   milieu. Il n'y a pas de fond a retirer, et le fichier est en AVIF, que
#   System.Drawing ne sait pas lire. Deux etapes en plus, decrites plus bas.
#   A savoir avant de juger le resultat : « MEGA-DIMENSION » est un logotype
#   sur UNE ligne, quatre fois et demie plus large que haut. Reduit dans un
#   carre de 96 px comme les trois autres, il n'en occupe qu'une bande de 20 px
#   au milieu — c'est la proportion du logo, pas un defaut de fabrication. Si
#   la vignette parait trop maigre a l'usage, les deux issues sont de composer
#   le titre sur deux lignes (donc de redessiner le logo) ou de prendre, comme
#   assets/img/jeux/, un carre de la key art elle-meme : la source s'y prete,
#   elle est deja carree.
#
# En PowerShell et non en Python, comme crop_logos.ps1 et make_logos.ps1 : cette
# machine n'a pas de Python, et System.Drawing suffit.
#
# Usage :  powershell -ExecutionPolicy Bypass -File tools/crop_dlc_logos.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore

$racine = Split-Path -Parent $PSScriptRoot
$img    = Join-Path $racine "assets\img"
$src    = Join-Path $img "sources"
$dst    = Join-Path $img "dlc"
$cache  = Join-Path $PSScriptRoot ".cache"
if (-not (Test-Path $dst))   { New-Item -ItemType Directory -Path $dst   | Out-Null }
if (-not (Test-Path $cache)) { New-Item -ItemType Directory -Path $cache | Out-Null }


# --------------------------------------------------------------------------
# AVIF -> PNG, par Windows Imaging Component.
#
# System.Drawing ne connait pas l'AVIF et ne le connaitra jamais : son jeu de
# decodeurs est fige depuis GDI+. WIC, lui, delegue au codec AVIF installe avec
# Windows 11, et WPF (PresentationCore) l'expose sous BitmapDecoder. C'est le
# seul chemin disponible ici sans installer quoi que ce soit — contrainte du
# depot : ni paquet, ni binaire tiers.
#
# La classe rendue par Create() s'appelle « UnknownBitmapDecoder » : c'est
# normal et non un echec. WPF n'a de sous-classe nommee que pour les formats
# qu'il connaissait en 2006 (BMP, GIF, JPEG, PNG, TIFF, WMP) ; tout codec
# arrive depuis passe par cette classe generique. Le decodage, lui, est bon —
# verifie en comparant le rendu avec celui de Chrome, identique.
# --------------------------------------------------------------------------
function Convertir-Avif {
  param([string]$Source, [string]$Sortie)
  $dec = [System.Windows.Media.Imaging.BitmapDecoder]::Create(
    (New-Object System.Uri $Source),
    [System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,
    [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
  $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($dec.Frames[0]))
  $flux = [System.IO.File]::Create($Sortie)
  try { $enc.Save($flux) } finally { $flux.Close() }
  return "$($dec.Frames[0].PixelWidth) x $($dec.Frames[0].PixelHeight)"
}


$code = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class Dlc
{
    // ----------------------------------------------------------------------
    // Le bout commun aux quatre : une image dont l'alpha porte deja le
    // detourage, ramenee dans un carre de `size` px.
    //
    // Repris tel quel de crop_logos.ps1, y compris la marge de 3 % et l'alpha
    // premultiplie avant reduction : sans lui le bicubique melange les pixels
    // effaces (alpha 0, mais RVB encore clair) avec ceux du dessin et laisse un
    // lisere sur les contours. La proportion est gardee — ce sont des
    // logotypes, les etirer dans un carre serait pire que de ne pas les mettre.
    // ----------------------------------------------------------------------
    static string Vignette(Bitmap bmp, string dst, int size)
    {
        int W = bmp.Width, H = bmp.Height;
        BitmapData bd = bmp.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        int stride = bd.Stride;
        byte[] px = new byte[stride * H];
        System.Runtime.InteropServices.Marshal.Copy(bd.Scan0, px, 0, px.Length);
        bmp.UnlockBits(bd);

        int x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
                if (px[y * stride + x * 4 + 3] > 8)
                {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }
        if (x1 < 0) throw new Exception("image entierement transparente : " + dst);

        int cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        int cote = Math.Max(cw, ch);

        Bitmap prem = bmp.Clone(new Rectangle(0, 0, W, H), PixelFormat.Format32bppPArgb);
        Bitmap outBmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(outBmp))
        {
            g.Clear(Color.Transparent);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.SmoothingMode = SmoothingMode.HighQuality;
            int marge = (int)Math.Round(size * 0.03);
            float dispo = size - 2 * marge;
            float ech = dispo / cote;
            float dw = cw * ech, dh = ch * ech;
            g.DrawImage(prem,
                new RectangleF(marge + (dispo - dw) / 2f, marge + (dispo - dh) / 2f, dw, dh),
                new RectangleF(x0, y0, cw, ch), GraphicsUnit.Pixel);
        }
        outBmp.Save(dst, ImageFormat.Png);
        outBmp.Dispose();
        prem.Dispose();
        return string.Format("{0}x{1} -> contenu {2}x{3} -> {4}x{4}", W, H, cw, ch, size);
    }

    // Charge n'importe quelle source dans un tampon 32 bits avec alpha, sans
    // rien redimensionner : les JPEG arrivent en 24 bits, les PNG en 32, et la
    // suite du traitement veut un format unique.
    static Bitmap Charger(string src)
    {
        using (Bitmap orig = new Bitmap(src))
        {
            Bitmap bmp = new Bitmap(orig.Width, orig.Height, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(bmp)) { g.DrawImage(orig, 0, 0, orig.Width, orig.Height); }
            return bmp;
        }
    }

    // ----------------------------------------------------------------------
    // Cas 1 — la source porte deja son detourage dans sa couche alpha.
    //
    // Trois des quatre sont dans ce cas, et il n'y a alors rien de plus
    // intelligent a faire que de recadrer sur la boite englobante et de
    // reduire. Surtout pas un remplissage du blanc depuis les bords : voir
    // l'en-tete, il coupe le logo Zone Zero en deux.
    // ----------------------------------------------------------------------
    public static string Reduire(string src, string dst, int size)
    {
        Bitmap bmp = Charger(src);
        string info = Vignette(bmp, dst, size);
        bmp.Dispose();
        return info;
    }

    // ----------------------------------------------------------------------
    // Cas 2 — un logotype a extraire d'une illustration.
    //
    // Pour Mega-Dimension il n'y a pas de fond : le logotype est pose au milieu
    // d'une key art chargee — eclairs jaunes, halo blanc, zones presque noires.
    // Ni le blanc ni le noir ne separent quoi que ce soit. Ce qui separe, c'est
    // la SATURATION : les lettres sont un degrade arc-en-ciel tres sature,
    // tandis que le halo derriere elles est blanc (saturation nulle) et le reste
    // de l'illustration est sombre. Reste les eclairs jaunes, satures eux
    // aussi : ceux-la sont ecartes autrement, voir plus bas.
    //
    // 1. On recadre a la main sur le logotype (cx, cy, cw, ch) — mesure sur
    //    l'image, pas devine : deborder ramene des morceaux de Pikachu.
    // 2. Masque « sature » : ecart max-min entre R, V et B au moins `dSeuil`,
    //    et composante max au moins `vSeuil` pour ecarter les sombres.
    // 3. On jette tout amas QUI TOUCHE LE BORD du recadrage. C'est le
    //    raisonnement du remplissage depuis les bords de crop_logos.ps1,
    //    transpose du fond aux amas : les lettres sont strictement a
    //    l'interieur du recadrage, choisi pour cela, alors que les
    //    eclairs et les Pikachu y entrent depuis l'exterieur et sont donc
    //    coupes par le bord. On jette aussi les amas de moins de `minAmas`
    //    pixels, qui sont des mouchetures de l'illustration.
    // 4. Il reste alors deux ou trois morceaux d'eclair tombes tout entiers a
    //    l'interieur du recadrage, que ni la taille ni la position ne
    //    distinguent des lettres : le point du « i » fait 87 px, un morceau
    //    d'eclair 338. Ce qui les distingue, c'est CE QU'IL Y A AUTOUR. Le
    //    logotype est cerne d'un epais contour blanc ; l'illustration, non. On
    //    mesure donc, pour chaque amas, la part de blanc dans la couronne de
    //    `rCouronne` px qui l'entoure. La mesure ne laisse aucun doute : les
    //    deux intrus tombent a 15 % et 0 %, quand la plus mauvaise vraie
    //    lettre est a 61 % et la plupart au-dessus de 85 %. Le seuil est pose
    //    a `blancMini` = 50 %, au milieu d'un ecart de un a quatre.
    // 5. On DILATE ce qui reste de `rayon` px et on peint la couronne obtenue
    //    en BLANC. Ce contour blanc existe dans l'original ; le masque par
    //    saturation ne peut pas le retenir (le blanc n'est pas sature) et il
    //    est de toute facon colle au halo blanc du fond, donc impossible a
    //    separer par la couleur. On le RECONSTRUIT : c'est le dessin
    //    d'origine, et il rend les lettres lisibles sur une tuile sombre
    //    comme sur une tuile claire.
    // ----------------------------------------------------------------------
    public static string Logotype(string src, string dst, string debug, int size,
                                  int cx, int cy, int cw, int ch,
                                  int dSeuil, int vSeuil, int minAmas,
                                  int rCouronne, int blancMini, int rayon)
    {
        Bitmap plein = Charger(src);
        Bitmap bmp = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(bmp))
            g.DrawImage(plein, new Rectangle(0, 0, cw, ch), new Rectangle(cx, cy, cw, ch), GraphicsUnit.Pixel);
        plein.Dispose();

        BitmapData bd = bmp.LockBits(new Rectangle(0, 0, cw, ch), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        int stride = bd.Stride;
        byte[] px = new byte[stride * ch];
        System.Runtime.InteropServices.Marshal.Copy(bd.Scan0, px, 0, px.Length);

        bool[] m = new bool[cw * ch];
        for (int y = 0; y < ch; y++)
            for (int x = 0; x < cw; x++)
            {
                int i = y * stride + x * 4;
                int b = px[i], v = px[i + 1], r = px[i + 2];
                int mx = Math.Max(r, Math.Max(v, b)), mn = Math.Min(r, Math.Min(v, b));
                if (mx - mn >= dSeuil && mx >= vSeuil) m[y * cw + x] = true;
            }

        // Amas d'un seul tenant, en 4-connexite. On ne garde que ceux qui sont
        // assez gros ET entierement a l'interieur du recadrage.
        int[] lab = new int[cw * ch];
        int[] pile = new int[cw * ch];
        List<int> candidats = new List<int>();
        int cur = 0, jetesBord = 0, jetesPetits = 0;
        for (int p = 0; p < cw * ch; p++)
        {
            if (!m[p] || lab[p] != 0) continue;
            cur++;
            int sp = 0, n = 0; bool bord = false;
            pile[sp++] = p; lab[p] = cur;
            while (sp > 0)
            {
                int q = pile[--sp]; n++;
                int qx = q % cw, qy = q / cw;
                if (qx == 0 || qy == 0 || qx == cw - 1 || qy == ch - 1) bord = true;
                if (qx > 0        && m[q - 1]  && lab[q - 1]  == 0) { lab[q - 1]  = cur; pile[sp++] = q - 1; }
                if (qx < cw - 1   && m[q + 1]  && lab[q + 1]  == 0) { lab[q + 1]  = cur; pile[sp++] = q + 1; }
                if (qy > 0        && m[q - cw] && lab[q - cw] == 0) { lab[q - cw] = cur; pile[sp++] = q - cw; }
                if (qy < ch - 1   && m[q + cw] && lab[q + cw] == 0) { lab[q + cw] = cur; pile[sp++] = q + cw; }
            }
            if (bord) jetesBord++;
            else if (n < minAmas) jetesPetits++;
            else candidats.Add(cur);
        }

        // Part de blanc dans la couronne de chaque candidat. `marque` retient
        // quel amas a deja compte un pixel donne, pour ne pas compter deux fois
        // un pixel qui longe deux lettres voisines.
        List<int> gardes = new List<int>();
        int[] marque = new int[cw * ch];
        int jetesSansBlanc = 0;
        foreach (int c in candidats)
        {
            int tot = 0, blancs = 0;
            for (int y = 0; y < ch; y++)
                for (int x = 0; x < cw; x++)
                {
                    if (lab[y * cw + x] != c) continue;
                    for (int dy = -rCouronne; dy <= rCouronne; dy++)
                    {
                        int ny = y + dy; if (ny < 0 || ny >= ch) continue;
                        for (int dx = -rCouronne; dx <= rCouronne; dx++)
                        {
                            int nx = x + dx; if (nx < 0 || nx >= cw) continue;
                            int k = ny * cw + nx;
                            if (m[k] || marque[k] == c) continue;
                            marque[k] = c; tot++;
                            int i2 = ny * stride + nx * 4;
                            if (px[i2] >= 205 && px[i2 + 1] >= 205 && px[i2 + 2] >= 205) blancs++;
                        }
                    }
                }
            if (tot > 0 && 100 * blancs / tot >= blancMini) gardes.Add(c);
            else jetesSansBlanc++;
        }

        bool[] lettre = new bool[cw * ch];
        bool[] estGarde = new bool[cur + 1];
        foreach (int c in gardes) estGarde[c] = true;
        for (int p = 0; p < cw * ch; p++) if (lab[p] != 0 && estGarde[lab[p]]) lettre[p] = true;

        // Dilatation par distance de Chebyshev (carre de cote 2*rayon+1) :
        // suffisante ici, et beaucoup plus rapide qu'un disque exact pour un
        // resultat qu'on va reduire d'un facteur cinq.
        bool[] halo = new bool[cw * ch];
        for (int y = 0; y < ch; y++)
            for (int x = 0; x < cw; x++)
            {
                if (!lettre[y * cw + x]) continue;
                for (int dy = -rayon; dy <= rayon; dy++)
                {
                    int ny = y + dy; if (ny < 0 || ny >= ch) continue;
                    for (int dx = -rayon; dx <= rayon; dx++)
                    {
                        int nx = x + dx; if (nx < 0 || nx >= cw) continue;
                        halo[ny * cw + nx] = true;
                    }
                }
            }

        int nLettres = 0, nHalo = 0;
        for (int y = 0; y < ch; y++)
            for (int x = 0; x < cw; x++)
            {
                int p = y * cw + x, i = y * stride + x * 4;
                if (lettre[p]) { px[i + 3] = 255; nLettres++; }
                else if (halo[p]) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255; nHalo++; }
                else px[i + 3] = 0;
            }

        System.Runtime.InteropServices.Marshal.Copy(px, 0, bd.Scan0, px.Length);
        bmp.UnlockBits(bd);

        if (debug != null) bmp.Save(debug, ImageFormat.Png);
        string info = Vignette(bmp, dst, size);
        bmp.Dispose();
        return info + string.Format("  (amas {0}, gardes {1}, jetes : bord {2} / trop petits {3} / sans blanc autour {4} ; lettres {5} px, contour {6} px)",
                                    cur, gardes.Count, jetesBord, jetesPetits, jetesSansBlanc, nLettres, nHalo);
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing


# --------------------------------------------------------------------------
# 1. L'Ile Solitaire de l'Armure — le blason doit d'abord etre sorti de son
#    paysage. Ce premier passage met plusieurs minutes (boucles PowerShell
#    pures sur 810 000 pixels), alors on ne le relance que si son resultat
#    manque : c'est un intermediaire reconstructible, pas un cache fragile.
# --------------------------------------------------------------------------
$armure = Join-Path $cache "armure-detoure.png"
if (-not (Test-Path $armure)) {
  "armure-detoure.png absent : appel de extract_armor_crest.ps1 (comptez quelques minutes)..."
  & (Join-Path $PSScriptRoot "extract_armor_crest.ps1") | Out-Null
}

# --------------------------------------------------------------------------
# 2. Mega-Dimension — AVIF vers PNG avant tout le reste.
# --------------------------------------------------------------------------
$mega = Join-Path $cache "mega-dimension-source.png"
$taille = Convertir-Avif (Join-Path $src "logo mega dimension.avif") $mega
"AVIF decode par WIC : $taille"


# --------------------------------------------------------------------------
# 3. Les quatre vignettes.
#
#    Le recadrage de Mega-Dimension, (250, 435) sur 505 x 140, a ete releve sur
#    l'image : c'est la bande du logotype « MEGA-DIMENSION » et rien d'autre.
#    Il est volontairement plus large que le mot — une vingtaine de pixels de
#    part et d'autre — parce que la regle du point 3 exige que les lettres ne
#    touchent pas le bord : un recadrage au ras du « M » lui ferait toucher le
#    bord gauche, et le mot commencerait par « EGA ».
#
#    On s'arrete AVANT le bloc « LEGENDES POKEMON Z-A » qui le surmonte, pour
#    deux raisons : ce logo-la est celui du jeu de base, deja servi par
#    assets/img/jeux/pokemon-za.png ; et la source le montre DEUX FOIS cote a
#    cote, un defaut du fichier fourni — verifie, Chrome le rend pareil, ce
#    n'est pas le decodeur AVIF — qu'on ne va pas graver dans une vignette.
#
#    La marque « TM » du logotype, elle, ne survit pas et c'est voulu : elle
#    est blanche, donc invisible au masque par saturation. A 96 px elle ne
#    ferait de toute facon qu'un pixel et demi.
# --------------------------------------------------------------------------
$travaux = @(
  @{ nom = "crown-tundra.png"; type = "alpha";    source = (Join-Path $src "logo dlc the crown thundra.png") },
  @{ nom = "zone-zero.png";    type = "alpha";    source = (Join-Path $src "dlc zone zero.png") },
  @{ nom = "isle-armor.png";   type = "alpha";    source = $armure },
  @{ nom = "mega-dim.png";     type = "logotype"; source = $mega }
)

foreach ($t in $travaux) {
  $sortie = Join-Path $dst $t.nom
  if ($t.type -eq "alpha") {
    $info = [Dlc]::Reduire($t.source, $sortie, 96)
  } else {
    $info = [Dlc]::Logotype($t.source, $sortie, (Join-Path $cache "mega-logotype-detoure.png"), 96,
                            250, 435, 505, 140,   # recadrage releve sur l'image
                            60, 90,               # saturation mini, clarte mini
                            60,                   # amas mini, en pixels
                            4, 50,                # couronne : rayon, % de blanc exige
                            5)                    # rayon du contour blanc reconstruit
  }
  $o = (Get-Item $sortie).Length
  "$($t.nom.PadRight(24)) $info  ($o o)"
}
