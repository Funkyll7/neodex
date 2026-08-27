# make_logos.ps1 — fabrique les logos qui ne passent pas par crop_logos.ps1.
#
# Trois besoins que l'autre script ne couvre pas :
#
#   1. capture.png / capture-forme.png
#      Ce sont des MASQUES CSS : seule la couche alpha compte, la couleur est
#      donnee par le bouton (voir `.toggle__ico--capture` dans components.css).
#      Le seuillage binaire de crop_logos.ps1 conviendrait mal ici : il rendrait
#      opaques les gris d'anticrenelage du bord et laisserait un contour en
#      escalier a 13 px. On convertit donc la LUMINANCE en alpha — noir devient
#      opaque, blanc devient transparent, et les gris du bord deviennent des
#      alphas intermediaires. Le masque est lisse par construction.
#
#      La variante « forme » ajoute le losange ◈ en pastille : c'est le glyphe
#      que le site employait deja pour dire « une forme alternative ». Le bouton
#      dit ainsi « capture » ET « d'une autre forme » d'un seul dessin, la ou
#      les formes sans logo de famille (Salarsen Forme Grave, Keldeo Resolu)
#      n'affichaient qu'un ◈ nu.
#
#   2. logo-home.png / logo-go.png
#      Logos couleur des deux onglets. Ils arrivent deja detoures : il suffit de
#      les recadrer sur leur boite englobante et de les reduire. On garde leur
#      proportion — ce sont des logotypes, les deformer serait pire que de ne
#      pas les mettre.
#
# En PowerShell comme crop_logos.ps1 : System.Drawing suffit, et cette machine
# n'a pas de Python.
#
# Usage :  powershell -ExecutionPolicy Bypass -File tools/make_logos.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class Logos
{
    // Boite englobante des pixels dont l'alpha depasse le seuil.
    static Rectangle Boite(Bitmap b)
    {
        int W = b.Width, H = b.Height;
        int x0 = W, y0 = H, x1 = -1, y1 = -1;
        BitmapData bd = b.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        byte[] px = new byte[bd.Stride * H];
        System.Runtime.InteropServices.Marshal.Copy(bd.Scan0, px, 0, px.Length);
        b.UnlockBits(bd);
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
                if (px[y * bd.Stride + x * 4 + 3] > 8)
                {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }
        if (x1 < 0) return new Rectangle(0, 0, W, H);
        return new Rectangle(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    }

    // Noir sur blanc -> masque alpha. `seuilFond` ignore le gris residuel du
    // JPEG dans la zone censee etre blanche : sans lui, tout le fond ressort a
    // alpha 3 ou 4 et le masque peint un carre tres pale autour du dessin.
    public static string Masque(string src, string dst, int size)
    {
        using (Bitmap orig = new Bitmap(src))
        {
            int W = orig.Width, H = orig.Height;
            Bitmap a = new Bitmap(W, H, PixelFormat.Format32bppArgb);
            using (Graphics g0 = Graphics.FromImage(a)) { g0.DrawImage(orig, 0, 0, W, H); }

            BitmapData bd = a.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            byte[] px = new byte[bd.Stride * H];
            System.Runtime.InteropServices.Marshal.Copy(bd.Scan0, px, 0, px.Length);
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    int i = y * bd.Stride + x * 4;            // BGRA
                    int lum = (px[i + 2] * 299 + px[i + 1] * 587 + px[i] * 114) / 1000;
                    int alpha = 255 - lum;
                    if (alpha < 12) alpha = 0;
                    px[i] = 0; px[i + 1] = 0; px[i + 2] = 0;  // la couleur ne sert pas : c'est un masque
                    px[i + 3] = (byte)alpha;
                }
            System.Runtime.InteropServices.Marshal.Copy(px, 0, bd.Scan0, px.Length);
            a.UnlockBits(bd);

            Rectangle box = Boite(a);
            int cote = Math.Max(box.Width, box.Height);
            Bitmap outBmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(outBmp))
            {
                g.Clear(Color.Transparent);
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                float ech = (float)size / cote;
                float dw = box.Width * ech, dh = box.Height * ech;
                g.DrawImage(a, new RectangleF((size - dw) / 2f, (size - dh) / 2f, dw, dh),
                    new RectangleF(box.X, box.Y, box.Width, box.Height), GraphicsUnit.Pixel);
            }
            outBmp.Save(dst, ImageFormat.Png);
            outBmp.Dispose();
            a.Dispose();
            return string.Format("{0}x{1} -> contenu {2}x{3} -> {4}x{4}", W, H, box.Width, box.Height, size);
        }
    }

    // Le masque precedent, reduit dans le coin haut-gauche, plus un losange
    // plein en bas a droite. Les deux dans la seule couche alpha : le resultat
    // reste un masque valide.
    public static string MasqueForme(string src, string dst, int size)
    {
        string tmp = dst + ".tmp.png";
        Masque(src, tmp, size);
        using (Bitmap ball = new Bitmap(tmp))
        {
            Bitmap outBmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(outBmp))
            {
                g.Clear(Color.Transparent);
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.SmoothingMode = SmoothingMode.HighQuality;

                float bs = size * 0.74f;
                g.DrawImage(ball, new RectangleF(0, 0, bs, bs), new RectangleF(0, 0, size, size), GraphicsUnit.Pixel);

                // Le losange, detache de la balle par un liseré vide : colles,
                // les deux formes fusionnaient en une tache a 13 px.
                float d = size * 0.52f;
                float cx = size - d / 2f - size * 0.02f;
                float cy = size - d / 2f - size * 0.02f;
                PointF[] losange = new PointF[] {
                    new PointF(cx, cy - d / 2f), new PointF(cx + d / 2f, cy),
                    new PointF(cx, cy + d / 2f), new PointF(cx - d / 2f, cy)
                };
                using (GraphicsPath trou = new GraphicsPath())
                {
                    trou.AddPolygon(losange);
                    using (Matrix m = new Matrix())
                    {
                        m.Translate(cx, cy);
                        m.Scale(1.34f, 1.34f);
                        m.Translate(-cx, -cy);
                        trou.Transform(m);
                    }
                    using (Region r = new Region(trou))
                    {
                        g.SetClip(r, CombineMode.Replace);
                        g.Clear(Color.Transparent);
                        g.ResetClip();
                    }
                }
                using (SolidBrush br = new SolidBrush(Color.Black)) { g.FillPolygon(br, losange); }
            }
            outBmp.Save(dst, ImageFormat.Png);
            outBmp.Dispose();
        }
        System.IO.File.Delete(tmp);
        return string.Format("balle 80% + losange -> {0}x{0}", size);
    }

    // Logo couleur : recadrage sur la boite englobante, hauteur imposee.
    public static string Couleur(string src, string dst, int hauteur)
    {
        using (Bitmap orig = new Bitmap(src))
        {
            int W = orig.Width, H = orig.Height;
            Bitmap a = new Bitmap(W, H, PixelFormat.Format32bppArgb);
            using (Graphics g0 = Graphics.FromImage(a)) { g0.DrawImage(orig, 0, 0, W, H); }
            Rectangle box = Boite(a);
            int largeur = (int)Math.Round(box.Width * (double)hauteur / box.Height);

            Bitmap prem = a.Clone(new Rectangle(0, 0, W, H), PixelFormat.Format32bppPArgb);
            Bitmap outBmp = new Bitmap(largeur, hauteur, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(outBmp))
            {
                g.Clear(Color.Transparent);
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.DrawImage(prem, new RectangleF(0, 0, largeur, hauteur),
                    new RectangleF(box.X, box.Y, box.Width, box.Height), GraphicsUnit.Pixel);
            }
            outBmp.Save(dst, ImageFormat.Png);
            outBmp.Dispose(); prem.Dispose(); a.Dispose();
            return string.Format("{0}x{1} -> contenu {2}x{3} -> {4}x{5}", W, H, box.Width, box.Height, largeur, hauteur);
        }
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$racine = Split-Path -Parent $PSScriptRoot
$img = Join-Path $racine "assets/img"
$src = Join-Path $img "sources"

$b = Join-Path $src "capture.jpg"
"capture.png          " + [Logos]::Masque($b, (Join-Path $img "capture.png"), 64)
"capture-forme.png    " + [Logos]::MasqueForme($b, (Join-Path $img "capture-forme.png"), 64)
"logo-home.png        " + [Logos]::Couleur((Join-Path $src "pokemon-home.png"), (Join-Path $img "logo-home.png"), 72)
"logo-go.png          " + [Logos]::Couleur((Join-Path $src "pokemon-go.png"), (Join-Path $img "logo-go.png"), 72)

foreach ($f in @("capture.png", "capture-forme.png", "logo-home.png", "logo-go.png")) {
  $p = Join-Path $img $f
  "  $($f.PadRight(20)) $([math]::Round((Get-Item $p).Length / 1KB, 1)) Ko"
}
