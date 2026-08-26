# make_icons.ps1 — fabrique les icones d'application depuis un seul dessin.
#
# Le favicon d'origine etait un SVG de 400 octets : parfait pour un onglet,
# inutilisable en raccourci d'ecran d'accueil, ou Android et iOS reclament des
# PNG de taille fixe. Ce script les produit tous a partir du meme trace.
#
# Trois familles, et elles ne se ressemblent pas par hasard :
#   icon-192 / icon-512   icone normale, dessin centre avec sa marge ;
#   icon-maskable-512     Android recadre l'icone en cercle, en goutte ou en
#                         carre selon le lanceur. Il ne garantit que les 80 %
#                         centraux : le dessin y est donc plus petit, sur un
#                         fond qui va jusqu'au bord ;
#   apple-touch-icon      iOS ignore le manifeste et arrondit lui-meme les
#                         coins : fond plein, pas de transparence.
#
# Usage :  powershell -ExecutionPolicy Bypass -File tools/make_icons.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class Icone
{
    // Couleurs reprises de assets/css/theme.css : l'icone doit etre la meme
    // marque que la pastille du coin superieur gauche du site.
    static readonly Color Fond   = ColorTranslator.FromHtml("#0e1424");
    static readonly Color Rouge  = ColorTranslator.FromHtml("#ff4d4d");
    static readonly Color Blanc  = ColorTranslator.FromHtml("#f4f6fa");
    static readonly Color Or     = ColorTranslator.FromHtml("#ffcb05");
    static readonly Color Sombre = ColorTranslator.FromHtml("#0a0d17");

    /// <param name="part">part du cote occupee par la boule (0.62 normal, 0.50 maskable)</param>
    /// <param name="rond">rayon des coins, 0 pour un carre plein (iOS arrondit lui-meme)</param>
    public static void Ecrire(string dst, int taille, double part, double rond)
    {
        using (Bitmap bmp = new Bitmap(taille, taille, PixelFormat.Format32bppArgb))
        using (Graphics g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.Transparent);

            // Fond
            using (Brush b = new SolidBrush(Fond))
            {
                if (rond <= 0) g.FillRectangle(b, 0, 0, taille, taille);
                else
                {
                    float r = (float)(taille * rond);
                    using (GraphicsPath p = Arrondi(0, 0, taille, taille, r)) g.FillPath(b, p);
                }
            }

            float d = (float)(taille * part);          // diametre de la boule
            float x = (taille - d) / 2f, y = (taille - d) / 2f;
            float cx = taille / 2f, cy = taille / 2f;

            // Moitie haute rouge, moitie basse blanche.
            using (Brush br = new SolidBrush(Rouge)) g.FillPie(br, x, y, d, d, 180, 180);
            using (Brush bb = new SolidBrush(Blanc)) g.FillPie(bb, x, y, d, d, 0, 180);

            // Bande centrale sombre, puis le bouton.
            float bande = d * 0.13f;
            using (Brush bs = new SolidBrush(Sombre))
                g.FillRectangle(bs, x, cy - bande / 2f, d, bande);

            float rb = d * 0.30f;
            using (Brush bs = new SolidBrush(Sombre))
                g.FillEllipse(bs, cx - rb, cy - rb, rb * 2, rb * 2);
            float ri = d * 0.17f;
            using (Brush bw = new SolidBrush(Blanc))
                g.FillEllipse(bw, cx - ri, cy - ri, ri * 2, ri * 2);

            // L'anneau dore : c'est lui qui distingue la marque d'une Poke Ball
            // quelconque, et il tient encore a 48 px.
            using (Pen po = new Pen(Or, d * 0.075f))
                g.DrawEllipse(po, x, y, d, d);

            bmp.Save(dst, ImageFormat.Png);
        }
    }

    static GraphicsPath Arrondi(float x, float y, float w, float h, float r)
    {
        GraphicsPath p = new GraphicsPath();
        p.AddArc(x, y, r * 2, r * 2, 180, 90);
        p.AddArc(x + w - r * 2, y, r * 2, r * 2, 270, 90);
        p.AddArc(x + w - r * 2, y + h - r * 2, r * 2, r * 2, 0, 90);
        p.AddArc(x, y + h - r * 2, r * 2, r * 2, 90, 90);
        p.CloseFigure();
        return p;
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$img = Join-Path (Split-Path -Parent $PSScriptRoot) "assets/img"

$jobs = @(
  @{ nom = "icon-192.png";           taille = 192; part = 0.62; rond = 0.22 },
  @{ nom = "icon-512.png";           taille = 512; part = 0.62; rond = 0.22 },
  @{ nom = "icon-maskable-512.png";  taille = 512; part = 0.50; rond = 0.00 },
  @{ nom = "apple-touch-icon.png";   taille = 180; part = 0.62; rond = 0.00 }
)

foreach ($j in $jobs) {
  $d = Join-Path $img $j.nom
  [Icone]::Ecrire($d, $j.taille, $j.part, $j.rond)
  $ko = [math]::Round((Get-Item $d).Length / 1KB, 1)
  "{0,-26} {1}x{1}  ({2} Ko)" -f $j.nom, $j.taille, $ko
}
